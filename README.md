# Maison Miro — Next.js

Boutique en français construite avec Next.js App Router. Le catalogue s’affiche côté serveur. Le panneau admin permet de modifier les produits, photos, textes et couleurs ; les données et images sont partagées avec tous les visiteurs via Supabase. Les boutons de commande ouvrent WhatsApp au `+212 622 222 430`.

## Démarrer en local

Node.js 20.9 ou plus récent est requis.

```sh
npm install
npm run dev
```

Ouvrez <http://localhost:3000>.

## Configurer Supabase

1. Créez un projet Supabase.
2. Dans **SQL Editor**, exécutez `supabase/migrations/0001_init.sql`.
3. Copiez l’URL du projet et la clé serveur `service_role` depuis **Project Settings → API**. La clé serveur contourne les règles RLS : elle doit rester dans les variables d’environnement, jamais dans un composant client.

## Déployer sur Vercel

1. Importez le dépôt GitHub `tahhaaa/ecome` dans Vercel.
2. Vercel détecte Next.js automatiquement. Laissez la commande de build par défaut (`next build`) et la sortie par défaut.
3. Ajoutez ces variables d’environnement pour Production :

| Variable | Valeur |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé serveur secrète Supabase |
| `SUPABASE_BUCKET` | `product-images` |
| `ADMIN_PASSWORD` | Mot de passe unique de 12 caractères minimum |
| `SESSION_SECRET` | Secret aléatoire généré avec `openssl rand -hex 32` |

4. Redéployez le projet. Ouvrez ensuite son adresse `*.vercel.app` et connectez-vous avec le mot de passe admin.

Les images importées depuis le panneau admin peuvent peser jusqu’à 3 Mo chacune. Supabase Storage utilise un compartiment public pour afficher les photos ; seul le serveur possède les droits d’écriture.
