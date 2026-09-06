import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ── Performance par commercial ──────────────────────────────────────
  async byCommercial(since?: Date) {
    const dateFilter = since ? { createdAt: { gte: since } } : {};
    const commercials = await this.prisma.user.findMany({
      where: {
        role: { in: ["COMMERCIAL", "RESPONSABLE_COMMERCIAL"] },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true, zone: true },
    });

    const results = [];
    for (const c of commercials) {
      const orders = await this.prisma.saleOrder.findMany({
        where: {
          createdById: c.id,
          isArchived: false,
          status: { not: "CANCELLED" },
          ...dateFilter,
        },
        select: { totalAmount: true, clientId: true },
      });
      const revenue = orders.reduce((s, o) => s + Number(o.totalAmount), 0);
      const uniqueClients = new Set(orders.map((o) => o.clientId)).size;

      const visits = await this.prisma.visit.findMany({
        where: { userId: c.id, ...(since && { scheduledAt: { gte: since } }) },
        select: { status: true, orderCreated: true },
      });
      const completedVisits = visits.filter(
        (v) => v.status === "COMPLETED",
      ).length;
      const visitsWithOrder = visits.filter((v) => v.orderCreated).length;
      const conversionRate =
        completedVisits > 0
          ? Math.round((visitsWithOrder / completedVisits) * 100)
          : 0;

      const assignedClients = await this.prisma.client.count({
        where: { assignedUserId: c.id, isActive: true },
      });

      results.push({
        commercialId: c.id,
        name: `${c.firstName} ${c.lastName}`,
        zone: c.zone,
        revenue: Math.round(revenue * 1000) / 1000,
        orderCount: orders.length,
        avgOrderValue:
          orders.length > 0
            ? Math.round((revenue / orders.length) * 1000) / 1000
            : 0,
        activeClientsServed: uniqueClients,
        assignedClients,
        visitsCompleted: completedVisits,
        conversionRate,
      });
    }
    return results.sort((a, b) => b.revenue - a.revenue);
  }

  // ── Performance par produit ─────────────────────────────────────────
  async byProduct(since?: Date) {
    const items = await this.prisma.saleOrderItem.findMany({
      where: {
        order: {
          isArchived: false,
          status: { not: "CANCELLED" },
          ...(since && { createdAt: { gte: since } }),
        },
      },
      select: {
        quantity: true,
        subtotal: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            flavor: true,
            category: { select: { name: true, color: true } },
          },
        },
      },
    });

    const map = new Map<string, any>();
    for (const item of items) {
      if (!item.product) continue;
      const key = item.product.id;
      if (!map.has(key)) {
        map.set(key, {
          productId: key,
          name: item.product.name,
          sku: item.product.sku,
          flavor: item.product.flavor,
          category: item.product.category?.name ?? null,
          categoryColor: item.product.category?.color ?? null,
          quantitySold: 0,
          revenue: 0,
          orderLines: 0,
        });
      }
      const entry = map.get(key);
      entry.quantitySold += item.quantity;
      entry.revenue += Number(item.subtotal);
      entry.orderLines += 1;
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, revenue: Math.round(e.revenue * 1000) / 1000 }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  // ── Performance par catégorie ───────────────────────────────────────
  async byCategory(since?: Date) {
    const products = await this.byProduct(since);
    const map = new Map<string, any>();
    for (const p of products) {
      const key = p.category ?? "Sans catégorie";
      if (!map.has(key)) {
        map.set(key, {
          category: key,
          color: p.categoryColor,
          revenue: 0,
          quantitySold: 0,
          productCount: 0,
        });
      }
      const entry = map.get(key);
      entry.revenue += p.revenue;
      entry.quantitySold += p.quantitySold;
      entry.productCount += 1;
    }
    return Array.from(map.values())
      .map((e) => ({ ...e, revenue: Math.round(e.revenue * 1000) / 1000 }))
      .sort((a, b) => b.revenue - a.revenue);
  }
}
