Feature: Story 13.3 — Colonnes date en TIMESTAMPTZ sur toutes les entités backend

  En tant que développeur,
  Je veux que toutes les colonnes de date des entités backend utilisent TIMESTAMPTZ,
  Afin qu'aucune information de timezone ne soit perdue lors du stockage (ADR-026 R5).

  Scenario: BaseEntity déclare ses colonnes de date en timestamptz
    Given le fichier source de BaseEntity
    When j'inspecte les décorateurs de colonnes de date
    Then createdAt utilise le type 'timestamptz'
    And updatedAt utilise le type 'timestamptz'
    And deletedAt utilise le type 'timestamptz'

  Scenario: L'entité Todo corrige ses colonnes de date spécifiques en timestamptz
    Given le fichier source de l'entité Todo
    When j'inspecte les décorateurs de colonnes de date
    Then la colonne deadline utilise le type 'timestamptz'
    And la colonne completedAt utilise le type 'timestamptz'

  Scenario: L'entité Notification utilise timestamptz pour toutes ses colonnes de date
    Given le fichier source de l'entité Notification
    When j'inspecte les décorateurs de colonnes de date
    Then aucune colonne de date n'utilise le type 'timestamp' sans timezone

  Scenario: L'entité User utilise timestamptz pour toutes ses colonnes de date
    Given le fichier source de l'entité User
    When j'inspecte les décorateurs de colonnes de date
    Then aucune colonne de date n'utilise le type 'timestamp' sans timezone

  Scenario: L'entité AdminUser utilise timestamptz pour ses colonnes de date
    Given le fichier source de l'entité AdminUser
    When j'inspecte les décorateurs de colonnes de date
    Then aucune colonne de date n'utilise le type 'timestamp' sans timezone

  Scenario: Les entités de synchronisation utilisent timestamptz
    Given les fichiers sources de SyncLog et SyncConflict
    When j'inspecte les décorateurs de colonnes de date
    Then aucune colonne de date n'utilise le type 'timestamp' sans timezone

  Scenario: Toutes les entités d'autorisation utilisent timestamptz
    Given les fichiers sources des entités d'autorisation
    When j'inspecte les décorateurs de colonnes de date dans chaque fichier
    Then aucun fichier d'entité d'autorisation n'utilise le type 'timestamp' sans timezone

  Scenario: La migration ALTER TABLE existe pour corriger les colonnes existantes
    Given le répertoire des migrations TypeORM
    When je cherche la migration de correction TIMESTAMPTZ
    Then une migration nommée AlterTimestampColumnsToTimestamptz existe
    And elle contient des instructions ALTER COLUMN TYPE TIMESTAMPTZ

  Scenario: Les FKs entières résiduelles sont absentes de capture.entity.ts (AC5)
    Given le fichier source de l'entité Capture
    When j'inspecte les colonnes FK de type entier
    Then typeId est de type uuid et non number
    And stateId est de type uuid et non number
    And syncStatusId est de type uuid et non number
