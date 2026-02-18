# Story 12.3: Implémenter le Soft Delete sur Toutes les Entités Backend
# ADR-026 R4 — Soft Delete obligatoire via @DeleteDateColumn
#
# Critères de succès :
# AC2: Champ _status supprimé des entités
# AC3: Repositories utilisent softDelete() et withDeleted()
# AC4: findById() retourne null après soft delete (→ 404)
# AC5: findByIdWithDeleted() retourne l'enregistrement supprimé (accès audit)

Feature: Soft Delete sur les entités backend (ADR-026 R4)

  Scenario: ThoughtRepository utilise softDelete() à la place de delete()
    Given un ThoughtRepository configuré avec un DataSource en mémoire
    When la méthode delete() est appelée pour un Thought existant
    Then softDelete() est invoqué sur le repository TypeORM
    And delete() standard n'est pas invoqué

  Scenario: Un Thought soft-deleté n'est plus retourné par findById()
    Given un ThoughtRepository configuré avec un DataSource en mémoire
    And un Thought avec l'id "thought-to-delete-001" existe
    When la méthode delete() est appelée pour le Thought "thought-to-delete-001"
    Then findById("thought-to-delete-001") retourne null
    And le record est toujours accessible via findByIdWithDeleted("thought-to-delete-001")

  Scenario: TodoRepository utilise softDelete() à la place de delete()
    Given un TodoRepository configuré avec un DataSource en mémoire
    When la méthode delete() est appelée pour un Todo existant
    Then softDelete() est invoqué sur le repository TypeORM pour les todos
    And delete() standard n'est pas invoqué pour les todos

  Scenario: Aucune entité backend ne possède de champ _status textuel
    Given le code source des entités backend knowledge et action
    When on inspecte les fichiers d'entités
    Then les entités Thought, Idea et Todo ne contiennent pas de colonne _status
    And ces entités héritent toutes de BaseEntity avec deletedAt
