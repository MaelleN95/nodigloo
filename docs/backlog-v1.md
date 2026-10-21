# Backlog V1 - MVP quiz multijoueur

Ce backlog applique le cahier des charges Nodigloo v1.0. Les règles ci-dessous sont fixes pour démarrer l'implémentation; tout changement de règle doit être décidé et consigné avant de modifier le moteur.

## Obligatoire pour la V1

| ID    | Tâche                                                     | Critère de fin                                                                                                                    |
| ----- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| V1-01 | Créer une salle avec un code partageable et un hôte.      | Le code est unique et suffisamment imprévisible; le créateur devient hôte.                                                        |
| V1-02 | Rejoindre une salle avec un pseudonyme temporaire.        | Une salle accepte de 2 à 8 joueurs; le neuvième est refusé.                                                                       |
| V1-03 | Synchroniser le lobby en temps réel.                      | Les joueurs voient le même état; seul l'hôte peut lancer la partie.                                                               |
| V1-04 | Jouer un quiz autoritaire côté serveur.                   | 5 questions par partie, 4 choix, 20 secondes par question, 3 secondes de révélation, sans bonus de rapidité.                       |
| V1-05 | Valider et noter les réponses côté serveur.               | Une réponse par joueur et question; réponse juste = 100 points, sinon 0; retards et choix invalides rejetés.                      |
| V1-06 | Révéler la réponse au moment prévu et terminer la partie. | La bonne réponse est affichée pendant 3 secondes; le classement vient des scores serveur et les égalités partagent le rang.         |
| V1-07 | Gérer les déconnexions et la reconnexion.                 | L'identité logique est indépendante du socket; reconnexion possible pendant 60 secondes.                                          |
| V1-08 | Valider les événements et protéger les actions sensibles. | Payloads validés à l'exécution; rôle, identité et état de salle contrôlés côté serveur.                                           |
| V1-09 | Fournir une interface accessible au parcours complet.     | Création/jonction, lobby, quiz, résultats et états d'erreur sont utilisables au clavier et sur écran étroit.                      |
| V1-10 | Tester le moteur et les événements temps réel.            | Les cas nominaux et limites (capacité, hôte, doublons, délais, reconnexion) sont testés sans service payant.                      |
| V1-11 | Documenter lancement, tests, architecture et limites.     | Une installation propre peut démarrer les services et suivre un test manuel à deux joueurs.                                       |

## Améliorations ultérieures

- Améliorations d'expérience non nécessaires au parcours complet du quiz.
- Historique ou statistiques conservés, si une persistance est décidée ultérieurement.
- Optimisations de montée en charge au-delà du modèle local en mémoire.

## Hors périmètre V1

- Comptes, authentification et profils permanents.
- Base de données ou persistance des salles, joueurs et scores.
- Déploiement public obligatoire; la publication est une étape ultérieure, après validation locale.
- Jeu de dessin, jeu de rapidité ou second mini-jeu.
- Fonctionnalités V3/V4 telles qu'une plateforme de mini-jeux extensible ou une infrastructure multi-instance.

## Règles de référence

- 2 à 8 joueurs dans une salle; pseudonymes temporaires; un hôte par salle.
- 5 questions, 4 propositions par question et 20 secondes par question.
- Banque locale de 20 questions originales; 5 questions différentes sont tirées au sort par partie.
- 100 points par bonne réponse, 0 sinon; aucun bonus de rapidité.
- Le lancement exige au moins 2 joueurs connectés.
- Le serveur est l'autorité pour les salles, le chronomètre, les réponses, les transitions et le classement.
- Délai de grâce de reconnexion : 60 secondes. Les données en mémoire sont perdues au redémarrage du backend.
