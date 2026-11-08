# Crooza — boutique Next.js

Boutique en français construite avec Next.js App Router. Le catalogue, les textes, les photos et les commandes sont partagés avec tous les visiteurs via Supabase. La commande se passe directement sur le site sans adresse : Rabat et Témara coûtent 25 DH de livraison, les autres villes 35 DH. L’administration privée est sur `/admin`.

## Démarrer en local

Node.js 20.9 ou plus récent est requis.

```sh
npm install
npm run dev
```

Ouvrez <http://localhost:3000>.

## Configurer Supabase

1. Créez un projet Supabase.
2. Dans **SQL Editor**, exécutez les migrations dans l’ordre : `0001_init.sql`, `0002_orders_and_push.sql`, `0003_analytics.sql` pour les statistiques, `0004_order_tracking.sql` pour les liens privés de suivi, puis `0005_inventory_finance_and_order_management.sql` pour le stock, les frais et la suppression de commandes.
3. Copiez l’URL du projet et la clé **Secret** (`sb_secret_…`) depuis **Project Settings → API Keys**. Cette clé contourne les règles RLS : elle doit rester dans les variables d’environnement, jamais dans un composant client. L’ancienne clé `service_role` reste acceptée comme solution de compatibilité.

## Déployer sur Vercel

1. Importez le dépôt GitHub `tahhaaa/ecome` dans Vercel.
2. Vercel détecte Next.js automatiquement. Laissez la commande de build par défaut (`next build`) et la sortie par défaut.
3. Ajoutez ces variables d’environnement pour Production :

| Variable | Valeur |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SECRET_KEY` | Clé Secret serveur Supabase (`sb_secret_…`) |
| `SUPABASE_BUCKET` | `product-images` |
| `ADMIN_PASSWORD` | Mot de passe unique de 12 caractères minimum |
| `SESSION_SECRET` | Secret aléatoire généré avec `openssl rand -hex 32` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Clé publique générée par `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Clé privée du même générateur, à garder secrète |
| `VAPID_SUBJECT` | Adresse de contact, par exemple `mailto:vous@example.com` |

4. Redéployez le projet. Ouvrez `https://votre-domaine/admin`, connectez-vous avec le mot de passe admin, puis activez les notifications sur votre appareil.

Les images importées depuis le panneau admin peuvent peser jusqu’à 3 Mo chacune. Supabase Storage utilise un compartiment public pour afficher les photos ; seul le serveur possède les droits d’écriture.

Les notifications utilisent le Push API du navigateur (HTTPS requis). Sur iPhone, ajoutez d’abord le site à l’écran d’accueil et autorisez les notifications pour l’application web.

Dans **Modifier la boutique**, les tailles sont séparées par des virgules. Le stock par taille peut être saisi ligne par ligne au format `36 : 2`; ces quantités sont réservées atomiquement lorsqu’une commande arrive. Le prix d’achat reste visible uniquement dans l’administration. Les frais ajoutés à une commande sont des coûts internes et diminuent la marge estimée, sans modifier le montant annoncé au client.
