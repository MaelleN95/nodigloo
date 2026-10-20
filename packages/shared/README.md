# Contrats partagés

Types et constantes communs au client et au serveur. Le package est compilé dans `dist/` (`npm run build --workspace @nodigloo/shared`), et le client comme le serveur l'importent via `@nodigloo/shared`.

## Contenu

| Fichier | Rôle |
| --- | --- |
| `constants.ts` | Règles V1 : joueurs min/max, nombre de questions, durée, points, délai de reconnexion |
| `room.ts` | `RoomPublic`, `PlayerPublic`, `RoomStatus` |
| `quiz.ts` | `QuestionPublic`, `QuestionStart`, `QuestionReveal`, `RankingEntry` |
| `errors.ts` | `ERROR_CODES` et `AppError` |
| `events.ts` | `ClientToServerEvents`, `ServerToClientEvents`, `Ack`, payloads et `Session` |

## Événements Socket.IO

Client vers serveur (chacun répond par un `Ack` : `{ ok: true, data }` ou `{ ok: false, error }`) :

- `room:create` : crée une salle, le créateur devient hôte
- `room:join` : rejoint une salle avec un code et un pseudo
- `session:resume` : reprend sa place avec `playerId` et `reconnectToken`
- `game:start` : lance la partie (hôte uniquement)
- `quiz:answer:submit` : envoie un choix pour la question de quiz en cours

Serveur vers client : `room:updated`, `question:started`, `question:revealed`, `game:finished`.

## Données publiques et privées

La bonne réponse n'existe dans aucun type de question public : elle n'est envoyée que dans `QuestionReveal`, au moment de la révélation. Le type de question avec la réponse reste côté serveur. Le `reconnectToken` n'est donné qu'au joueur concerné via `Session` et ne figure jamais dans `RoomPublic`.

Ces types ne valident rien à l'exécution : le serveur doit contrôler chaque payload reçu (étape 7).
