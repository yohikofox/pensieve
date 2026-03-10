# Story 27.1: PAT Backend — Personal Access Tokens
# AC1: Génération de PAT avec token en clair une seule fois
# AC2: Validation des scopes (liste blanche)
# AC3: Listage sans exposition de token_hash
# AC4: Modification nom/scopes
# AC5: Renew atomique (nouveau token + révocation ancien)
# AC6: Révocation → 401 si réutilisé
# AC7: PATGuard — token valide authentifié
# AC8: PATGuard — scope insuffisant → 403
# AC10: TraceContext enrichi avec patId/userId

Feature: Personal Access Tokens (PAT) Backend

  Background:
    Given l'application est démarrée et connectée à la base de données

  # ─────────────────────────────────────────────────────────────────────────
  # AC1 — Création d'un PAT valide
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Création d'un PAT valide retourne le token en clair une seule fois
    Given un utilisateur authentifié avec l'ID "user-pat-create"
    When il crée un PAT avec le nom "Mon PAT MCP" et les scopes "captures:read,thoughts:read" et expiresInDays 30
    Then la réponse a le statut 201
    And la réponse contient un champ "token" commençant par "pns_"
    And la réponse contient un objet "pat" avec le nom "Mon PAT MCP"
    And la réponse ne contient pas de champ "tokenHash"

  # ─────────────────────────────────────────────────────────────────────────
  # AC2 — Scope invalide → 400
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Création avec un scope invalide retourne 400
    Given un utilisateur authentifié avec l'ID "user-pat-invalid-scope"
    When il crée un PAT avec le nom "Mauvais scope" et les scopes "admin:all" et expiresInDays 30
    Then la réponse a le statut 400

  # ─────────────────────────────────────────────────────────────────────────
  # AC3 — Listage sans token_hash
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Le listage des PATs ne retourne pas le token_hash
    Given un utilisateur authentifié avec l'ID "user-pat-list"
    And cet utilisateur a déjà un PAT créé
    When il liste ses PATs via GET /api/auth/pat
    Then la réponse a le statut 200
    And la réponse est un tableau
    And aucun élément du tableau ne contient le champ "tokenHash"

  # ─────────────────────────────────────────────────────────────────────────
  # AC4 — Modification nom/scopes
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Modification du nom et des scopes d'un PAT existant
    Given un utilisateur authentifié avec l'ID "user-pat-update"
    And cet utilisateur a déjà un PAT créé
    When il modifie ce PAT avec le nom "Nouveau Nom" et les scopes "todos:read"
    Then la réponse a le statut 200
    And la réponse contient un objet "pat" avec le nom "Nouveau Nom"

  # ─────────────────────────────────────────────────────────────────────────
  # AC5 — Renew atomique
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Le renew crée un nouveau token et révoque l'ancien atomiquement
    Given un utilisateur authentifié avec l'ID "user-pat-renew"
    And cet utilisateur a déjà un PAT créé
    When il renouvelle ce PAT avec expiresInDays 60
    Then la réponse a le statut 201
    And la réponse contient un champ "token" commençant par "pns_"
    And l'ancien PAT est marqué comme révoqué en base de données

  # ─────────────────────────────────────────────────────────────────────────
  # AC6 — Révocation → revoked_at set + PAT marqué révoqué
  # Note: la vérification que le PAT révoqué retourne 401 via PATGuard
  # est couverte par les tests unitaires pat.guard.spec.ts (AC6/AC7)
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Un PAT révoqué est marqué comme révoqué en base de données
    Given un utilisateur authentifié avec l'ID "user-pat-revoke"
    And cet utilisateur a déjà un PAT créé
    When il révoque ce PAT via DELETE /api/auth/pat/:id
    Then la réponse a le statut 200
    And ce PAT est marqué comme révoqué en base de données

  # ─────────────────────────────────────────────────────────────────────────
  # AC9 — Admin peut gérer les PATs d'un autre utilisateur (non-admin)
  # Note: la restriction "admin ne peut pas gérer les PATs d'un autre admin"
  # est une action item ouverte (H1) — voir story Tasks section
  # ─────────────────────────────────────────────────────────────────────────

  Scenario: Un admin peut lister les PATs d'un autre utilisateur via ?userId
    Given un admin authentifié avec l'ID "admin-pat-test"
    And un utilisateur cible avec l'ID "target-user-pat"
    And cet utilisateur cible a déjà un PAT créé
    When l'admin liste les PATs de l'utilisateur cible via GET /api/auth/pat?userId=target-user-pat
    Then la réponse a le statut 200
    And la réponse est un tableau contenant le PAT de l'utilisateur cible
