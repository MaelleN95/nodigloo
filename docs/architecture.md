# Architecture et parcours de test

## Vue d'ensemble

```
Navigateur (React + Vite)              Serveur (Node + Express + Socket.IO)
┌──────────────────────────┐           ┌──────────────────────────────────┐
│ Écrans (Home, Lobby,     │           │ socket/room-handlers.ts          │
│ Quiz, Results)           │  Socket   │   valide les payloads, limite    │
│        │                 │ ────────► │   les tentatives                 │
│ RoomProvider (état salle)│  .IO      │        │                         │
│        │                 │ ◄──────── │ domain/room-service.ts (salles)  │
│ socket.ts (1 connexion)  │           │ domain/games/quiz/quiz-service.ts│
└──────────────────────────┘           │   (questions, chrono, scores)    │
        port 8080                      └──────────────────────────────────┘
                                                 port 3001
```

- Le navigateur n'a aucune règle de jeu : il affiche ce que le serveur envoie.
- Les types des événements sont dans `packages/shared`, partagés par le client et le serveur.
- Tout est gardé en mémoire dans le serveur.

L'illustration d'accueil est une scène Three.js décorative, chargée à la demande par `IglooIllustration`. Elle représente un igloo en blocs de glace avec une entrée ambrée.

- Sur ordinateur, la caméra suit doucement la souris, avec un angle horizontal et une hauteur limités. La commande permet de désactiver ce suivi en conservant l'angle courant.
- Sur un appareil tactile sans survol (`hover: none` et `pointer: coarse`), la caméra fait un tour complet autour de l'igloo en 60 secondes. « Arrêter l'animation » coupe le mouvement et réinitialise immédiatement la vue ; « Relancer l'animation » reprend la rotation depuis cette position. Les gestes tactiles ne déplacent pas la caméra et le défilement reste libre.
- Le mouvement est activé par défaut dans les deux modes, y compris lorsque la réduction des animations est demandée. Le choix de l'arrêter reste valable tant que l'accueil est affiché. Un changement de mode de pointage réinitialise la vue sans modifier ce choix.
- Le rendu s'arrête hors écran ou quand l'onglet est masqué, sans rattrapage du temps écoulé au retour. Sur ordinateur, il s'arrête aussi une fois la caméra stabilisée.

Le logo sert de repli pendant le chargement ou si WebGL n'est pas disponible, avec une erreur dans la console en cas d'échec. La commande est masquée tant que la scène n'est pas disponible. Les ressources graphiques et les écouteurs sont libérés au démontage du composant.

## Flux de connexion

1. Le client ouvre une connexion Socket.IO quand le joueur crée ou rejoint une salle.
2. Le serveur répond avec la salle et une session (`playerId` et `reconnectToken`). Le client les garde dans `sessionStorage`.
3. En cas de coupure, Socket.IO retente tout seul. À la reconnexion, le client envoie `session:resume` avec sa session. Le serveur lui renvoie la salle, et la question en cours si une partie est lancée.
4. Si la session est refusée (délai de 60 s dépassé, serveur redémarré), le client l'efface et revient à l'accueil.

## Événements Socket.IO

Client vers serveur (chacun répond par un accusé `{ ok: true, data }` ou `{ ok: false, error }`) :

| Événement | Rôle |
| --- | --- |
| `room:create` | Crée une salle avec un pseudo. Le créateur est l'hôte. |
| `room:join` | Rejoint une salle avec un code et un pseudo. |
| `room:leave` | Quitte immédiatement un salon avant le lancement. La place et le pseudo sont libérés ; le rôle d'hôte est transféré si nécessaire et une salle vide est supprimée. |
| `session:resume` | Reprend sa place après une coupure. |
| `room:settings:update` | Change le jeu et le nombre de manches, de 1 à 10 (hôte seulement, avant le lancement). |
| `game:start` | Lance la partie (hôte seulement, 2 joueurs connectés minimum). |
| `quiz:answer:submit` | Envoie le choix (0 à 3) pour la question en cours. |
| `clock:ping` | Renvoie l'heure du serveur. Le client s'en sert pour mesurer l'écart entre son horloge et celle du serveur. |

Serveur vers client :

| Événement | Rôle |
| --- | --- |
| `room:updated` | Nouvel état de la salle (joueurs, hôte, statut, réglages). |
| `question:started` | Question et quatre choix, sans la bonne réponse, avec l'heure de fin. |
| `question:revealed` | Bonne réponse et scores, pendant 3 secondes. |
| `game:finished` | Classement final. |

Codes d'erreur possibles : `INVALID_PAYLOAD`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `GAME_ALREADY_STARTED`, `NICKNAME_TAKEN`, `FORBIDDEN`, `NOT_ENOUGH_PLAYERS`, `ALREADY_ANSWERED`, `ANSWER_TOO_LATE`, `SESSION_EXPIRED`, `RATE_LIMITED`, `INTERNAL_ERROR`.

## Limites de la V1

- Les salles et les scores sont en mémoire : un redémarrage du serveur les efface.
- Pas de comptes, pas de base de données.
- Un seul serveur : on ne peut pas répartir les salles sur plusieurs instances.

## Parcours de test manuel à deux joueurs

1. Lancer le projet : `docker compose up -d --build`, puis ouvrir [http://localhost:8080](http://localhost:8080).
2. Onglet 1 : saisir un pseudo (par exemple Alice) et créer une salle. Cliquer sur le code (ou utiliser Tab puis Entrée sur « Copier le code ») : une bulle « Code copié » apparaît sous l'encart pendant 2,5 secondes, sans décaler le salon. Le code reste sélectionnable pour une copie manuelle ; sélectionner du texte ne déclenche pas la copie automatique. Si le navigateur refuse la copie, un message invite à le copier manuellement.
3. Onglet 2 : saisir un autre pseudo et le code, puis rejoindre. La session est gardée par onglet, donc un deuxième onglet normal suffit. Les deux joueurs apparaissent dans les deux onglets.
4. Vérifier que seul l'onglet 1 (hôte) a le bouton « Lancer le quiz ». L'onglet 2 affiche « En attente du lancement par l'hôte… ».
5. Lancer la partie. Les deux onglets passent à la première question avec le décompte.
6. Répondre dans chaque onglet : le choix est verrouillé en bleu, la question ne peut plus être changée.
7. Attendre la révélation : la bonne réponse apparaît, puis la question suivante après 3 secondes. Répéter jusqu'à la cinquième.
8. Vérifier le classement : les scores sont de 100 points par bonne réponse, et la ligne du joueur connecté est mise en avant.
9. Tester la reconnexion : pendant une question, recharger un onglet. Il doit revenir sur la question en cours. En coupant le serveur (`docker compose stop server`), la pastille passe à « Reconnexion… ».
10. Cliquer sur « Terminer cette partie » pour revenir à l'accueil.

Avant de lancer une partie, chaque joueur peut utiliser « Retour à l'accueil » dans le salon. Cette action discrète quitte la salle ; « Lancer la partie » reste l'action principale de l'hôte. Vérifier que la place disparaît immédiatement dans l'autre onglet, et que le départ de l'hôte transfère son rôle au joueur connecté le plus ancien. Quitter seul supprime la salle. Une déconnexion involontaire conserve toujours le délai de reconnexion de 60 secondes.
