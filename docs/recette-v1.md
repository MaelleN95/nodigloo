# Recette V1

Recette faite le 22 octobre 2026 sur la version construite (`docker compose up -d --build`), avec un joueur dans le navigateur et un joueur simulé par un client Socket.IO.

## Vérifications globales

| Vérification | Résultat |
| --- | --- |
| `npm run typecheck` | OK |
| `npm test` | OK, 133 tests |
| Build de production du client et du serveur (images Docker) | OK |
| Démarrage des deux services, `/health` et routes du client (`/room/ABCDE`) | OK |
| Partie complète dans le navigateur : création, jonction, lancement, cinq questions, classement | OK |
| Scores : un joueur répond toujours en A, l'autre toujours en B, avec bonnes réponses B, C, B, C, B. Résultat 0 et 300 points | OK |
| Rechargement de la page sur le classement | OK, retour sur le classement, connecté |
| Serveur coupé : pastille « Reconnexion… » | OK |
| Serveur relancé (salles perdues) : message « Session expirée ou invalide » et retour à l'accueil | OK |
| Pas de débordement horizontal sur écran de 360 px (page d'accueil) | OK |
| Construction Docker depuis un clone Git local neuf, sans dépendances ni fichiers générés du dossier de travail | OK, client et serveur |
| Démarrage des images issues du clone neuf, sur des ports temporaires | OK, `/health` répond et une route `/room/ABCDE` renvoie HTTP 200 |

## Critères du backlog

| Critère | État | Preuve |
| --- | --- | --- |
| V1-01 Créer une salle avec un code partageable | Validé | Tests `room-service` et `room-code`, parcours navigateur |
| V1-02 Rejoindre avec un pseudonyme, 2 à 8 joueurs, neuvième refusé | Validé | Test Socket.IO du neuvième joueur |
| V1-03 Lobby synchronisé, seul l'hôte lance | Validé | Tests du non-hôte, bouton absent chez les invités |
| V1-04 Quiz autoritaire : 5 questions, 4 choix, 20 s, 3 s de révélation | Validé | Tests `quiz-service`, parcours navigateur |
| V1-05 Réponses validées et notées par le serveur | Validé | Tests des doublons, retards, mauvais socket. Scores vérifiés dans le navigateur |
| V1-06 Révélation, classement, égalités au même rang | Validé | Test de partie complète, classement avec égalité vu dans le navigateur |
| V1-07 Déconnexion et reconnexion pendant 60 s | Validé | Tests Socket.IO et `room-service`, rechargement de page |
| V1-08 Payloads validés, actions protégées | Validé | [Checklist de sécurité](security-checklist.md) |
| V1-09 Interface accessible, clavier et écran étroit | Validé | Écran étroit sans débordement sur l'accueil (vérifié en 360 px). Parcours complet au clavier (Tab, Entrée), lobby, quiz et classement sur écran étroit rejoués à la main |
| V1-10 Tests du moteur et des événements temps réel | Validé | Voir [tests/README.md](../tests/README.md) |
| V1-11 Documentation du lancement, des tests et de l'architecture | Validé | [README](../README.md), [architecture](architecture.md) |

## Reproductibilité et suite

Le build Docker et le démarrage ont aussi été vérifiés depuis un clone Git local neuf du commit `6111a40`, avec le cache Docker existant. Le contrôle de reproductibilité restant pour l'étape 14 est levé.

La suite choisie est le déploiement public sur Vercel et Render, décrit dans le [guide de déploiement](deploiement.md). Le tag annoté `v1.0.0` sera proposé après vérification du parcours sur les adresses publiques.

## Vérifications publiques

Vérifications effectuées le 22 octobre 2026 sur <https://nodigloo.vercel.app> et <https://nodigloo-server.onrender.com>.

| Vérification | Résultat |
| --- | --- |
| `/health` avec l'origine Vercel | HTTP 200, origine autorisée exacte |
| Adresse du backend dans le bundle frontend actif | URL HTTPS Render présente, ancienne URL `localhost:3001` absente |
| Accès direct à une route React | La page d'entrée est servie |
| Création de salle et rechargement du salon dans le navigateur | OK, joueur reconnecté dans le salon |
| Création, jonction et reprise de session avec deux clients Socket.IO publics | OK |
| Partie complète avec deux clients Socket.IO | Cinq questions, cinq réponses par joueur, cinq révélations |
| Scores calculés à partir des révélations | 200 points attendus et reçus pour chaque joueur ; les deux partagent le rang 1 |
| Transport réseau en fin de partie | WebSocket pour les deux clients |

Le parcours navigateur public complet n'a pas été validé : l'outil navigateur a perdu l'accès aux pages pendant les essais. La partie complète ci-dessus a été vérifiée par des clients Socket.IO, pas par deux parcours d'interface.

Restent à vérifier avant de clore la recette publique :

- le parcours complet dans l'interface publique ;
- le réveil après mise en veille Render ;
- l'identification des IP derrière le proxy et le quota de tentatives.

Aucun tag de version n'est encore posé.
