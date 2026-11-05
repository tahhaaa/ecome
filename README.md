# Maison Miro — boutique en ligne

Boutique statique et fonctions serveur Vercel. Les produits, les textes et les réglages du site sont enregistrés dans Supabase. Les photos téléversées par l’administrateur sont stockées dans Supabase Storage. Les commandes passent par WhatsApp au numéro configuré dans `app.js`.

## Déployer sur Vercel et Supabase

### 1. Créer le projet Supabase

1. Créez un projet Supabase.
2. Dans **SQL Editor**, ouvrez `supabase/migrations/0001_init.sql` depuis ce dépôt, copiez son contenu et exécutez-le.
3. Dans **Project Settings → API**, copiez l’URL du projet et la clé `service_role` (ou la clé secrète du serveur). Ne la mettez jamais dans le code du navigateur.

Le script SQL crée les tables nécessaires et le compartiment public `product-images`. Les photos de la boutique sont publiques ; la clé permettant de les téléverser reste privée côté serveur.

### 2. Importer le dépôt dans Vercel

1. Connectez-vous à Vercel et choisissez **Add New → Project**.
2. Importez le dépôt GitHub `tahhaaa/ecome`, branche `main`.
3. Gardez le répertoire racine `/`. Il n’y a pas de commande de build à saisir : Vercel publie les fichiers du site et détecte les fonctions dans `api/`.
4. Lancez l’importation.

### 3. Ajouter les variables secrètes

Dans Vercel, ouvrez **Project → Settings → Environment Variables** et ajoutez ces variables pour **Production** (et Preview si vous souhaitez tester les aperçus) :

| Nom | Valeur |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé secrète serveur Supabase, jamais la clé publique `anon` |
| `SUPABASE_BUCKET` | `product-images` |
| `ADMIN_PASSWORD` | Mot de passe admin unique, au moins 12 caractères |
| `SESSION_SECRET` | Secret aléatoire long, par exemple `openssl rand -hex 32` dans un terminal |

Après avoir enregistré les variables, ouvrez **Deployments** et redéployez le dernier déploiement.

### 4. Vérifier la boutique

Ouvrez l’adresse `*.vercel.app`, puis **Espace boutique**. Connectez-vous avec `ADMIN_PASSWORD`, ajoutez un produit et une photo, puis vérifiez que le produit apparaît aussi dans une fenêtre privée. La photo importée est limitée à 3 Mo. Les photos déjà hébergées par une URL peuvent être ajoutées sans téléversement.

## Développement local

Le serveur local d’origine est lancé avec Node.js 20 ou plus récent :

```sh
ADMIN_PASSWORD='un-mot-de-passe-local' npm start
```

Le serveur local utilise `data/store.json` et `uploads/`. Il est indépendant de la base Supabase déployée.
