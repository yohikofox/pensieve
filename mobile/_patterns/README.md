# Patterns de Référence — Mobile

Ce dossier contient les **golden paths** du projet Pensieve mobile.

Quand Claude Code implémente une nouvelle feature, il doit référencer
le snippet correspondant explicitement dans le prompt.

## Index des patterns

| Fichier | Pattern | Quand l'utiliser |
|---------|---------|-----------------|
| `01-result-pattern.ts` | Result Pattern (ADR-023) | Toute méthode qui peut échouer |
| `02-domain-event.ts` | Domain Events (ADR-019) | Nouvelles actions métier à notifier |
| `03-repository.ts` | Repository OP-SQLite | Accès base de données locale |
| `04-di-registration.ts` | Enregistrement DI (ADR-021) | Ajout d'un nouveau service |
| `05-di-hook.ts` | Résolution DI dans React | Hook qui accède à un service |
| `06-di-token.ts` | Définition de token DI | Nouveau service avec interface |
| `07-http-client.ts` | HTTP Client (ADR-025) | Tout appel HTTP sortant vers l'API |

## Règles d'utilisation

- **Un snippet = un pattern**. Ne pas mélanger.
- **Copier la structure**, remplacer uniquement la logique métier.
- **Ne pas introduire de nouveau pattern** sans validation architecturale.
- En cas de doute sur le pattern à utiliser, **signaler** plutôt qu'improviser.

## Commit message

Quand ces fichiers sont modifiés, utiliser : `docs(patterns): ...`
