# Contrôles de sécurité V1

Liste des contrôles faits sur le serveur et le client de la V1. Chaque ligne indique où se trouve la protection et comment elle est vérifiée.

| Contrôle | Où | Vérifié par |
| --- | --- | --- |
| Les payloads Socket.IO sont validés à l'exécution (type, taille, valeurs autorisées). | `apps/server/src/socket/payloads.ts` (zod), règles métier dans `domain/` | `payloads.test.ts`, `room-handlers.test.ts` |
| Un payload mal formé renvoie `INVALID_PAYLOAD` sans déconnecter ni faire planter le serveur. | `parsePayload`, `reportError` | `room-handlers.test.ts` (payload invalide, reprise mal formée) |
| Chaque événement sensible vérifie le joueur, son rôle et l'état de la salle côté serveur : seul l'hôte lance, une réponse par question, pas de jonction en cours de partie. | `room-handlers.ts`, `room-service.ts`, `quiz-service.ts` | tests du non-hôte, de la réponse répétée, du neuvième joueur |
| Les créations, jonctions et reprises de session sont limitées par IP (30 par minute par défaut). | `socket/rate-limiter.ts`, `app.ts` | `rate-limiter.test.ts`, `room-handlers.test.ts` |
| La bonne réponse n'est envoyée qu'à la révélation (`QuestionReveal`). Elle n'est pas dans `QuestionStart`. | `packages/shared/src/quiz.ts` | lecture des types partagés |
| Le score est calculé uniquement par le serveur. | `quiz-service.ts` | test d'une partie complète |
| Les pseudos sont affichés par React, qui échappe le texte. Aucun `dangerouslySetInnerHTML` n'est utilisé. | `apps/client/src/components/` | recherche dans le code |
| Les origines CORS (Express et Socket.IO) viennent de `CLIENT_ORIGINS`. | `app.ts`, `config.ts` | `config.test.ts` |
| Le corps JSON HTTP est limité à 16 ko. | `app.ts` | lecture du code |
| Les logs ne contiennent que l'id technique du socket : ni pseudo, ni token, ni contenu de message. | `app.ts`, `room-handlers.ts` | recherche des appels à `console` |
| Les salles abandonnées sont supprimées après le délai de reconnexion de 60 s. Les parties orphelines sont nettoyées au prochain passage du chronomètre. | `room-service.ts` (`expireDisconnectedPlayers`), `room-maintenance.ts` | `room-handlers.test.ts` (expiration, suppression de salle) |
| Les limites et les origines se règlent par variables d'environnement. | `config.ts`, `.env.example`, `compose.yaml` | `config.test.ts` |

## Limites connues

- Les réponses au quiz et le lancement de partie ne sont pas limités en débit. Les règles métier les bornent déjà : une réponse par question, lancement réservé à l'hôte.
- L'IP vient de la connexion directe. Derrière un proxy, il faudra lire `X-Forwarded-For` (étape 16, déploiement).
- Tout est en mémoire : un redémarrage du serveur efface les salles.
