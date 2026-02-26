Feature: Feature Flag System — Admin API & Interface d'Administration
  Story 24.2: API admin pour la gestion du catalogue et des assignations feature flags

  Background:
    Given les features initiales sont seédées dans la base de données

  Scenario: Admin crée une feature, l'assigne à un user, et vérifie la résolution
    Given il existe un utilisateur avec l'ID "user-ff-admin-test"
    And je suis authentifié en tant qu'admin
    When l'admin requête POST /api/admin/features avec key "beta_feature" et defaultValue false
    Then la réponse a le statut 201
    And la réponse contient la feature avec key "beta_feature"
    When l'admin requête PUT /api/admin/users/user-ff-admin-test/features/beta_feature avec value true
    Then la réponse a le statut 200
    And la réponse contient source "user"
    When l'admin requête GET /api/admin/users/user-ff-admin-test/features
    Then la réponse a le statut 200
    And la trace de "beta_feature" a resolved à true
    And la trace de "beta_feature" a 1 source de type "user"

  Scenario: Non-admin reçoit 401 sur les endpoints admin features
    Given je ne suis pas authentifié
    When je requête GET /api/admin/features sans token
    Then la réponse a le statut 401

  Scenario: Suppression d'assignation directe fait retomber la résolution à false
    Given il existe un utilisateur avec l'ID "user-ff-delete-test"
    And je suis authentifié en tant qu'admin
    And l'utilisateur "user-ff-delete-test" a une assignation directe "debug_mode" à true
    When l'admin requête DELETE /api/admin/users/user-ff-delete-test/features/debug_mode
    Then la réponse a le statut 204
    When l'admin requête GET /api/admin/users/user-ff-delete-test/features
    Then la trace de "debug_mode" a resolved à false
    And la trace de "debug_mode" a 0 sources

  Scenario: Admin assigne une feature à un rôle et supprime l'assignation (AC3)
    Given je suis authentifié en tant qu'admin
    And il existe un rôle avec l'ID "role-ff-test"
    When l'admin requête PUT /api/admin/roles/role-ff-test/features/debug_mode avec value true
    Then la réponse a le statut 200
    And la réponse contient source "role"
    When l'admin requête GET /api/admin/roles/role-ff-test/features
    Then la réponse a le statut 200
    And la liste d'assignations contient "debug_mode" à true
    When l'admin requête DELETE /api/admin/roles/role-ff-test/features/debug_mode
    Then la réponse a le statut 204

  Scenario: Admin assigne une feature à une permission et supprime l'assignation (AC4)
    Given je suis authentifié en tant qu'admin
    And il existe une permission avec l'ID "perm-ff-test"
    When l'admin requête PUT /api/admin/permissions/perm-ff-test/features/news_tab avec value true
    Then la réponse a le statut 200
    And la réponse contient source "permission"
    When l'admin requête GET /api/admin/permissions/perm-ff-test/features
    Then la réponse a le statut 200
    And la liste d'assignations contient "news_tab" à true
    When l'admin requête DELETE /api/admin/permissions/perm-ff-test/features/news_tab
    Then la réponse a le statut 204
