Feature: Tables référentielles pour les statuts backend (ADR-026 R2)

  En tant que développeur
  Je veux que les statuts des entités utilisent des tables référentielles avec FK
  Afin que le modèle de données soit type-safe, extensible, et conforme à ADR-026 R2

  Scenario: La table thought_statuses possède tous les champs requis
    Given le code source de l'entité ThoughtStatus
    When on inspecte les colonnes de ThoughtStatus
    Then elle possède le champ "code" de type varchar
    And elle possède le champ "label" de type varchar
    And elle possède le champ "displayOrder" de type int
    And elle possède le champ "isActive" de type boolean
    And elle hérite de BaseReferentialEntity avec id, createdAt, updatedAt (sans deletedAt)

  Scenario: L'entité Thought utilise une FK vers thought_statuses
    Given le code source de l'entité Thought
    When on inspecte les colonnes de Thought
    Then elle possède un champ statusId de type UUID
    And elle ne contient pas de colonne _status en texte libre
    And elle référence ThoughtStatus via une relation ManyToOne

  Scenario: Les constantes THOUGHT_STATUS_IDS contiennent les valeurs requises
    Given le fichier reference-data.constants.ts
    When on vérifie les constantes THOUGHT_STATUS_IDS
    Then la constante ACTIVE est définie avec un UUID déterministe au format "d0000000-"
    And la constante ARCHIVED est définie avec un UUID déterministe au format "d0000000-"
    And les deux UUIDs sont distincts

  Scenario: La table capture_states est complète avec les champs manquants
    Given le code source de l'entité CaptureState
    When on inspecte les colonnes de CaptureState
    Then elle possède le champ "label" de type varchar
    And elle possède le champ "displayOrder" de type int
    And elle possède le champ "isActive" de type boolean

  Scenario: ThoughtRepository assigne un statusId valide lors de la création d'un Thought
    Given le code source de ThoughtRepository
    When on inspecte la méthode createWithIdeas
    Then elle assigne un statusId correspondant à THOUGHT_STATUS_IDS.ACTIVE
    And le statusId est passé lors de manager.create de Thought

  Scenario: La migration garantit la contrainte FK avec ON DELETE RESTRICT
    Given le fichier de migration AddThoughtStatusIdFkToThoughts
    When on inspecte le SQL de la migration up
    Then elle contient une contrainte FK_thoughts_status_id
    And la contrainte utilise ON DELETE RESTRICT

  Scenario: La migration de seed est idempotente sur les codes thought_statuses
    Given le fichier de migration CreateThoughtStatusesAndUpdateCaptureStates
    When on inspecte le SQL du seed
    Then le seed utilise ON CONFLICT sur l'identifiant primaire pour éviter les doublons
    And les codes "active" et "archived" sont insérés avec des UUIDs déterministes au format "d0000000-"
