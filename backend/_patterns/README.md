# Patterns de Référence — Backend

Ce dossier contient les **golden paths** du projet Pensieve backend (NestJS).

Quand Claude Code implémente une nouvelle feature, il doit référencer
le snippet correspondant explicitement dans le prompt.

## Index des patterns

| Fichier | Pattern | Quand l'utiliser |
|---------|---------|-----------------|
| `01-result-pattern.ts` | Result Pattern (ADR-023) | Service/repository qui peut échouer |
| `02-entity.ts` | Entité TypeORM (ADR-026) | Nouvelle entité persistante |
| `03-repository.ts` | Repository TypeORM | Accès base de données |
| `04-service.ts` | Application Service NestJS | Logique métier |
| `05-controller.ts` | Controller avec autorisation | Endpoint HTTP protégé |
| `06-module.ts` | Module NestJS | Enregistrement d'un nouveau contexte |
| `07-cacheable-repository.ts` | Cache opt-in (ADR-027) | Données référentielles stables (rôles, permissions, tiers) |

## Règles d'utilisation

- **Un snippet = un pattern**. Ne pas mélanger.
- **Copier la structure**, remplacer uniquement la logique métier.
- **Ne pas introduire de nouveau pattern** sans validation architecturale.
- **UUID généré dans la couche applicative** — jamais par PostgreSQL.
- En cas de doute sur le pattern à utiliser, **signaler** plutôt qu'improviser.

## Rappels ADR critiques

| ADR | Règle |
|-----|-------|
| ADR-026 R1 | `@PrimaryColumn('uuid')` — JAMAIS `@PrimaryGeneratedColumn` |
| ADR-026 R4 | Soft delete via `deletedAt` — JAMAIS `DELETE` SQL direct |
| ADR-026 R3 | Pas de cascade TypeORM — suppression explicite en transaction |
| ADR-023 | Retourner `Result<T>` — JAMAIS `throw` dans les services applicatifs |
| ADR-026 R5 | Timestamps `TIMESTAMPTZ` — hérités de `AppBaseEntity` |

## Commit message

Quand ces fichiers sont modifiés, utiliser : `docs(patterns): ...`
