# Nodigloo

Plateforme web de mini-jeux multijoueurs en temps réel, jouable en salle, sans compte ni persistance. La V1 propose un quiz de culture générale ; la V2 ajoute des réglages de partie et un jeu de réaction.

## Périmètre V1

- 2 à 8 joueurs par salle, avec pseudonyme temporaire et code de salle partageable.
- L'hôte est le seul à pouvoir lancer une partie et à changer ses réglages.
- Une partie comporte de 1 à 10 manches, 5 par défaut, choisies par l'hôte dans la salle d'attente. Au quiz, une manche = une question, avec 4 choix et une limite de 20 secondes.
- Le serveur contrôle le temps, les réponses et les scores : 100 points par bonne réponse, aucun bonus de rapidité.
- Une réponse au plus par joueur et par question; les réponses tardives ou invalides sont refusées.
- La reconnexion conserve l'identité logique du joueur pendant un délai de grâce de 60 secondes.
- Le classement final est calculé côté serveur; les égalités partagent le rang.
- Les salles et les scores restent en mémoire et sont perdus au redémarrage.

Le périmètre détaillé et les exclusions sont dans [docs/backlog-v1.md](docs/backlog-v1.md). Les jeux de rapidité, dessin, comptes, base de données et publication publique ne bloquent pas la V1.

## Ajouts de la V2

- L'hôte choisit le jeu dans la salle d'attente : quiz ou réaction.
- Jeu de réaction : la zone est ambre, puis passe au vert après 2 à 6 secondes tirées par le serveur. Il faut alors appuyer au plus vite, avec soit espace, soit un clic soit un clic tactile sur mobile.
- Le temps est mesuré sur l'appareil du joueur, pour ne pas compter la latence du réseau. L'heure du vert est convertie avec le décalage d'horloge mesuré à chaque connexion au serveur (`clock:ping`).
- Barème : 1000 points jusqu'à 150 ms, puis une baisse régulière jusqu'à 0 point à une seconde.
- Un appui avant le vert, ou en moins de 100 ms, compte comme faux départ et ne rapporte rien. Sans appui dans les 3 secondes après le vert, le joueur n'a pas de point.
- La manche se termine dès que tous les joueurs connectés ont appuyé. Les temps restent affichés 4 secondes avant la manche suivante.

Les règles de travail (fonctionnalités, commits) sont décrites dans [CONTRIBUTING.md](CONTRIBUTING.md).

## Prérequis

- Git
- Node.js 20 ou supérieur et npm
- Docker Desktop avec Docker Compose

## Démarrage local avec Docker

1. Copier `.env.example` vers `.env` si des ports ou origines différents sont nécessaires.
2. Construire et démarrer les services :

   ```sh
   docker compose up --build
   ```

3. Ouvrir le client à [http://localhost:8080](http://localhost:8080) et vérifier l'API à [http://localhost:3001/health](http://localhost:3001/health).

## Développer le client avec rechargement automatique

Pour voir chaque modification du front sans reconstruire l'image, démarrer avec le fichier de développement :

```sh
docker compose -f compose.yaml -f compose.dev.yaml up -d
```

Le site reste sur [http://localhost:8080](http://localhost:8080), mais il est servi par Vite et se met à jour à chaque sauvegarde. Le premier démarrage installe les dépendances et prend quelques minutes. Pour revenir à la version construite, utiliser `docker compose up -d --build`.

Attention, seul le client se recharge tout seul. Le serveur reste l'image construite au démarrage : après une modification dans `apps/server` ou `packages/shared`, il faut le reconstruire, sinon le client et le serveur ne parlent plus de la même chose.

```sh
docker compose -f compose.yaml -f compose.dev.yaml up -d --build server
```

Commandes utiles :

```sh
docker compose ps
docker compose logs -f
docker compose down
npm install
npm test
npm run typecheck
npm run build
```

Le client permet de créer ou rejoindre une salle, choisir le jeu, jouer au quiz ou au jeu de réaction et consulter le classement. `npm test` lance les tests unitaires et Socket.IO, décrits dans [tests/README.md](tests/README.md). `npm install` crée le fichier `package-lock.json` à conserver avec le dépôt.

## Structure

```text
apps/
	client/       React + TypeScript + Vite, servi en statique par Nginx
	server/       Express + Socket.IO, TypeScript
packages/
	shared/       Contrats client/serveur et constantes
tests/          Guide des tests
docs/           Cadrage, architecture, sécurité et recette V1
```

Pour comprendre le fonctionnement et refaire un parcours à deux joueurs, voir [docs/architecture.md](docs/architecture.md). Les contrôles de sécurité sont dans [docs/security-checklist.md](docs/security-checklist.md).

## Configuration

Les valeurs locales sont documentées dans `.env.example`. Le serveur lit son environnement une seule fois au démarrage, dans `apps/server/src/config.ts`.

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `PORT` | Port d'écoute du serveur. Une valeur invalide empêche le démarrage. | `3001` |
| `CLIENT_ORIGINS` | Origines autorisées par Express et Socket.IO, séparées par des virgules. | `http://localhost:8080` |
| `NODE_ENV` | Mode d'exécution : `development`, `production` ou `test`. | `development` |
| `ATTEMPT_LIMIT_MAX` | Nombre maximal de créations, jonctions ou reprises de salle par IP dans la fenêtre. | `30` |
| `ATTEMPT_LIMIT_WINDOW_SECONDS` | Durée de cette fenêtre, en secondes. | `60` |
| `VITE_SERVER_URL` | Adresse du serveur Socket.IO intégrée au client lors de la construction Docker. | `http://localhost:3001` |

`VITE_SERVER_URL` est l'adresse Socket.IO intégrée au site lors du build Docker. Par défaut, le navigateur joint le serveur sur `http://localhost:3001`. Si le port externe du serveur change, ajuste aussi cette URL dans `.env`. Aucun secret n'est requis pour exécuter le projet localement.

Le déploiement public prévu utilise Vercel pour le frontend et Render pour le backend, avec leurs adresses gratuites. Les réglages et les limites sont dans le [guide de déploiement](docs/deploiement.md). Ce déploiement reste indépendant du lancement local avec Docker.
