# Guide d'import des données réalistes

## Ce que contient ce jeu de données

Contrairement au seed minimal (`prisma/seed.ts`, 5 clients, quelques
produits — juste de quoi tester rapidement), `prisma/seed-realistic.ts`
génère un jeu de données qui **ressemble à une vraie entreprise en
activité** :

| Élément | Quantité | Détail |
|---|---|---|
| Utilisateurs | 15 | 1 admin, 2 responsables commerciaux, 7 commerciaux, 5 support (stock, comptabilité, production) |
| Catégories produits | 4 | Classiques, Épicés, Premium, Coffrets |
| Produits | 14 | Avec stock initial réaliste par produit |
| Matières premières | 9 | Avec fournisseurs tunisiens et niveaux de stock |
| Clients | 85 | Répartis dans 13 gouvernorats, GPS réels, types variés (GMS, grossistes, B2B, B2C, occasionnels) |
| Prospects | 24 | Statuts variés (nouveau, contacté, qualifié, perdu) |
| Commandes | ~600-900 (variable, dépend de l'aléatoire) | Étalées sur ~14 mois, avec saisonnalité (pic printanier, pic estival zones touristiques) |
| Visites commerciales | ~250-350 | Historique + quelques-unes planifiées dans les 2 prochaines semaines |
| Tournées | ~10-12 | Certaines volontairement **non optimisées** pour tester le bouton TSP en conditions réelles |

Aucun nom "Client Test", "Demo Company" ou email `test@test.com` — tout
est cohérent avec le contexte tunisien du projet (noms d'entreprises,
adresses, matricules fiscaux, numéros de téléphone au format `+216`).

⚠️ **Point de transparence** : ce script n'a pas pu être exécuté en
conditions réelles dans mon environnement de génération (pas d'accès
au moteur Prisma depuis ce bac à sable). Il a été vérifié
syntaxiquement (compilation TypeScript propre) et chaque champ/enum a
été recoupé manuellement avec `schema.prisma`. Suis les étapes
ci-dessous et si une erreur apparaît malgré tout au premier lancement,
elle sera facile à localiser (le script log sa progression étape par
étape).

---

## Étape par étape

### 1. Préparer la base de données

```bash
cd backend
cp .env.example .env
# Éditer .env : DATABASE_URL doit pointer vers une base PostgreSQL vide
```

```bash
npm install
npx prisma migrate dev --name init
```

Cette commande crée toutes les tables à partir de `schema.prisma`. Si
c'est la première fois, elle va aussi générer le client Prisma
(`@prisma/client`) — nécessaire pour que `seed-realistic.ts` puisse
importer les types (`SystemRole`, `ClientType`, etc.).

Si tu as déjà une base avec des données et veux repartir propre :
```bash
npx prisma migrate reset   # ⚠️ supprime TOUTES les données existantes
```

### 2. Lancer le script de génération

```bash
npx ts-node prisma/seed-realistic.ts
```

Ça prend **2 à 5 minutes** selon ta machine (des centaines de
commandes et visites sont créées une par une, avec leurs lignes de
détail). Le script affiche sa progression :

```
🌱 Génération du jeu de données réaliste — SmartConnect Gusto Club
👤 Création des utilisateurs...
   ✅ 15 utilisateurs créés
🍪 Création du catalogue produits...
   ✅ 4 catégories, 14 produits
🌾 Création des matières premières...
   ✅ 9 matières premières
🏪 Création des clients...
   ✅ 85 clients tunisiens
🎯 Création des prospects...
   ✅ 24 prospects
🧾 Génération de l'historique de commandes...
   ✅ 743 commandes générées (1521 lignes de commande)
📅 Génération des visites commerciales...
   ✅ 289 visites (historique + planning à venir)
🗺️  Génération de tournées commerciales...
   ✅ 11 tournées créées

🚀 Génération terminée !
```

(Les chiffres exacts varient à chaque exécution — c'est normal,
beaucoup de générateurs aléatoires sont utilisés pour la variété.)

### 3. Se connecter

```
Admin              : admin@gustoclub.tn / Admin@2024
Commerciaux/Resp.  : <prenom>.<nom>@gustoclub.tn / Gusto@2024
                     (ex: karim.bensalah@gustoclub.tn,
                          yassine.chaabane@gustoclub.tn)
```

La liste complète des emails générés est visible directement dans
`prisma/seed-realistic.ts` (tableaux `respCommercialData`,
`commercialData`, `supportRoles`), ou via une requête SQL :
```sql
SELECT email, "firstName", "lastName", role FROM users ORDER BY role;
```

### 4. Compléter avec les scores clients et l'analyse IA (recommandé)

Le script ne calcule pas les scores clients (inactivité/potentiel) ni
les alertes IA — ces calculs appartiennent à la logique applicative,
pas au seed. Deux façons de les déclencher :

**Option A — depuis l'interface** : connecte-toi en Admin, va sur la
page "Intelligence Artificielle", clique sur "Recalculer scores" puis
"Lancer l'analyse IA" (le microservice Python doit être démarré, voir
`ai-service/README.md`).

**Option B — en ligne de commande** (backend démarré sur le port
3000) :
```bash
# Se connecter pour récupérer un token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gustoclub.tn","password":"Admin@2024"}' | jq -r .token)

# Recalculer les scores de tous les clients
curl -s -X POST http://localhost:3000/api/client-scores/recalculate \
  -H "Authorization: Bearer $TOKEN"

# Lancer l'analyse IA complète (nécessite ai-service démarré sur :8000)
curl -s -X POST http://localhost:3000/api/ai-insights/analyze \
  -H "Authorization: Bearer $TOKEN"
```

### 5. (Optionnel) Utiliser ces mêmes données pour entraîner les modèles IA

Le jeu de données de `ai-service/data/` (généré par
`generate_data.py`) est **indépendant** de celui-ci — il sert
uniquement à l'entraînement des modèles Python, pas à peupler
l'application. Si tu veux que les modèles soient entraînés sur des
données cohérentes avec ce qui est maintenant dans PostgreSQL, utilise
`ai-service/data/export_from_db.py` (voir `ai-service/README.md`, §7
"Passage en production") une fois que le seed ci-dessus est en base :

```bash
cd ai-service
export DATABASE_URL="<la même URL que backend/.env>"
python3 data/export_from_db.py
bash retrain_all.sh   # en ayant commenté la ligne generate_data.py dedans
```

---

## Pourquoi ce jeu de données "a l'air vrai"

Quelques détails de conception à connaître (utile aussi en
soutenance, voir `DOSSIER_SOUTENANCE.md`) :

- **Comportements clients variés** : chaque client a un profil caché
  (`growing`, `stable`, `declining`, `sporadic`, `new`) qui influence
  la fréquence et l'évolution de ses commandes dans le temps — pas un
  historique uniforme et artificiel.
- **Saisonnalité** : pic de commandes en mars-avril (période
  Ramadan/Aïd approximative), pic estival pour les clients situés dans
  les gouvernorats touristiques (Nabeul, Sousse, Monastir, Médenine).
- **Statuts de commande cohérents avec la date** : une commande vieille
  de 6 mois a très peu de chances d'être encore en `DRAFT` — le script
  pondère les statuts selon l'ancienneté de la commande.
- **Certaines tournées volontairement non optimisées** : pour que la
  démonstration du bouton "Optimiser (TSP)" dans l'application
  produise un vrai changement visible, pas un no-op sur des données
  déjà parfaites.
- **Cohérence des prix** : le prix unitaire d'une commande est celui
  du produit au catalogue, mais stocké indépendamment sur la ligne de
  commande (`SaleOrderItem.unitPrice`) — comme le ferait une vraie
  facturation (voir `DOSSIER_SOUTENANCE.md` §3.2 pour la justification
  de ce choix de modélisation).
