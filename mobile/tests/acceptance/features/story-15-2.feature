# Story 15.2: Migration Client Mobile — Better Auth + AuthTokenManager
Feature: Better Auth Mobile Client

  Background:
    Given the Better Auth server is configured at "http://localhost:3000"

  # === AC2: Login fonctionnel ===
  Scenario: Login email/password succès
    Given no active session exists
    When the user logs in with email "user@example.com" and password "Password123!"
    Then the login succeeds
    And access token is stored in SecureStore
    And refresh token is stored in SecureStore

  # === AC2: Logout fonctionnel ===
  Scenario: Logout efface les tokens SecureStore
    Given an active session with tokens in SecureStore
    When the user logs out
    Then the logout succeeds
    And access token is removed from SecureStore
    And refresh token is removed from SecureStore

  # === AC3: Tokens dans SecureStore ===
  Scenario: Token valide retourné directement sans refresh
    Given a valid (non-expired) access token stored in SecureStore
    When the app requests a valid token
    Then the existing access token is returned
    And no refresh request is made

  # === AC4: AuthTokenManager offline — même jour (avant 23:59) ===
  Scenario: Token expiré hors réseau — même jour avant minuit
    Given an expired access token stored in SecureStore
    And the network is unavailable
    And the current time is "14:00" (before midnight)
    When the app requests a valid token
    Then the expired token is returned as valid (offline mode)
    And no logout is triggered

  # === AC4/5: Midnight expiry ===
  Scenario: Token expiré hors réseau — minuit dépassé
    Given an expired access token stored in SecureStore
    And the network is unavailable
    And the current time is "00:01" of the next day
    When the app requests a valid token
    Then an auth error is returned
    And the tokens are cleared from SecureStore

  # === AC4: Refresh automatique quand réseau OK ===
  Scenario: Token expiré réseau disponible — refresh automatique
    Given an expired access token stored in SecureStore
    And the network is available
    And the refresh endpoint returns a new token
    When the app requests a valid token
    Then a refresh request is made
    And the new access token is stored in SecureStore
    And the new access token is returned

  # === AC5: Token révoqué — logout immédiat ===
  Scenario: Token révoqué — logout immédiat sans fallback offline
    Given an expired access token stored in SecureStore
    And the network is available
    And the refresh endpoint returns 401 (token revoked)
    When the app requests a valid token
    Then an auth error is returned
    And the tokens are cleared from SecureStore

  # === AC6: Refresh au retour du réseau ===
  Scenario: Refresh automatique au retour du réseau
    Given an expired access token stored in SecureStore
    And the network was unavailable but is now available
    And the refresh endpoint returns a new token
    When the app requests a valid token
    Then a refresh request is made
    And the new access token is returned
