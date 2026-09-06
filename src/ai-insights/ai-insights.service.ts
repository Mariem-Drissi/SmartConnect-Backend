import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";

/**
 * ai-insights.service.ts — Phase 2 (branché sur le microservice FastAPI)
 * ───────────────────────────────────────────────────────────────────
 * Ce que fait triggerAnalysis() maintenant :
 *  1. Récupère les clients / commandes / visites depuis PostgreSQL (Prisma)
 *  2. Les envoie au microservice Python (POST /analyze)
 *  3. Reçoit une liste d'"insights" déjà rédigés et scorés
 *  4. Les enregistre dans la table ai_insights (évite les doublons récents)
 *
 * NestJS reste responsable de TOUTES les écritures en base — le
 * microservice Python est "stateless" (aucune connexion DB), ce qui
 * simplifie beaucoup le déploiement et la sécurité.
 */
@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async getInsights(clientId?: string) {
    return this.prisma.aIInsight.findMany({
      where: clientId ? { clientId } : {},
      include: { client: { select: { name: true, city: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markRead(id: string) {
    return this.prisma.aIInsight.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async remove(id: string) {
    return this.prisma.aIInsight.delete({ where: { id } });
  }

  async getUnreadCount() {
    return {
      count: await this.prisma.aIInsight.count({ where: { isRead: false } }),
    };
  }

  /**
   * getRecommendations() — Moteur de recommandations
   * ───────────────────────────────────────────────────────────────────
   * Ne fait AUCUN nouveau calcul ML : il agrège intelligemment ce que
   * les modèles ont déjà produit (table ai_insights) + une règle métier
   * simple sur les prospects qualifiés sans suite, pour donner à chaque
   * commercial une liste d'actions priorisées plutôt qu'un flux brut
   * d'alertes séparées.
   */
  async getRecommendations(commercialId?: string) {
    // 1) Insights IA non lus, rattachés à un client assigné à un commercial
    const insights = await this.prisma.aIInsight.findMany({
      where: {
        isRead: false,
        client: { assignedUserId: commercialId ? commercialId : { not: null } },
      },
      include: {
        client: { select: { name: true, city: true, assignedUserId: true } },
      },
      orderBy: { score: "desc" },
      take: 200,
    });

    // 2) Prospects qualifiés depuis plus de 10 jours sans nouvelle action
    //    (opportunité en train de refroidir — règle métier simple, pas de ML)
    const staleCutoff = new Date(Date.now() - 10 * 86400000);
    const staleProspects = await this.prisma.prospect.findMany({
      where: {
        status: "QUALIFIED",
        updatedAt: { lt: staleCutoff },
        ...(commercialId
          ? { assignedUserId: commercialId }
          : { assignedUserId: { not: null } }),
      },
      select: {
        id: true,
        name: true,
        city: true,
        potentialValue: true,
        assignedUserId: true,
        updatedAt: true,
      },
    });

    // 3) Regrouper par commercial
    const byCommercial = new Map<string, any[]>();
    const addRec = (uid: string, rec: any) => {
      if (!byCommercial.has(uid)) byCommercial.set(uid, []);
      byCommercial.get(uid)!.push(rec);
    };

    const priorityByType: Record<string, number> = {
      INACTIVITY_RISK: 3,
      PROSPECT_NEARBY: 2,
      HIGH_POTENTIAL: 2,
      ANOMALY: 1,
      SALES_FORECAST: 0,
    };

    for (const i of insights) {
      const uid = i.client?.assignedUserId;
      if (!uid) continue;
      addRec(uid, {
        source: "ai_insight",
        insightId: i.id,
        type: i.type,
        priority: priorityByType[i.type] ?? 1,
        title: i.title,
        description: i.description,
        clientName: i.client?.name,
        score: i.score,
      });
    }
    for (const p of staleProspects) {
      if (!p.assignedUserId) continue;
      const daysStale = Math.floor(
        (Date.now() - p.updatedAt.getTime()) / 86400000,
      );
      addRec(p.assignedUserId, {
        source: "prospect_rule",
        insightId: null,
        type: "STALE_OPPORTUNITY",
        priority: 3,
        title: `Prospect qualifié sans suite : ${p.name}`,
        description:
          `Ce prospect est qualifié depuis ${daysStale} jours sans nouvelle action` +
          (p.potentialValue
            ? ` (potentiel estimé : ${Number(p.potentialValue).toFixed(0)} TND)`
            : "") +
          `. Relancez-le avant qu'il ne refroidisse.`,
        clientName: p.name,
        score: null,
      });
    }

    // 4) Trier chaque liste par priorité puis score, limiter à 8 par commercial
    const commercials = await this.prisma.user.findMany({
      where: { id: { in: Array.from(byCommercial.keys()) } },
      select: { id: true, firstName: true, lastName: true, zone: true },
    });
    const nameById = new Map(
      commercials.map((c) => [c.id, `${c.firstName} ${c.lastName}`]),
    );

    return Array.from(byCommercial.entries()).map(([uid, recs]) => ({
      commercialId: uid,
      commercialName: nameById.get(uid) ?? uid,
      recommendations: recs
        .sort(
          (a, b) => b.priority - a.priority || (b.score ?? 0) - (a.score ?? 0),
        )
        .slice(0, 8),
    }));
  }

  async triggerAnalysis(clientId?: string) {
    const aiUrl = this.config.get(
      "AI_MICROSERVICE_URL",
      "http://localhost:8000",
    );
    const aiKey = this.config.get("AI_MICROSERVICE_KEY", "ai_secret_key");

    const since = new Date();
    since.setMonth(since.getMonth() - 18);

    const clients = await this.prisma.client.findMany({
      where: { isActive: true, ...(clientId && { id: clientId }) },
      select: {
        id: true,
        name: true,
        clientType: true,
        region: true,
        city: true,
        latitude: true,
        longitude: true,
      },
    });
    if (clients.length === 0)
      return { generated: 0, message: "Aucun client à analyser" };

    const clientIds = clients.map((c) => c.id);
    const orders = await this.prisma.saleOrder.findMany({
      where: { clientId: { in: clientIds }, createdAt: { gte: since } },
      select: {
        id: true,
        clientId: true,
        createdAt: true,
        totalAmount: true,
        status: true,
      },
    });
    const visits = await this.prisma.visit.findMany({
      where: { clientId: { in: clientIds }, scheduledAt: { gte: since } },
      select: { clientId: true, scheduledAt: true },
    });
    // Prospects actifs (ni convertis, ni perdus) pour la détection PROSPECT_NEARBY
    const prospects = await this.prisma.prospect.findMany({
      where: {
        status: { notIn: ["CONVERTED", "LOST"] },
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        status: true,
        city: true,
        region: true,
        latitude: true,
        longitude: true,
        potentialValue: true,
      },
    });

    const payload = {
      client_id: clientId,
      clients: clients.map((c) => ({
        client_id: c.id,
        name: c.name,
        client_type: c.clientType,
        region: c.region ?? "Tunis",
        city: c.city,
        latitude: c.latitude,
        longitude: c.longitude,
      })),
      orders: orders.map((o) => ({
        client_id: o.clientId,
        order_id: o.id,
        order_date: o.createdAt.toISOString(),
        amount_tnd: Number(o.totalAmount),
        status: o.status === "CANCELLED" ? "CANCELLED" : "DELIVERED",
      })),
      visits: visits.map((v) => ({
        client_id: v.clientId,
        visit_date: v.scheduledAt.toISOString(),
      })),
      prospects: prospects.map((p) => ({
        prospect_id: p.id,
        name: p.name,
        status: p.status,
        city: p.city,
        region: p.region,
        latitude: p.latitude,
        longitude: p.longitude,
        potential_value: p.potentialValue ? Number(p.potentialValue) : null,
      })),
    };

    let aiResponse: any;
    try {
      const res = await fetch(`${aiUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": aiKey },
        body: JSON.stringify(payload),
        // @ts-ignore
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(
          `Microservice IA a répondu ${res.status}: ${errText}`,
        );
        return {
          generated: 0,
          message: `Erreur microservice IA (${res.status})`,
        };
      }
      aiResponse = await res.json();
    } catch (err) {
      this.logger.error(
        `Impossible de contacter le microservice IA (${aiUrl}): ${err.message}`,
      );
      return {
        generated: 0,
        message:
          "Microservice IA injoignable — vérifiez qu'il est démarré (voir ai-service/README.md)",
      };
    }

    let created = 0;
    for (const insight of aiResponse.insights ?? []) {
      const existing = insight.client_id
        ? await this.prisma.aIInsight.findFirst({
            where: {
              clientId: insight.client_id,
              type: insight.type,
              createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
            },
          })
        : null;
      if (existing) continue;

      await this.prisma.aIInsight.create({
        data: {
          clientId: insight.client_id ?? null,
          type: insight.type,
          title: insight.title,
          description: insight.description,
          score: insight.score ?? null,
          metadata: insight.metadata ?? {},
        },
      });
      created++;
    }

    return {
      generated: created,
      totalFromModel: aiResponse.insights?.length ?? 0,
      clientsAnalyzed: aiResponse.clients_analyzed,
      message: `Analyse IA complétée — ${created} nouvelle(s) alerte(s)`,
    };
  }
}
