Feature: Story 12.2 — PKs UUID générées dans le domaine pour les entités backend

  En tant que développeur,
  Je veux que toutes les PKs des entités backend soient des UUIDs générés dans la couche applicative,
  Afin que le domaine contrôle son identité (ADR-026 R1, DDD strict).

  Scenario: Un Thought créé via le repository a un UUID assigné avant la persistance
    Given un ThoughtRepository configuré avec un DataSource en mémoire
    When une nouvelle capture est traitée avec captureId "capture-test-001" et résumé "Résumé de test"
    Then le Thought créé a un identifiant UUID valide
    And l'UUID est défini au moment du create(), avant la sauvegarde en base

  Scenario: Les Ideas créées avec un Thought ont chacune un UUID distinct assigné dans la couche applicative
    Given un ThoughtRepository configuré avec un DataSource en mémoire
    When une nouvelle capture est traitée avec 3 idées associées
    Then chaque Idea a un UUID unique et valide
    And les UUIDs des Ideas sont distincts de l'UUID du Thought

  Scenario: Des Todos créés en transaction ont chacun un UUID assigné dans la couche applicative
    Given un TodoRepository configuré avec un DataSource en mémoire
    When 2 Todos sont créés en transaction pour le thought "thought-uuid-000"
    Then chaque Todo a un UUID unique et valide

  Scenario: Aucune entité backend n'utilise @PrimaryGeneratedColumn
    Given le code source des entités backend
    When on inspecte les fichiers d'entités
    Then les entités Thought, Idea, Todo, Capture, CaptureState, CaptureType et CaptureSyncStatus n'utilisent pas @PrimaryGeneratedColumn
    And toutes ces entités héritent de BaseEntity ou BaseReferentialEntity
