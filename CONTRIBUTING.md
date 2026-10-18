# Règles de travail

## Une fonctionnalité à la fois

- On travaille par fonctionnalité, en s'appuyant sur le [backlog V1](docs/backlog-v1.md).
- Chaque fonctionnalité est découpée en petites étapes cohérentes (types, logique métier, tests, intégration, documentation).

## Commits

- Les commits sont réguliers, petits et lisibles : un commit = une intention.
- Un commit ne modifie pas des dizaines de fichiers.
- Les changements non liés (formatage, dépendances, documentation) sont commités séparément.
- Messages courts à l'impératif, préfixés par un type : `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`.
- Le dépôt reste propre : aucun fichier généré, secret ou document de travail local n'est versionné.
- Avant chaque commit : `npm run typecheck`, puis les tests concernés quand ils existent.
