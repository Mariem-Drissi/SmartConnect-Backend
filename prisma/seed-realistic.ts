/**
 * seed-realistic.ts
 * ─────────────────────────────────────────────────────────────────────
 * Jeu de données RÉALISTE pour SmartConnect Gusto Club — PAS un jeu de
 * démo minimal. Génère :
 *   - 14 utilisateurs internes (rôles variés)
 *   - 4 catégories + 14 produits avec stock
 *   - 9 matières premières avec fournisseurs
 *   - ~85 clients tunisiens (GPS réels, types variés)
 *   - ~24 prospects
 *   - ~14 mois d'historique de commandes (avec saisonnalité)
 *   - Un historique de visites commerciales
 *   - Quelques tournées (dont certaines NON optimisées exprès, pour
 *     pouvoir tester le bouton "Optimiser TSP" en conditions réelles)
 *
 * Ce script est IDEMPOTENT autant que possible (upsert sur les clés
 * uniques comme l'email ou le SKU) mais est pensé pour tourner sur une
 * base fraîchement migrée. Voir le guide d'import en fin de fichier
 * (commentaire) pour la marche à suivre complète.
 */
import {
  PrismaClient,
  SystemRole,
  ClientType,
  ProspectStatus,
  OrderStatus,
  VisitStatus,
} from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// ── Utilitaires aléatoires ──────────────────────────────────────────
function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number, decimals = 3): number {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}
function weightedChoice<T>(items: readonly T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ── Référentiel géographique (coordonnées réelles, centre-ville) ────
const REGIONS: Record<string, { name: string; lat: number; lon: number }[]> = {
  Tunis: [
    { name: "Tunis", lat: 36.8065, lon: 10.1815 },
    { name: "La Marsa", lat: 36.8778, lon: 10.3247 },
    { name: "Carthage", lat: 36.8531, lon: 10.3239 },
    { name: "Le Bardo", lat: 36.8095, lon: 10.1397 },
  ],
  Ariana: [
    { name: "Ariana", lat: 36.8625, lon: 10.1956 },
    { name: "Raoued", lat: 36.9333, lon: 10.1667 },
  ],
  "Ben Arous": [
    { name: "Ben Arous", lat: 36.7469, lon: 10.2258 },
    { name: "Radès", lat: 36.7644, lon: 10.2775 },
    { name: "Hammam Lif", lat: 36.73, lon: 10.34 },
  ],
  Nabeul: [
    { name: "Nabeul", lat: 36.4561, lon: 10.7376 },
    { name: "Hammamet", lat: 36.4, lon: 10.6167 },
    { name: "Kélibia", lat: 36.8422, lon: 11.0947 },
    { name: "Korba", lat: 36.5722, lon: 10.8608 },
  ],
  Sousse: [
    { name: "Sousse", lat: 35.8256, lon: 10.6084 },
    { name: "Kalâa Kebira", lat: 35.8686, lon: 10.5397 },
    { name: "Msaken", lat: 35.7333, lon: 10.5833 },
  ],
  Monastir: [
    { name: "Monastir", lat: 35.7643, lon: 10.8113 },
    { name: "Skanès", lat: 35.7833, lon: 10.7667 },
    { name: "Ksar Hellal", lat: 35.6467, lon: 10.8919 },
  ],
  Mahdia: [
    { name: "Mahdia", lat: 35.5047, lon: 11.0622 },
    { name: "Ksour Essef", lat: 35.4167, lon: 10.9833 },
  ],
  Sfax: [
    { name: "Sfax", lat: 34.7406, lon: 10.7603 },
    { name: "Sakiet Ezzit", lat: 34.8, lon: 10.7333 },
    { name: "Mahres", lat: 34.5333, lon: 10.7333 },
  ],
  Bizerte: [
    { name: "Bizerte", lat: 37.2744, lon: 9.8739 },
    { name: "Menzel Bourguiba", lat: 37.155, lon: 9.79 },
  ],
  Kairouan: [{ name: "Kairouan", lat: 35.6781, lon: 10.0963 }],
  Gabès: [
    { name: "Gabès", lat: 33.8815, lon: 10.0982 },
    { name: "Mareth", lat: 33.6333, lon: 10.2667 },
  ],
  Médenine: [
    { name: "Médenine", lat: 33.3549, lon: 10.5055 },
    { name: "Djerba (Houmt Souk)", lat: 33.8076, lon: 10.8451 },
    { name: "Zarzis", lat: 33.5039, lon: 11.1122 },
  ],
  "Le Kef": [{ name: "Le Kef", lat: 36.1822, lon: 8.7148 }],
};
const TOURISTIC_REGIONS = new Set(["Nabeul", "Sousse", "Monastir", "Médenine"]);

function pickCity() {
  const region = rand(Object.keys(REGIONS));
  const city = rand(REGIONS[region]);
  return {
    region,
    city: city.name,
    lat: city.lat + randFloat(-0.02, 0.02, 6),
    lon: city.lon + randFloat(-0.02, 0.02, 6),
  };
}

// ── Pools de noms réalistes ──────────────────────────────────────────
const FIRST_NAMES_M = [
  "Ahmed",
  "Mohamed",
  "Karim",
  "Yassine",
  "Hedi",
  "Walid",
  "Sami",
  "Bilel",
  "Anis",
  "Nabil",
  "Fares",
  "Aymen",
  "Skander",
  "Chokri",
  "Moez",
];
const FIRST_NAMES_F = [
  "Sonia",
  "Amira",
  "Fatma",
  "Nour",
  "Rania",
  "Mariem",
  "Ines",
  "Emna",
  "Wafa",
  "Salma",
  "Yosra",
  "Dorra",
  "Hela",
  "Meriem",
  "Asma",
];
const LAST_NAMES = [
  "Ben Salah",
  "Trabelsi",
  "Jlassi",
  "Mejri",
  "Chaabane",
  "Gharbi",
  "Bouazizi",
  "Hamdi",
  "Sassi",
  "Khemiri",
  "Ben Amor",
  "Fendri",
  "Tlili",
  "Bouassida",
  "Zouari",
  "Guesmi",
  "Karray",
  "Mansouri",
  "Toumi",
  "Ayari",
];

function randomPerson() {
  const isM = Math.random() > 0.45;
  const first = rand(isM ? FIRST_NAMES_M : FIRST_NAMES_F);
  const last = rand(LAST_NAMES);
  return { first, last };
}
function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

async function main() {
  console.log(
    "🌱 Génération du jeu de données réaliste — SmartConnect Gusto Club\n",
  );
  console.log(
    "⏱️  Ce script prend 2 à 5 minutes selon votre machine (beaucoup de commandes générées).\n",
  );

  // ═══════════════════════════════════════════════════════════════════
  // 1. UTILISATEURS
  // ═══════════════════════════════════════════════════════════════════
  console.log("👤 Création des utilisateurs...");

  const adminPwd = await bcrypt.hash("Admin@2024", 10);
  const stdPwd = await bcrypt.hash("Gusto@2024", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@gustoclub.tn" },
    update: {},
    create: {
      email: "admin@gustoclub.tn",
      password: adminPwd,
      firstName: "Sami",
      lastName: "Karray",
      role: SystemRole.ADMIN,
      phone: "+216 71 245 800",
    },
  });

  const respCommercialData = [
    {
      first: "Karim",
      last: "Ben Salah",
      zone: "Grand Tunis",
      phone: "+216 20 145 632",
    },
    {
      first: "Amira",
      last: "Trabelsi",
      zone: "Centre-Est (Sousse/Monastir)",
      phone: "+216 22 458 901",
    },
  ];
  const responsables = [];
  for (const r of respCommercialData) {
    const email = `${slug(r.first)}.${slug(r.last)}@gustoclub.tn`;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: stdPwd,
        firstName: r.first,
        lastName: r.last,
        role: SystemRole.RESPONSABLE_COMMERCIAL,
        zone: r.zone,
        phone: r.phone,
      },
    });
    responsables.push(u);
  }

  const commercialData = [
    {
      first: "Yassine",
      last: "Chaabane",
      zone: "Tunis Nord",
      phone: "+216 22 331 007",
    },
    {
      first: "Nour",
      last: "Mejri",
      zone: "Tunis Sud & Ben Arous",
      phone: "+216 24 552 118",
    },
    { first: "Hedi", last: "Gharbi", zone: "Sousse", phone: "+216 23 667 290" },
    {
      first: "Rania",
      last: "Hamdi",
      zone: "Monastir & Mahdia",
      phone: "+216 25 118 443",
    },
    { first: "Anis", last: "Sassi", zone: "Sfax", phone: "+216 21 984 556" },
    {
      first: "Emna",
      last: "Khemiri",
      zone: "Nabeul & Hammamet",
      phone: "+216 26 774 231",
    },
    {
      first: "Walid",
      last: "Ben Amor",
      zone: "Bizerte",
      phone: "+216 27 340 812",
    },
  ];
  const commercials = [];
  for (const c of commercialData) {
    const email = `${slug(c.first)}.${slug(c.last)}@gustoclub.tn`;
    const u = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: stdPwd,
        firstName: c.first,
        lastName: c.last,
        role: SystemRole.COMMERCIAL,
        zone: c.zone,
        phone: c.phone,
      },
    });
    commercials.push(u);
  }

  const supportRoles: [string, string, SystemRole, string][] = [
    ["Fares", "Zouari", SystemRole.STOCK_MANAGER, "+216 71 556 210"],
    ["Chokri", "Guesmi", SystemRole.WAREHOUSE_KEEPER, "+216 71 556 211"],
    ["Dorra", "Mansouri", SystemRole.ACCOUNTANT, "+216 71 556 212"],
    ["Moez", "Toumi", SystemRole.PRODUCTION_MANAGER, "+216 71 556 213"],
    ["Wafa", "Ayari", SystemRole.ACCOUNTANT, "+216 71 556 214"],
  ];
  for (const [first, last, role, phone] of supportRoles) {
    const email = `${slug(first)}.${slug(last)}@gustoclub.tn`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        password: stdPwd,
        firstName: first,
        lastName: last,
        role,
        phone,
      },
    });
  }
  console.log(
    `   ✅ ${1 + responsables.length + commercials.length + supportRoles.length} utilisateurs créés`,
  );

  // ═══════════════════════════════════════════════════════════════════
  // 2. CATALOGUE PRODUITS
  // ═══════════════════════════════════════════════════════════════════
  console.log("Création du catalogue produits...");

  const categoryData = [
    {
      name: "Taralli Classiques",
      description: "Les recettes historiques Gusto Club",
      color: "#E7C27D",
    },
    {
      name: "Taralli Épicés",
      description: "Saveurs tunisiennes relevées",
      color: "#D4A24E",
    },
    {
      name: "Taralli Premium",
      description: "Gamme haut de gamme, gros formats",
      color: "#7FE0CB",
    },
    {
      name: "Coffrets & Cadeaux",
      description: "Assortiments pour occasions spéciales",
      color: "#4EC9B0",
    },
  ];
  const categories: Record<string, string> = {};
  for (const c of categoryData) {
    const cat = await prisma.productCategory.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
    categories[c.name] = cat.id;
  }

  const productData = [
    {
      name: "Taralli Nature 250g",
      flavor: "nature",
      sku: "GC-NAT-250",
      weightGrams: 250,
      unitPrice: 4.5,
      costPrice: 1.85,
      category: "Taralli Classiques",
    },
    {
      name: "Taralli Sésame 250g",
      flavor: "sésame",
      sku: "GC-SES-250",
      weightGrams: 250,
      unitPrice: 4.8,
      costPrice: 1.95,
      category: "Taralli Classiques",
    },
    {
      name: "Taralli Finocchio 250g",
      flavor: "finocchio",
      sku: "GC-FIN-250",
      weightGrams: 250,
      unitPrice: 4.9,
      costPrice: 2.0,
      category: "Taralli Classiques",
    },
    {
      name: "Taralli Origan 250g",
      flavor: "origan",
      sku: "GC-ORI-250",
      weightGrams: 250,
      unitPrice: 4.7,
      costPrice: 1.9,
      category: "Taralli Classiques",
    },
    {
      name: "Taralli Harissa 250g",
      flavor: "harissa",
      sku: "GC-HAR-250",
      weightGrams: 250,
      unitPrice: 5.2,
      costPrice: 2.1,
      category: "Taralli Épicés",
    },
    {
      name: "Taralli Zaatar 250g",
      flavor: "zaatar",
      sku: "GC-ZAA-250",
      weightGrams: 250,
      unitPrice: 5.2,
      costPrice: 2.1,
      category: "Taralli Épicés",
    },
    {
      name: "Taralli Cumin 250g",
      flavor: "cumin",
      sku: "GC-CUM-250",
      weightGrams: 250,
      unitPrice: 5.0,
      costPrice: 2.0,
      category: "Taralli Épicés",
    },
    {
      name: "Taralli Piment Fort 250g",
      flavor: "piment fort",
      sku: "GC-PIM-250",
      weightGrams: 250,
      unitPrice: 5.3,
      costPrice: 2.15,
      category: "Taralli Épicés",
    },
    {
      name: "Taralli Olive Noire 500g",
      flavor: "olive noire",
      sku: "GC-OLI-500",
      weightGrams: 500,
      unitPrice: 9.8,
      costPrice: 3.9,
      category: "Taralli Premium",
    },
    {
      name: "Taralli Mix Premium 500g",
      flavor: "mix",
      sku: "GC-MIX-500",
      weightGrams: 500,
      unitPrice: 10.5,
      costPrice: 4.2,
      category: "Taralli Premium",
    },
    {
      name: "Taralli Amandes 500g",
      flavor: "amandes",
      sku: "GC-AMA-500",
      weightGrams: 500,
      unitPrice: 12.0,
      costPrice: 5.0,
      category: "Taralli Premium",
    },
    {
      name: "Taralli Fromage 500g",
      flavor: "fromage",
      sku: "GC-FRO-500",
      weightGrams: 500,
      unitPrice: 11.2,
      costPrice: 4.6,
      category: "Taralli Premium",
    },
    {
      name: "Coffret Découverte 4 saveurs",
      flavor: "mix",
      sku: "GC-GIFT-4",
      weightGrams: 1000,
      unitPrice: 19.5,
      costPrice: 7.8,
      category: "Coffrets & Cadeaux",
    },
    {
      name: "Coffret Prestige 6 saveurs",
      flavor: "mix",
      sku: "GC-GIFT-6",
      weightGrams: 1500,
      unitPrice: 28.0,
      costPrice: 11.0,
      category: "Coffrets & Cadeaux",
    },
  ];

  const products: { id: string; unitPrice: number; sku: string }[] = [];
  for (const p of productData) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: {
        name: p.name,
        flavor: p.flavor,
        sku: p.sku,
        weightGrams: p.weightGrams,
        unitPrice: p.unitPrice,
        costPrice: p.costPrice,
        categoryId: categories[p.category],
        description: `Taralli artisanal ${p.flavor} — recette Gusto Club`,
      },
    });
    await prisma.productStock.upsert({
      where: { productId: prod.id },
      update: {},
      create: {
        productId: prod.id,
        quantity: randInt(150, 900),
        minThreshold: randInt(40, 100),
      },
    });
    products.push({ id: prod.id, unitPrice: p.unitPrice, sku: p.sku });
  }
  console.log(
    `   ✅ ${categoryData.length} catégories, ${productData.length} produits`,
  );

  // ═══════════════════════════════════════════════════════════════════
  // 3. STOCK ASSIGNÉ À CHAQUE COMMERCIAL (van / tournée)
  // ═══════════════════════════════════════════════════════════════════
  console.log("📦 Attribution du stock aux commerciaux...");
  for (const commercial of commercials) {
    for (const prod of products) {
      await prisma.commercialStock.upsert({
        where: {
          userId_productId: { userId: commercial.id, productId: prod.id },
        },
        update: {},
        create: {
          userId: commercial.id,
          productId: prod.id,
          quantity: randInt(20, 90),
          minThreshold: 15,
        },
      });
    }
  }
  console.log(`   ✅ Stock assigné pour ${commercials.length} commerciaux`);

  // ═══════════════════════════════════════════════════════════════════
  // 4. CLIENTS
  // ═══════════════════════════════════════════════════════════════════
  console.log("🏪 Création des clients...");

  const GMS_NAMES = [
    "Carrefour",
    "Monoprix",
    "Géant",
    "Magasin Général",
    "Aziza",
    "MG Market",
  ];
  const WHOLESALER_TEMPLATES = [
    "Grossiste {n}",
    "Distribution {n}",
    "Import-Export {n}",
    "Gros Alimentaire {n}",
    "Centrale d'Achat {n}",
  ];
  const B2B_TEMPLATES = [
    "Hôtel {n}",
    "Restaurant Le {n}",
    "Café {n}",
    "Traiteur {n}",
    "Pâtisserie {n}",
    "Resto {n}",
  ];
  const B2C_TEMPLATES = [
    "Épicerie Fine {n}",
    "Superette {n}",
    "Alimentation Générale {n}",
    "Marché {n}",
  ];
  const OCCASIONAL_TEMPLATES = [
    "Kiosque {n}",
    "Snack {n}",
    "Boutique {n}",
    "Dépôt {n}",
  ];
  const NAME_SUFFIXES = [
    "Étoile",
    "Perle",
    "Jasmin",
    "Palmier",
    "Horizon",
    "Medina",
    "Essaada",
    "Bonheur",
    "Zitouna",
    "Andalous",
    "El Amen",
    "Wafa",
    "Baraka",
    "Nour",
    "Salem",
    "El Fejr",
    "Ennour",
    "Chams",
    "Yasmine",
    "El Warda",
  ];

  function businessName(type: ClientType, city: string): string {
    if (type === ClientType.GMS) return `${rand(GMS_NAMES)} ${city}`;
    const templates = {
      [ClientType.WHOLESALER]: WHOLESALER_TEMPLATES,
      [ClientType.B2B]: B2B_TEMPLATES,
      [ClientType.B2C]: B2C_TEMPLATES,
      [ClientType.OCCASIONAL]: OCCASIONAL_TEMPLATES,
    }[type]!;
    return rand(templates).replace("{n}", rand(NAME_SUFFIXES));
  }

  const clientTypes = [
    ClientType.GMS,
    ClientType.WHOLESALER,
    ClientType.B2B,
    ClientType.B2C,
    ClientType.OCCASIONAL,
  ];
  const clientTypeWeights = [0.12, 0.15, 0.28, 0.3, 0.15];

  interface SeedClient {
    id: string;
    name: string;
    behavior: "growing" | "stable" | "declining" | "sporadic" | "new";
    baseOrderValue: number;
    baseFrequencyDays: number;
    commercialId: string;
  }
  const clients: SeedClient[] = [];

  const TOTAL_CLIENTS = 85;
  for (let i = 0; i < TOTAL_CLIENTS; i++) {
    const { region, city, lat, lon } = pickCity();
    const type = weightedChoice(clientTypes, clientTypeWeights);
    const name = businessName(type, city);
    const contact = randomPerson();
    const commercial = rand(commercials);

    const baseOrderValue = {
      GMS: randFloat(700, 2200),
      WHOLESALER: randFloat(450, 1600),
      B2B: randFloat(70, 320),
      B2C: randFloat(35, 140),
      OCCASIONAL: randFloat(18, 80),
    }[type];
    const baseFrequencyDays = {
      GMS: randInt(10, 20),
      WHOLESALER: randInt(14, 28),
      B2B: randInt(7, 21),
      B2C: randInt(20, 45),
      OCCASIONAL: randInt(40, 90),
    }[type];
    const behavior = weightedChoice(
      ["growing", "stable", "declining", "sporadic", "new"] as const,
      [0.18, 0.4, 0.15, 0.17, 0.1],
    );

    const existing = await prisma.client.findFirst({ where: { name, city } });
    let client;
    if (existing) {
      client = existing;
    } else {
      client = await prisma.client.create({
        data: {
          name,
          city,
          region,
          latitude: lat,
          longitude: lon,
          clientType: type,
          email:
            Math.random() > 0.25
              ? `contact@${slug(name).slice(0, 20)}.tn`
              : null,
          phone: `+216 ${rand(["20", "21", "22", "23", "24", "25", "26", "27", "28", "29"])} ${randInt(100, 999)} ${randInt(100, 999)}`,
          address: `${randInt(1, 120)} Rue ${rand(["Habib Bourguiba", "de la République", "7 Novembre", "Farhat Hached", "de Carthage", "Ibn Khaldoun"])}, ${city}`,
          taxId:
            type === ClientType.GMS || type === ClientType.WHOLESALER
              ? `${randInt(1000000, 9999999)}${rand(["A", "B", "D"])}/P/M/000`
              : null,
          assignedUserId: commercial.id,
          isActive: behavior !== "declining" || Math.random() > 0.3,
        },
      });
    }
    clients.push({
      id: client.id,
      name: client.name,
      behavior,
      baseOrderValue,
      baseFrequencyDays,
      commercialId: commercial.id,
    });
  }
  console.log(`   ✅ ${clients.length} clients tunisiens`);

  // ═══════════════════════════════════════════════════════════════════
  // 5. PROSPECTS
  // ═══════════════════════════════════════════════════════════════════
  console.log("🎯 Création des prospects...");
  const PROSPECT_SOURCES = [
    "Prospection terrain",
    "Salon HoReCa",
    "Recommandation client",
    "Appel entrant",
    "Salon professionnel Tunis",
    "Réseau social",
  ];
  const prospectStatuses = [
    ProspectStatus.NEW,
    ProspectStatus.CONTACTED,
    ProspectStatus.QUALIFIED,
    ProspectStatus.LOST,
  ];
  const prospectWeights = [0.35, 0.3, 0.25, 0.1];

  for (let i = 0; i < 24; i++) {
    const { region, city, lat, lon } = pickCity();
    const type = weightedChoice(
      [ClientType.B2B, ClientType.B2C, ClientType.OCCASIONAL],
      [0.5, 0.3, 0.2],
    );
    const name = businessName(type, city);
    const existing = await prisma.prospect.findFirst({ where: { name, city } });
    if (existing) continue;
    const commercial = rand(commercials);
    await prisma.prospect.create({
      data: {
        name,
        city,
        region,
        latitude: lat,
        longitude: lon,
        status: weightedChoice(prospectStatuses, prospectWeights),
        phone: `+216 ${rand(["20", "22", "23", "25"])} ${randInt(100, 999)} ${randInt(100, 999)}`,
        potentialValue: randFloat(300, 6000),
        source: rand(PROSPECT_SOURCES),
        assignedUserId: commercial.id,
        notes:
          Math.random() > 0.5
            ? `Contact initial via ${rand(PROSPECT_SOURCES).toLowerCase()}. À relancer.`
            : null,
      },
    });
  }
  console.log(`   ✅ 24 prospects`);

  // ═══════════════════════════════════════════════════════════════════
  // 6. HISTORIQUE DE COMMANDES (≈ 14 mois, avec saisonnalité)
  // ═══════════════════════════════════════════════════════════════════
  console.log(
    "🧾 Génération de l'historique de commandes (peut prendre quelques minutes)...",
  );

  function seasonalMultiplier(date: Date, touristic: boolean): number {
    const month = date.getMonth() + 1; // 1-12
    let mult = 1.0;
    if (month === 3 || month === 4) mult *= 1.45; // pic printanier (période Ramadan/Aïd approx.)
    if (touristic && [6, 7, 8, 9].includes(month)) mult *= 1.5; // saison touristique
    if (month === 9) mult *= 1.08; // rentrée
    if (month === 1) mult *= 0.85; // creux hivernal
    return mult;
  }

  const HISTORY_START = daysAgo(430); // ~14 mois
  const HISTORY_END = new Date();
  const yearCounters: Record<number, number> = {};

  function nextReference(orderDate: Date): string {
    const y = orderDate.getFullYear();
    yearCounters[y] = (yearCounters[y] ?? 0) + 1;
    return `CMD-${y}-${String(yearCounters[y]).padStart(5, "0")}`;
  }

  let totalOrders = 0,
    totalItems = 0;

  for (const client of clients) {
    let cur = new Date(HISTORY_START.getTime() + randInt(0, 20) * 86400000);
    let trendBoost = 0;
    let churnDate: Date | null = null;
    let firstSeen = HISTORY_START;

    if (client.behavior === "declining") churnDate = daysAgo(randInt(15, 200));
    if (client.behavior === "new") {
      firstSeen = daysAgo(randInt(30, 180));
      cur = new Date(firstSeen);
    }

    while (cur <= HISTORY_END) {
      if (churnDate && cur >= churnDate) break;
      if (cur < firstSeen) {
        cur = new Date(cur.getTime() + client.baseFrequencyDays * 86400000);
        continue;
      }

      if (client.behavior === "growing") trendBoost += 0.025;
      if (client.behavior === "sporadic" && Math.random() < 0.35) {
        cur = new Date(
          cur.getTime() +
            client.baseFrequencyDays * randFloat(1.5, 3) * 86400000,
        );
        continue;
      }

      const effFreq = Math.max(
        4,
        client.baseFrequencyDays * (1 - Math.min(trendBoost, 0.6)),
      );
      const jitter = randFloat(-0.3, 0.3) * effFreq;
      cur = new Date(cur.getTime() + Math.max(3, effFreq + jitter) * 86400000);
      if (cur > HISTORY_END) break;

      // Composition de la commande : 1 à 4 produits différents
      const nItems = randInt(1, 4);
      const chosenProducts = [...products]
        .sort(() => Math.random() - 0.5)
        .slice(0, nItems);
      const items = chosenProducts.map((p) => {
        const qty = randInt(3, 40);
        return {
          productId: p.id,
          quantity: qty,
          unitPrice: p.unitPrice,
          subtotal: Math.round(qty * p.unitPrice * 1000) / 1000,
        };
      });
      const totalAmount =
        Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 1000) / 1000;

      // Statut réaliste selon l'ancienneté de la commande
      const daysOld = Math.floor(
        (HISTORY_END.getTime() - cur.getTime()) / 86400000,
      );
      let status: OrderStatus;
      if (daysOld < 3)
        status = weightedChoice(
          [OrderStatus.DRAFT, OrderStatus.CONFIRMED, OrderStatus.SIGNED],
          [0.3, 0.4, 0.3],
        );
      else if (daysOld < 10)
        status = weightedChoice(
          [OrderStatus.CONFIRMED, OrderStatus.SIGNED, OrderStatus.DELIVERED],
          [0.15, 0.35, 0.5],
        );
      else
        status = weightedChoice(
          [OrderStatus.DELIVERED, OrderStatus.SIGNED, OrderStatus.CANCELLED],
          [0.78, 0.18, 0.04],
        );

      const order = await prisma.saleOrder.create({
        data: {
          reference: nextReference(cur),
          clientId: client.id,
          createdById: client.commercialId,
          status,
          totalAmount,
          createdAt: cur,
          updatedAt: cur,
          deliveryDate:
            status === OrderStatus.DELIVERED
              ? new Date(cur.getTime() + randInt(1, 4) * 86400000)
              : null,
          signedAt:
            status === OrderStatus.SIGNED || status === OrderStatus.DELIVERED
              ? new Date(cur.getTime() + randInt(0, 1) * 86400000)
              : null,
          items: { create: items },
        },
      });
      totalOrders++;
      totalItems += items.length;
    }
  }
  console.log(
    `   ✅ ${totalOrders} commandes générées (${totalItems} lignes de commande)`,
  );

  // ═══════════════════════════════════════════════════════════════════
  // 7. VISITES COMMERCIALES (historique + planning à venir)
  // ═══════════════════════════════════════════════════════════════════
  console.log("📅 Génération des visites commerciales...");

  const REPORT_TEMPLATES = [
    "Client satisfait de la gamme actuelle. Réassort standard effectué.",
    "Discussion sur les nouvelles saveurs épicées — intérêt confirmé pour un test en rayon.",
    "Négociation des conditions de livraison pour le mois prochain.",
    "Présentation du coffret prestige pour la saison des fêtes.",
    "Client en attente de rupture de stock côté fournisseur, relance prévue.",
    "Bon retour sur le Taralli Harissa, demande d'augmenter les quantités.",
    "Visite de courtoisie, pas de commande immédiate mais relation maintenue.",
    "Problème de livraison précédente réglé sur place, client rassuré.",
    "Nouveau point de vente à l'essai, quantités réduites pour tester la demande.",
  ];
  const NEXT_ACTION_TEMPLATES = [
    "Relancer dans 2 semaines pour le réassort",
    "Envoyer la nouvelle fiche produit par email",
    "Planifier une dégustation en magasin",
    "Confirmer la commande la semaine prochaine",
    "Vérifier le paiement de la facture précédente",
    null,
    null,
  ];

  let totalVisits = 0;
  let totalPlans = 0;
  for (const client of clients) {
    if (client.behavior === "declining" && Math.random() > 0.5) continue; // moins de visites pour ceux en déclin
    const nHistorical = randInt(2, 6);
    for (let i = 0; i < nHistorical; i++) {
      const scheduledAt = daysAgo(randInt(5, 400));
      const status = weightedChoice(
        [VisitStatus.COMPLETED, VisitStatus.CANCELLED, VisitStatus.NO_SHOW],
        [0.82, 0.1, 0.08],
      );
      const orderCreated =
        status === VisitStatus.COMPLETED && Math.random() < 0.5;
      // Chaque visite appartient obligatoirement à une tournée — on crée une mini-tournée historique par visite
      await prisma.visitPlan.create({
        data: {
          userId: client.commercialId,
          date: scheduledAt,
          status: "COMPLETED",
          title: `Tournée — ${client.name}`,
          visits: {
            create: [
              {
                clientId: client.id,
                userId: client.commercialId,
                order: 1,
                scheduledAt,
                status,
                startedAt:
                  status !== VisitStatus.CANCELLED ? scheduledAt : null,
                completedAt:
                  status === VisitStatus.COMPLETED
                    ? new Date(scheduledAt.getTime() + randInt(20, 60) * 60000)
                    : null,
                report:
                  status === VisitStatus.COMPLETED
                    ? rand(REPORT_TEMPLATES)
                    : null,
                nextAction:
                  status === VisitStatus.COMPLETED
                    ? rand(NEXT_ACTION_TEMPLATES)
                    : null,
                orderCreated,
                orderAmount: orderCreated
                  ? randFloat(
                      client.baseOrderValue * 0.7,
                      client.baseOrderValue * 1.3,
                    )
                  : null,
              },
            ],
          },
        },
      });
      totalVisits++;
    }
  }
  console.log(`   ✅ ${totalVisits} visites historiques`);

  // ═══════════════════════════════════════════════════════════════════
  // 8. TOURNÉES (assignations par commercial — quelques-unes NON optimisées)
  // ═══════════════════════════════════════════════════════════════════
  console.log("🗺️  Génération de tournées commerciales...");

  const clientsByCommercial: Record<string, SeedClient[]> = {};
  for (const c of clients) {
    (clientsByCommercial[c.commercialId] ??= []).push(c);
  }

  for (const commercial of commercials) {
    const myClients = clientsByCommercial[commercial.id] ?? [];
    if (myClients.length < 3) continue;

    // Une tournée assignée pour les prochains jours, avec 4 à 7 clients — laissée NON optimisée
    // volontairement, pour que la démonstration du bouton "Optimiser TSP" dans l'app produise un vrai résultat visible.
    const stopCount = Math.min(myClients.length, randInt(4, 7));
    const stops = [...myClients]
      .sort(() => Math.random() - 0.5)
      .slice(0, stopCount);
    const planDate = daysFromNow(randInt(1, 5));
    await prisma.visitPlan.create({
      data: {
        userId: commercial.id,
        date: planDate,
        status: "CONFIRMED",
        title: `Tournée ${commercial.zone ?? ""}`.trim(),
        visits: {
          create: stops.map((c, idx) => ({
            clientId: c.id,
            userId: commercial.id,
            order: idx + 1,
            scheduledAt: planDate,
            status: VisitStatus.PLANNED,
          })),
        },
      },
    });
    totalPlans++;

    // Une tournée déjà passée et marquée terminée (historique, déjà optimisée)
    if (myClients.length >= 3) {
      const pastStops = [...myClients]
        .sort(() => Math.random() - 0.5)
        .slice(0, randInt(3, 5));
      const pastDate = daysAgo(randInt(10, 60));
      await prisma.visitPlan.create({
        data: {
          userId: commercial.id,
          date: pastDate,
          status: "COMPLETED",
          isOptimized: true,
          totalDistance: randFloat(15, 85, 1),
          title: `Tournée ${commercial.zone ?? ""}`.trim(),
          visits: {
            create: pastStops.map((c, idx) => ({
              clientId: c.id,
              userId: commercial.id,
              order: idx + 1,
              distanceKm: randFloat(2, 20, 1),
              scheduledAt: pastDate,
              status: VisitStatus.COMPLETED,
              startedAt: pastDate,
              completedAt: new Date(
                pastDate.getTime() + randInt(20, 60) * 60000,
              ),
            })),
          },
        },
      });
      totalPlans++;
    }
  }
  console.log(`   ✅ ${totalPlans} tournées créées`);

  // ═══════════════════════════════════════════════════════════════════
  // RÉCAPITULATIF
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n🚀 Génération terminée !");
  console.log("─────────────────────────────────────────────────────────");
  console.log(
    `Utilisateurs   : ${1 + responsables.length + commercials.length + supportRoles.length}`,
  );
  console.log(`Clients        : ${clients.length}`);
  console.log(`Prospects      : 24`);
  console.log(`Produits       : ${products.length}`);
  console.log(`Commandes      : ${totalOrders} (${totalItems} lignes)`);
  console.log(`Visites        : ${totalVisits}`);
  console.log(`Tournées       : ${totalPlans}`);
  console.log("─────────────────────────────────────────────────────────");
  console.log("\n🔐 Connexion :");
  console.log("   Admin              : admin@gustoclub.tn / Admin@2024");
  console.log(
    "   Responsables & commerciaux : <prenom>.<nom>@gustoclub.tn / Gusto@2024",
  );
  console.log("   (ex: karim.bensalah@gustoclub.tn)");
  console.log(
    "\n👉 Étape suivante recommandée : recalculer les scores clients et",
  );
  console.log("   lancer une première analyse IA (voir le guide d'import).\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur pendant la génération :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
