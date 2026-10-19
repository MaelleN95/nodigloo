# Nodigloo

Plateforme web de mini-jeux multijoueurs en temps réel. La V1 est un quiz de culture générale jouable en salle, sans compte ni persistance.

## Périmètre V1

- 2 à 8 joueurs par salle, avec pseudonyme temporaire et code de salle partageable.
- L'hôte est le seul à pouvoir lancer une partie.
- Une partie comporte 5 questions, chacune avec 4 choix et une limite de 20 secondes.
- Le serveur contrôle le temps, les réponses et les scores : 100 points par bonne réponse, aucun bonus de rapidité.
- Une réponse au plus par joueur et par question; les réponses tardives ou invalides sont refusées.
- La reconnexion conserve l'identité logique du joueur pendant un délai de grâce de 60 secondes.
- Le classement final est calculé côté serveur; les égalités partagent le rang.
- Les salles et les scores restent en mémoire et sont perdus au redémarrage.

Le périmètre détaillé et les exclusions sont dans [docs/backlog-v1.md](docs/backlog-v1.md). Les jeux de rapidité, dessin, comptes, base de données et publication publique ne bloquent pas la V1.

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

Commandes utiles :

```sh
docker compose ps
docker compose logs -f
docker compose down
npm install
npm run typecheck
npm run build
```

Le frontend de cette phase est un écran de vérification statique; le parcours multijoueur sera construit dans les phases suivantes. `npm install` crée le fichier `package-lock.json` à conserver avec le dépôt.

## Structure

```text
apps/
	client/       React + TypeScript + Vite, servi en statique par Nginx
	server/       Express + Socket.IO, TypeScript
packages/
	shared/       Contrats client/serveur (phase suivante)
tests/          Scénarios métier et intégration (à ajouter avec les règles)
docs/           Cadrage et suivi V1
```

## Configuration

Les valeurs locales sont documentées dans `.env.example`. Le serveur lit son environnement une seule fois au démarrage, dans `apps/server/src/config.ts`.

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `PORT` | Port d'écoute du serveur. Une valeur invalide empêche le démarrage. | `3001` |
| `CLIENT_ORIGINS` | Origines autorisées par Express et Socket.IO, séparées par des virgules. | `http://localhost:8080` |
| `NODE_ENV` | Mode d'exécution : `development`, `production` ou `test`. | `development` |

Aucun secret n'est requis pour exécuter le socle local.

La cible de publication éventuelle (frontend statique et backend séparé) sera traitée après la validation locale de la V1; elle n'est pas nécessaire pour développer ni tester.
