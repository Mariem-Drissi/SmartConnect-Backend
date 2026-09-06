import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SmartConnect Gusto Club (Tunisia)...\n');

  // Admin
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@gustoclub.tn';
  if (!await prisma.user.findUnique({ where: { email: adminEmail } })) {
    await prisma.user.create({ data: { email: adminEmail, password: await bcrypt.hash('Admin@2024', 10), firstName: 'Administrateur', lastName: 'Gusto', role: 'ADMIN', phone: '+216 71 000 000' } });
    console.log(`✅ Admin: ${adminEmail} / Admin@2024`);
  }

  // Responsable Commercial
  let resp = await prisma.user.findUnique({ where: { email: 'resp.commercial@gustoclub.tn' } });
  if (!resp) {
    resp = await prisma.user.create({ data: { email: 'resp.commercial@gustoclub.tn', password: await bcrypt.hash('Resp@2024', 10), firstName: 'Karim', lastName: 'Ben Salah', role: 'RESPONSABLE_COMMERCIAL', phone: '+216 20 100 200', zone: 'Grand Tunis' } });
    console.log('✅ Resp. Commercial: resp.commercial@gustoclub.tn / Resp@2024');
  }

  // Commercials
  const commercials = [
    { email: 'ahmed.tlili@gustoclub.tn', firstName: 'Ahmed', lastName: 'Tlili', zone: 'Tunis Nord', phone: '+216 22 111 001' },
    { email: 'sonia.mejri@gustoclub.tn', firstName: 'Sonia', lastName: 'Mejri', zone: 'Sfax', phone: '+216 22 222 002' },
    { email: 'yassine.chaabane@gustoclub.tn', firstName: 'Yassine', lastName: 'Chaabane', zone: 'Sousse', phone: '+216 22 333 003' },
  ];
  const commercialUsers = [];
  for (const c of commercials) {
    let u = await prisma.user.findUnique({ where: { email: c.email } });
    if (!u) u = await prisma.user.create({ data: { ...c, password: await bcrypt.hash('Commercial@2024', 10), role: 'COMMERCIAL' } });
    commercialUsers.push(u);
  }
  console.log(`✅ ${commercials.length} commerciaux créés`);

  // Product Categories
  const cats = [
    { name: 'Taralli Classiques', color: '#E7C27D' },
    { name: 'Taralli Épicés', color: '#D4A24E' },
    { name: 'Taralli Premium', color: '#7FE0CB' },
    { name: 'Emballages Cadeaux', color: '#4EC9B0' },
  ];
  const catMap: Record<string, string> = {};
  for (const cat of cats) {
    const c = await prisma.productCategory.upsert({ where: { name: cat.name }, update: {}, create: cat });
    catMap[cat.name] = c.id;
  }

  // Products (Tunisian context)
  const products = [
    { name: 'Taralli Nature 250g', flavor: 'nature', sku: 'TAR-NAT-250', weightGrams: 250, unitPrice: 4.500, costPrice: 1.800, categoryId: catMap['Taralli Classiques'] },
    { name: 'Taralli Finocchio 250g', flavor: 'finocchio', sku: 'TAR-FIN-250', weightGrams: 250, unitPrice: 4.900, costPrice: 2.000, categoryId: catMap['Taralli Classiques'] },
    { name: 'Taralli Harissa 250g', flavor: 'harissa', sku: 'TAR-HAR-250', weightGrams: 250, unitPrice: 5.200, costPrice: 2.100, categoryId: catMap['Taralli Épicés'] },
    { name: 'Taralli Zaatar 250g', flavor: 'zaatar', sku: 'TAR-ZAA-250', weightGrams: 250, unitPrice: 5.200, costPrice: 2.100, categoryId: catMap['Taralli Épicés'] },
    { name: 'Taralli Cumin 250g', flavor: 'cumin', sku: 'TAR-CUM-250', weightGrams: 250, unitPrice: 5.000, costPrice: 2.000, categoryId: catMap['Taralli Épicés'] },
    { name: 'Taralli Olive 500g', flavor: 'olive', sku: 'TAR-OLI-500', weightGrams: 500, unitPrice: 9.800, costPrice: 3.900, categoryId: catMap['Taralli Premium'] },
    { name: 'Taralli Mix Premium 500g', flavor: 'mix', sku: 'TAR-MIX-500', weightGrams: 500, unitPrice: 10.500, costPrice: 4.200, categoryId: catMap['Taralli Premium'] },
    { name: 'Coffret Cadeau 6 saveurs', flavor: 'mix', sku: 'TAR-GIFT-6', weightGrams: 1500, unitPrice: 28.000, costPrice: 11.000, categoryId: catMap['Emballages Cadeaux'] },
  ];
  const prodRecords: { id: string }[] = [];
  for (const p of products) {
    const prod = await prisma.product.upsert({ where: { sku: p.sku }, update: {}, create: { ...p, description: `Taralli artisanal ${p.flavor} — Recette Gusto Club` } });
    await prisma.productStock.upsert({ where: { productId: prod.id }, update: {}, create: { productId: prod.id, quantity: Math.floor(Math.random() * 400) + 100, minThreshold: 50 } });
    prodRecords.push(prod);
  }
  console.log(`✅ ${products.length} produits`);

  // Stock assigné à chaque commercial (van / tournée)
  for (const u of commercialUsers) {
    for (const prod of prodRecords) {
      const qty = Math.floor(Math.random() * 60) + 20;
      await prisma.commercialStock.upsert({
        where: { userId_productId: { userId: u.id, productId: prod.id } },
        update: {},
        create: { userId: u.id, productId: prod.id, quantity: qty, minThreshold: 15 },
      });
    }
  }
  console.log(`✅ Stock assigné pour ${commercialUsers.length} commerciaux`);

  // Clients (Tunisian businesses)
  const clients = [
    { name: 'Carrefour Tunis City', email: 'achat@carrefour.tn', phone: '+216 71 800 001', city: 'Tunis', region: 'Tunis', address: 'Avenue Habib Bourguiba, Tunis', latitude: 36.8190, longitude: 10.1658, clientType: 'GMS', assignedUserId: commercialUsers[0].id },
    { name: 'Monoprix Les Berges du Lac', email: 'achat@monoprix.tn', phone: '+216 71 800 002', city: 'Tunis', region: 'Tunis', address: 'Les Berges du Lac II, Tunis', latitude: 36.8360, longitude: 10.2360, clientType: 'GMS', assignedUserId: commercialUsers[0].id },
    { name: 'Magasin Général Sousse', email: 'direction@mg-sousse.tn', phone: '+216 73 200 001', city: 'Sousse', region: 'Sousse', address: 'Rue Habib Thameur, Sousse', latitude: 35.8254, longitude: 10.6360, clientType: 'GMS', assignedUserId: commercialUsers[2].id },
    { name: 'Grossiste Ben Youssef', email: 'commande@benyoussef.tn', phone: '+216 71 500 003', city: 'Tunis', region: 'Tunis', address: 'Marché de Gros, La Charguia', latitude: 36.8501, longitude: 10.1400, clientType: 'WHOLESALER', assignedUserId: commercialUsers[0].id },
    { name: 'Épicerie Fine Carthage', email: 'contact@epicerie-carthage.tn', phone: '+216 71 730 001', city: 'Carthage', region: 'Tunis', address: '15 Rue de Carthage, Carthage', latitude: 36.8586, longitude: 10.3289, clientType: 'B2C', assignedUserId: commercialUsers[0].id },
    { name: 'Hotel Hasdrubal Hammamet', email: 'food@hasdrubal.tn', phone: '+216 72 280 001', city: 'Hammamet', region: 'Nabeul', address: 'Zone Touristique, Hammamet', latitude: 36.3990, longitude: 10.5450, clientType: 'B2B', assignedUserId: commercialUsers[2].id },
    { name: 'Maison Sfaxienne des Spécialités', email: 'commande@mss.tn', phone: '+216 74 200 001', city: 'Sfax', region: 'Sfax', address: 'Médina de Sfax, Sfax', latitude: 34.7406, longitude: 10.7601, clientType: 'B2C', assignedUserId: commercialUsers[1].id },
    { name: 'Resto La Marsa', email: 'achat@lamarsa-resto.tn', phone: '+216 71 745 001', city: 'La Marsa', region: 'Tunis', address: 'Avenue de la République, La Marsa', latitude: 36.8778, longitude: 10.3247, clientType: 'B2B', assignedUserId: commercialUsers[0].id },
    { name: 'Coopérative Nabeul', email: 'coop@nabeul.tn', phone: '+216 72 220 001', city: 'Nabeul', region: 'Nabeul', address: 'Avenue Habib Bourguiba, Nabeul', latitude: 36.4565, longitude: 10.7355, clientType: 'WHOLESALER', assignedUserId: commercialUsers[2].id },
    { name: 'Librairie & Snack Sidi Bou Saïd', email: 'contact@sidibousaid-shop.tn', phone: '+216 71 729 001', city: 'Sidi Bou Saïd', region: 'Tunis', address: 'Rue Habib Thameur, Sidi Bou Saïd', latitude: 36.8698, longitude: 10.3415, clientType: 'OCCASIONAL', assignedUserId: commercialUsers[0].id },
  ];
  for (const c of clients) {
    const ex = await prisma.client.findFirst({ where: { name: c.name } });
    if (!ex) await prisma.client.create({ data: c as any });
  }
  console.log(`✅ ${clients.length} clients tunisiens`);

  // Prospects
  const prospects = [
    { name: 'Grand Hôtel Djerba', phone: '+216 75 650 001', city: 'Djerba', region: 'Médenine', address: 'Zone Touristique, Djerba', latitude: 33.8735, longitude: 10.8460, status: 'CONTACTED', potentialValue: 5000, source: 'Salon HoReCa', assignedUserId: commercialUsers[1].id, notes: 'Intéressé par des livraisons hebdomadaires' },
    { name: 'Supérette Mahdia Center', phone: '+216 73 680 001', city: 'Mahdia', region: 'Mahdia', status: 'NEW', potentialValue: 2000, source: 'Prospection terrain', assignedUserId: commercialUsers[2].id },
    { name: 'Épicerie El Kef Gourmet', phone: '+216 78 220 001', city: 'Le Kef', region: 'Le Kef', status: 'QUALIFIED', potentialValue: 1500, source: 'Recommandation client', assignedUserId: commercialUsers[1].id, notes: 'Budget confirmé, en attente de dégustation' },
  ];
  for (const p of prospects) {
    const ex = await prisma.prospect.findFirst({ where: { name: p.name } });
    if (!ex) await prisma.prospect.create({ data: p as any });
  }
  console.log(`✅ ${prospects.length} prospects`);

  console.log('\n🚀 Seed terminé !');
  console.log('─────────────────────────────────────────────────────');
  console.log('Admin             : admin@gustoclub.tn / Admin@2024');
  console.log('Resp. Commercial  : resp.commercial@gustoclub.tn / Resp@2024');
  console.log('Commercial 1      : ahmed.tlili@gustoclub.tn / Commercial@2024');
  console.log('Commercial 2      : sonia.mejri@gustoclub.tn / Commercial@2024');
  console.log('Commercial 3      : yassine.chaabane@gustoclub.tn / Commercial@2024');
  console.log('─────────────────────────────────────────────────────\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
