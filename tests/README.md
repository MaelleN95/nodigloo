# Tests

Les tests serveur utilisent Jest. Les tests unitaires sont près du code qu'ils vérifient, dans `apps/server/src/domain/` et `apps/server/src/socket/`. Les tests Socket.IO démarrent un serveur local et des clients de test; ils n'ont besoin d'aucun service externe.

Le client utilise Vitest, qui reprend la configuration de Vite. Ses tests sont à côté des fonctions qu'ils vérifient, par exemple `apps/client/src/lib/ranking.test.ts`.

## Lancer les tests

À la racine du dépôt, exécuter tous les tests :

```sh
npm test
```

Le script compile d'abord `@nodigloo/shared`, puis lance les suites de tests des workspaces.

Pour ne lancer qu'une suite du serveur :

```sh
npm test --workspace @nodigloo/server -- --runInBand src/socket/room-handlers.test.ts
```

`--runInBand` demande à Jest d'exécuter les tests l'un après l'autre, ce qui facilite la lecture des logs des serveurs Socket.IO temporaires.

Pour ne lancer que les tests du client :

```sh
npm test --workspace @nodigloo/client
```

Pour vérifier les types sans lancer les tests :

```sh
npm run typecheck
```

Les scénarios couvrent notamment les règles du [backlog V1](../docs/backlog-v1.md) : limites de salle, droits de l'hôte, réponses invalides ou répétées, délais, reconnexion, score et classement.

## Scénarios obligatoires

| Scénario | Test |
| --- | --- |
| Création et jonction de salle | `room-handlers.test.ts` (créer, rejoindre) |
| Lancement par l'hôte, refus pour un non-hôte ou avec un seul joueur | `room-handlers.test.ts` |
| Neuvième joueur refusé | `room-handlers.test.ts`, `room-service.test.ts` |
| Joueur qui arrive pendant une partie | `room-handlers.test.ts`, `room-service.test.ts` |
| Réponse répétée, tardive, d'un ancien socket ou d'une mauvaise question | `quiz-service.test.ts`, `room-handlers.test.ts` |
| Réponses simultanées | `room-handlers.test.ts` |
| Expiration du temps et révélation | `quiz-service.test.ts` |
| Score serveur et classement | `quiz-service.test.ts`, `room-handlers.test.ts` (partie complète) |
| Déconnexion de l'hôte et transfert du rôle | `room-service.test.ts`, `room-handlers.test.ts` |
| Reconnexion dans les 60 s, et refus après | `room-service.test.ts`, `room-handlers.test.ts` |
| Payload mal formé | `payloads.test.ts`, `room-handlers.test.ts` |
| Identifiant inconnu | `room-handlers.test.ts`, `room-service.test.ts` |
| Redémarrage du backend | Le serveur redémarré ne connaît plus la salle : c'est le cas « joueur inconnu » de `room-handlers.test.ts`. Le client efface alors sa session et revient à l'accueil. |
| Limitation des tentatives | `rate-limiter.test.ts`, `room-handlers.test.ts` |

## Scénarios du jeu de réaction

| Scénario | Test |
| --- | --- |
| Heure du vert tirée entre 2 et 6 secondes | `reaction-service.test.ts` |
| Barème selon le temps de réaction | `reaction-service.test.ts` (`getReactionPoints`) |
| Faux départ : appui avant le vert ou en moins de 100 ms | `reaction-service.test.ts` |
| Appui répété, tardif, d'un autre socket ou d'une autre manche | `reaction-service.test.ts`, `room-handlers.test.ts` |
| Fin de manche quand tout le monde a joué, ou à la fin du délai | `reaction-service.test.ts` |
| Joueurs déconnectés non attendus | `reaction-service.test.ts` |
| Partie complète et classement | `reaction-service.test.ts`, `room-handlers.test.ts` (bloc « jeu de réaction ») |
| Reprise de session pendant une manche | `reaction-service.test.ts`, `room-handlers.test.ts` |
| Appui mal formé | `payloads.test.ts`, `room-handlers.test.ts` |
| Mesure du décalage d'horloge | `clock-handlers.test.ts`, `apps/client/src/lib/clock.test.ts` |
| Affichage et tri des temps de la manche | `apps/client/src/lib/reaction.test.ts` |

Aucun test ne dépend d'une base de données ni d'un service externe.

Les tests de parcours complet vérifient chaque jeu via Socket.IO, de la première manche jusqu'au classement, en contrôlant les minuteries sans attendre en temps réel.