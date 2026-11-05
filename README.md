# Maison Miro — boutique partagée

La boutique est servie par Node.js. Le serveur conserve les produits, images et réglages dans `data/store.json` et `uploads/`. Les changements sont communs à tous les visiteurs qui utilisent la même adresse de boutique.

## Démarrer en local

Installez Node.js 20 ou plus récent, puis démarrez le serveur avec un mot de passe administrateur d’au moins 12 caractères :

```sh
ADMIN_PASSWORD='choisir-un-mot-de-passe-long-et-unique' npm start
```

Ouvrez ensuite <http://localhost:3000>. Le bouton « Espace boutique » affiche la connexion privée. Utilisez le mot de passe défini dans `ADMIN_PASSWORD`.

## Mise en ligne

Déployez ce dossier sur un hébergeur qui exécute Node.js et conserve les fichiers écrits entre les redémarrages. Configurez `ADMIN_PASSWORD` dans les variables secrètes de l’hébergeur et utilisez HTTPS. Un hébergement statique seul ne peut pas partager les changements ni protéger le panneau. Les données à sauvegarder sont `data/store.json` et le dossier `uploads/`.

Le serveur n’utilise pas de dépendance npm externe. Pour chaque produit, le panneau permet d’ajouter plusieurs photos ; la première est utilisée comme couverture. Les images importées (PNG, JPEG, WebP ou GIF) sont limitées à 4 Mo chacune. Un clic sur une fiche ouvre sa galerie, sa description et le bouton de commande WhatsApp.
# ecome
