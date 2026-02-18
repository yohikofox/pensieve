# Story 12.4: Supprimer les Cascades TypeORM et Gérer la Suppression en Couche Applicative
# ADR-026 R3: Cascades interdites sans décision documentée

Feature: Suppression explicite des cascades TypeORM — ADR-026 R3

  Background:
    Given un ThoughtDeleteService configuré avec un DataSource en mémoire

  # ---------------------------------------------------------------------------
  # Scénario 1: Les Ideas liées sont soft-deletées lors de la suppression
  # ---------------------------------------------------------------------------
  Scenario: Les Ideas liées sont soft-deletées quand un Thought est supprimé
    Given un Thought "thought-abc" avec 2 Ideas liées "idea-001" et "idea-002"
    When le ThoughtDeleteService supprime le Thought "thought-abc"
    Then le résultat est un succès
    And les Ideas "idea-001" et "idea-002" sont soft-deletées
    And le Thought "thought-abc" est soft-deleted

  # ---------------------------------------------------------------------------
  # Scénario 2: Rollback de transaction si la suppression d'une Idea échoue
  # ---------------------------------------------------------------------------
  Scenario: Transaction rollback si le soft-delete d'une Idea échoue
    Given un Thought "thought-fail" avec des Ideas liées
    And le soft-delete des Ideas est configuré pour échouer
    When le ThoughtDeleteService tente de supprimer le Thought "thought-fail"
    Then le résultat est une erreur de transaction
    And le Thought "thought-fail" n'est pas supprimé
    And aucune exception n'est levée

  # ---------------------------------------------------------------------------
  # Scénario 3: Vérification structurelle — absence de cascade: true dans thought.entity.ts
  # ---------------------------------------------------------------------------
  Scenario: L'entité Thought ne contient plus de cascade TypeORM
    Given le code source de l'entité Thought
    When on inspecte la relation ideas
    Then la relation OneToMany n'a pas l'option cascade true
    And un commentaire ADR-026 R3 documente la décision
