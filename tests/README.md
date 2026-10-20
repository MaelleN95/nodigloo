# Tests

Les tests serveur utilisent Jest. Les tests unitaires sont près du code qu'ils vérifient, dans `apps/server/src/domain/` et `apps/server/src/socket/`. Les tests Socket.IO démarrent un serveur local et des clients de test; ils n'ont besoin d'aucun service externe.

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

Pour vérifier les types sans lancer les tests :

```sh
npm run typecheck
```

Les scénarios couvrent notamment les règles du [backlog V1](../docs/backlog-v1.md) : limites de salle, droits de l'hôte, réponses invalides ou répétées, délais, reconnexion, score et classement.

Le test de parcours complet vérifie le quiz via Socket.IO, des réponses aux cinq questions jusqu'au classement, en contrôlant les minuteries sans attendre en temps réel.