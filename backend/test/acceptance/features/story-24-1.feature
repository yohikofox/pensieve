Feature: Feature Flag System — Backend Data Model & Resolution Engine
  Story 24.1: Système de feature flags avec résolution deny-wins

  Background:
    Given les features initiales sont seédées dans la base de données

  Scenario: Un utilisateur sans assignation obtient toutes les features à false
    Given il existe un utilisateur avec l'ID "user-no-assignments"
    And cet utilisateur n'a aucune assignation de feature flag
    When l'utilisateur requête GET /api/users/user-no-assignments/features
    Then la réponse a le statut 200
    And la réponse contient "debug_mode" à false
    And la réponse contient "data_mining" à false
    And la réponse contient "news_tab" à false
    And la réponse contient "projects_tab" à false
    And la réponse contient "capture_media_buttons" à false

  Scenario: Une assignation directe user à true est respectée
    Given il existe un utilisateur avec l'ID "user-with-debug"
    And cet utilisateur a une assignation user "debug_mode" à true
    When l'utilisateur requête GET /api/users/user-with-debug/features
    Then la réponse a le statut 200
    And la réponse contient "debug_mode" à true
    And la réponse contient "data_mining" à false

  Scenario: Deny-wins — une source false suffit à désactiver la feature
    Given il existe un utilisateur avec l'ID "user-deny-wins"
    And cet utilisateur a une assignation user "news_tab" à true
    And cet utilisateur a un rôle avec une assignation role "news_tab" à false
    When l'utilisateur requête GET /api/users/user-deny-wins/features
    Then la réponse a le statut 200
    And la réponse contient "news_tab" à false

  Scenario: L'endpoint retourne le format Record<string, boolean> complet
    Given il existe un utilisateur avec l'ID "user-format-check"
    When l'utilisateur requête GET /api/users/user-format-check/features
    Then la réponse a le statut 200
    And la réponse contient exactement les features du référentiel
    And toutes les valeurs de la réponse sont des booléens
