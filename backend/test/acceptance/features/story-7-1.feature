Feature: Story 7.1 - Support Mode avec Permissions Backend

  En tant qu'utilisateur ayant besoin de support technique,
  Je veux un système de permissions backend qui contrôle l'accès au mode debug de l'app,
  Afin de pouvoir activer/désactiver le mode debug sans republier l'app.

  Background:
    Given un utilisateur authentifié avec l'ID "test-user-id" et l'email "test@example.com"

  # AC1: API Backend - Endpoint de Récupération des Permissions Utilisateur
  Scenario: Récupération des permissions utilisateur avec succès
    Given l'utilisateur "test-user-id" a la permission "debug_mode_access" définie à "false"
    When l'utilisateur requête "GET /api/users/test-user-id/features"
    Then la réponse a le statut 200
    And la réponse JSON contient:
      """
      {
        "debug_mode_access": false
      }
      """

  Scenario: Récupération des permissions avec debug_mode_access activé
    Given l'utilisateur "test-user-id" a la permission "debug_mode_access" définie à "true"
    When l'utilisateur requête "GET /api/users/test-user-id/features"
    Then la réponse a le statut 200
    And la réponse JSON contient:
      """
      {
        "debug_mode_access": true
      }
      """

  # AC1: Protection par authentification
  Scenario: Accès refusé sans authentification
    When un utilisateur non authentifié requête "GET /api/users/test-user-id/features"
    Then la réponse a le statut 401

  # AC1: Un utilisateur ne peut accéder qu'à ses propres permissions
  Scenario: Un utilisateur ne peut pas accéder aux permissions d'un autre utilisateur
    Given un autre utilisateur existe avec l'ID "other-user-id"
    When l'utilisateur "test-user-id" requête "GET /api/users/other-user-id/features"
    Then la réponse a le statut 403
    And la réponse contient un message d'erreur "Forbidden"

  # AC1: Format extensible
  Scenario: Le format de réponse est extensible pour futures permissions
    Given l'utilisateur "test-user-id" a la permission "debug_mode_access" définie à "true"
    When l'utilisateur requête "GET /api/users/test-user-id/features"
    Then la réponse JSON a une structure extensible
    And la réponse peut contenir des permissions additionnelles sans breaking changes
