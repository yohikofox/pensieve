# Story 27.3: PAT Admin — Gestion des PATs par utilisateur (support)
# AC2: Admin crée un PAT pour un utilisateur → audit log 'create' enregistré
# AC3: Admin révoque un PAT → audit log 'revoke' enregistré
# AC4: Admin renouvelle un PAT → nouveau token + audit log 'renew'
# AC5: Admin consulte GET /api/auth/pat/audit?userId= → liste des logs
# AC6: Admin ne peut pas gérer les PATs d'un autre admin → 403

Feature: PAT Admin — Gestion des PATs par utilisateur (support)

  Scenario: Admin crée un PAT pour un utilisateur et un audit log est enregistré
    Given l'application est démarrée et connectée à la base de données
    And un admin authentifié "admin-27-3-create"
    And un utilisateur cible "user-27-3-target-create"
    When l'admin crée un PAT pour l'utilisateur cible
    Then la réponse a le statut 201
    And la réponse contient un champ "token" commençant par "pns_"
    And un audit log de type "create" est enregistré en base

  Scenario: Admin révoque un PAT et un audit log est enregistré
    Given l'application est démarrée et connectée à la base de données
    And un admin authentifié "admin-27-3-revoke"
    And un utilisateur cible "user-27-3-target-revoke"
    And cet utilisateur cible a un PAT existant
    When l'admin révoque ce PAT
    Then la réponse a le statut 200
    And un audit log de type "revoke" est enregistré en base

  Scenario: Admin renouvelle un PAT et un audit log est enregistré
    Given l'application est démarrée et connectée à la base de données
    And un admin authentifié "admin-27-3-renew"
    And un utilisateur cible "user-27-3-target-renew"
    And cet utilisateur cible a un PAT existant
    When l'admin renouvelle ce PAT
    Then la réponse a le statut 201
    And la réponse contient un nouveau champ "token" commençant par "pns_"
    And un audit log de type "renew" est enregistré en base

  Scenario: Admin consulte les audit logs d'un utilisateur
    Given l'application est démarrée et connectée à la base de données
    And un admin authentifié "admin-27-3-audit"
    And un utilisateur cible "user-27-3-target-audit"
    And l'admin a créé un PAT pour l'utilisateur cible
    When l'admin consulte les audit logs de l'utilisateur cible
    Then la réponse a le statut 200
    And la réponse est un tableau contenant au moins un log d'audit

  Scenario: Admin tente de gérer les PATs d'un autre admin et reçoit 403
    Given l'application est démarrée et connectée à la base de données
    And un admin authentifié "admin-27-3-forbidden"
    And un utilisateur cible admin "admin-27-3-target-admin"
    When l'admin tente de lister les PATs de l'admin cible
    Then la réponse a le statut 403
