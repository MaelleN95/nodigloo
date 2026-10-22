# Déploiement public

Le frontend est prévu sur Vercel et le backend sur Render, sans domaine acheté :

- Vercel fournit une adresse HTTPS en `.vercel.app`.
- Render fournit une adresse HTTPS en `.onrender.com` et accepte les connexions Socket.IO.
- Les salles restent en mémoire dans une seule instance du backend.

## Frontend sur Vercel

1. Importer le dépôt Git dans Vercel.
2. Garder la racine du dépôt comme **Root Directory**, pas `apps/client`. Le build a besoin du workspace `packages/shared` et du fichier de verrouillage à la racine.
3. Choisir une version Node.js compatible avec le projet (22 LTS, par exemple).
4. Les réglages sont dans [vercel.json](../vercel.json) :
   - installation : `npm ci` ;
   - build : paquet partagé, puis client ;
   - fichiers publiés : `apps/client/dist` ;
   - repli vers `index.html` pour les routes React.
5. Ajouter `VITE_SERVER_URL` dans les variables de l'environnement **Production**, avec l'URL HTTPS réelle du service Render, sans chemin ni port local.
6. Déployer le frontend une fois le backend prêt. Noter l'adresse de production stable attribuée par Vercel.
7. Configurer `CLIENT_ORIGINS` sur Render avec cette adresse exacte, sans chemin ni barre oblique finale.

`VITE_SERVER_URL` est intégrée aux fichiers JavaScript pendant le build. Modifier sa valeur impose un nouveau déploiement du frontend. Ce n'est pas un secret : le navigateur doit connaître cette adresse.

Ne pas autoriser toutes les origines en ajoutant un joker CORS. Les adresses temporaires des previews Vercel ne sont pas autorisées automatiquement : le premier parcours public se teste sur l'adresse de production stable.

Sans `VITE_SERVER_URL`, le client utilise `http://localhost:3001`, ce qui ne convient pas à un site public.

## Limites de Render gratuit

- Après 15 minutes sans trafic entrant, le service peut se mettre en veille.
- Son réveil peut prendre environ une minute. Le client attend actuellement 10 secondes pour une connexion : une première tentative peut échouer pendant le réveil. Attendre que le backend réponde sur `/health`, puis réessayer.
- Chaque redémarrage, mise en veille ou nouveau déploiement perd les salles et les scores.
- Le quota annoncé est de 750 heures gratuites par mois et par workspace, partagé entre ses services gratuits. D'autres quotas s'appliquent aux builds et au trafic.
- Cette offre convient à une démonstration ou à un projet personnel, pas à une disponibilité garantie.

## Vérifications après publication

- Le backend répond sur son URL HTTPS suivie de `/health`.
- Le frontend utilise l'adresse Render, jamais `localhost`.
- Deux joueurs peuvent créer et rejoindre une salle, jouer cinq questions et voir le classement.
- Recharger une route `/room/...` ne provoque pas de page 404.
- Les fichiers du logo et du favicon sont servis normalement.
- Tester une reconnexion et le premier accès après une période d'inactivité.

Le tag `v1.0.0` sera proposé après ces vérifications. La configuration locale Docker reste indépendante de ces hébergements.

## Références

- [Vite sur Vercel, notamment les routes SPA](https://vercel.com/docs/frameworks/frontend/vite)
- [Limites des services gratuits Render](https://render.com/docs/free)
- [WebSocket sur Render](https://render.com/docs/websocket)
