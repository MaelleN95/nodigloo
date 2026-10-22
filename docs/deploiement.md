# Déploiement public

Le frontend est prévu sur Vercel et le backend sur Render, sans domaine acheté :

- Vercel fournit une adresse HTTPS en `.vercel.app`.
- Render fournit une adresse HTTPS en `.onrender.com` et accepte les connexions Socket.IO.
- Les salles restent en mémoire dans une seule instance du backend.

## Backend sur Render

Le fichier [render.yaml](../render.yaml) décrit un service web Docker gratuit. Il réutilise le [Dockerfile du serveur](../apps/server/Dockerfile), avec la racine du dépôt comme contexte de build.

1. Dans Render, choisir **New > Blueprint**, puis sélectionner le dépôt et la branche à déployer.
2. Vérifier que Render utilise `render.yaml` et propose bien le plan **Free**.
3. Fournir `CLIENT_ORIGINS` : l'adresse de production stable Vercel, sans chemin ni barre oblique finale. Le champ est demandé pendant la création, car cette valeur dépend du projet.
4. Créer le service et attendre que le déploiement soit sain.
5. Noter son adresse publique HTTPS en `.onrender.com`. Ouvrir cette adresse suivie de `/health` : elle doit répondre `{"status":"ok"}`.
6. Utiliser cette adresse comme `VITE_SERVER_URL` sur Vercel.

Si l'adresse Vercel n'existe pas encore, créer d'abord le projet Vercel pour obtenir son adresse. Le premier build peut afficher le site sans connexion fonctionnelle au jeu. Après création de Render, renseigner `VITE_SERVER_URL` et redéployer le frontend avant de le partager.

Ne pas renseigner de commande de démarrage personnalisée : le Dockerfile la fournit déjà. Ne pas fixer `PORT` à 3001 : le serveur utilise le port fourni par Render.

Les déploiements automatiques du backend sont désactivés (`autoDeployTrigger: off`). Un déploiement manuel depuis Render évite de couper une partie en cours à chaque commit poussé. Ne lancer qu'une instance : les salles ne sont pas partagées entre plusieurs serveurs.

### IP derrière le proxy : contrôle restant

Le limiteur utilise actuellement `socket.handshake.address`, l'adresse de la connexion directe. Sur Render, cette adresse peut être celle du proxy : plusieurs joueurs risquent alors de partager le même quota.

Avant une ouverture large, vérifier le comportement réel du proxy et adapter l'identification des clients avec une règle de confiance explicite. Ne pas prendre arbitrairement la première valeur de `X-Forwarded-For` : une valeur fournie par le client ne doit pas permettre de contourner le quota.

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
- Vérifier l'identification des IP derrière le proxy et le quota de tentatives de plusieurs joueurs.

Le tag `v1.0.0` sera proposé après ces vérifications. La configuration locale Docker reste indépendante de ces hébergements.

## Références

- [Vite sur Vercel, notamment les routes SPA](https://vercel.com/docs/frameworks/frontend/vite)
- [Limites des services gratuits Render](https://render.com/docs/free)
- [WebSocket sur Render](https://render.com/docs/websocket)
- [Configuration des Blueprints Render](https://render.com/docs/blueprint-spec)
