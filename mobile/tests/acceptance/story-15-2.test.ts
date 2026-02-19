/**
 * Story 15.2: Migration Client Mobile — Better Auth + AuthTokenManager
 * Acceptance Tests (BDD/Gherkin)
 *
 * Pattern: jest-cucumber (BDD)
 * Mocks: SecureStore (expo-secure-store), fetch (réseau), date/heure
 * ADR-022: SecureStore pour tokens (jamais AsyncStorage)
 * ADR-023: Result Pattern (jamais throw)
 * ADR-025: fetch natif uniquement
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import { RepositoryResultType } from '../../src/contexts/shared/domain/Result';
type AnyResult = { type: RepositoryResultType; data?: unknown; error?: string };

// ── Mock expo-secure-store ──────────────────────────────────────────────────
const secureStore: Record<string, string> = {};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => secureStore[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStore[key] = value;
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    delete secureStore[key];
  }),
}));

// ── Mock fetch global ───────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Mock authClient (Better Auth) ───────────────────────────────────────────
const mockSignIn = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../src/infrastructure/auth/auth-client', () => ({
  authClient: {
    signIn: {
      email: (...args: unknown[]) => mockSignIn(...args),
    },
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
const TOKEN_KEYS = {
  ACCESS_TOKEN: 'ba_access_token',
  REFRESH_TOKEN: 'ba_refresh_token',
  EXPIRES_AT: 'ba_token_expires_at',
};

function resetStore() {
  Object.keys(secureStore).forEach((k) => delete secureStore[k]);
}

function storeExpiredToken() {
  secureStore[TOKEN_KEYS.ACCESS_TOKEN] = 'expired-access-token';
  secureStore[TOKEN_KEYS.REFRESH_TOKEN] = 'old-refresh-token';
  // expiré il y a 1h
  secureStore[TOKEN_KEYS.EXPIRES_AT] = String(Date.now() - 3600 * 1000);
}

function storeValidToken() {
  secureStore[TOKEN_KEYS.ACCESS_TOKEN] = 'valid-access-token';
  secureStore[TOKEN_KEYS.REFRESH_TOKEN] = 'valid-refresh-token';
  // expire dans 1h
  secureStore[TOKEN_KEYS.EXPIRES_AT] = String(Date.now() + 3600 * 1000);
}

// ── Feature ─────────────────────────────────────────────────────────────────
const feature = loadFeature(
  'tests/acceptance/features/story-15-2.feature',
);

defineFeature(feature, (test) => {
  let result: AnyResult | null = null;
  let isNetworkAvailable = true;
  let mockNow: number = Date.now();
  let dateSpy: jest.SpyInstance | null = null;

  beforeEach(() => {
    resetStore();
    mockFetch.mockReset();
    mockSignIn.mockReset();
    mockSignOut.mockReset();
    result = null;
    isNetworkAvailable = true;
    mockNow = Date.now();
    if (dateSpy) {
      dateSpy.mockRestore();
      dateSpy = null;
    }
  });

  afterEach(() => {
    if (dateSpy) {
      dateSpy.mockRestore();
      dateSpy = null;
    }
  });

  // ── Background ─────────────────────────────────────────────────────────
  const defineBackground = (given: (stepText: string, callback: () => void) => void) => {
    given('the Better Auth server is configured at "http://localhost:3000"', () => {
      process.env.EXPO_PUBLIC_BETTER_AUTH_URL = 'http://localhost:3000';
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 1: Login email/password succès
  // ══════════════════════════════════════════════════════════════════════════
  test('Login email/password succès', ({ given, when, then, and }) => {
    defineBackground(given);

    given('no active session exists', () => {
      resetStore();
    });

    when(
      'the user logs in with email "user@example.com" and password "Password123!"',
      async () => {
        // Mock a successful sign-in response
        mockSignIn.mockResolvedValueOnce({
          data: {
            token: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
          },
          error: null,
        });

        const { AuthTokenManager } = require('../../src/infrastructure/auth/AuthTokenManager');
        const { BetterAuthService } = require('../../src/infrastructure/auth/BetterAuthService');
        const service = new BetterAuthService(new AuthTokenManager());
        const loginResult = await service.signIn('user@example.com', 'Password123!');
        result = loginResult as AnyResult;
      },
    );

    then('the login succeeds', () => {
      expect(result?.type).toBe(RepositoryResultType.SUCCESS);
    });

    and('access token is stored in SecureStore', () => {
      expect(secureStore[TOKEN_KEYS.ACCESS_TOKEN]).toBeTruthy();
    });

    and('refresh token is stored in SecureStore', () => {
      expect(secureStore[TOKEN_KEYS.REFRESH_TOKEN]).toBeTruthy();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 2: Logout efface les tokens SecureStore
  // ══════════════════════════════════════════════════════════════════════════
  test('Logout efface les tokens SecureStore', ({ given, when, then, and }) => {
    defineBackground(given);

    given('an active session with tokens in SecureStore', () => {
      storeValidToken();
    });

    when('the user logs out', async () => {
      mockSignOut.mockResolvedValueOnce({ error: null });

      const { AuthTokenManager } = require('../../src/infrastructure/auth/AuthTokenManager');
      const { BetterAuthService } = require('../../src/infrastructure/auth/BetterAuthService');
      const service = new BetterAuthService(new AuthTokenManager());
      const logoutResult = await service.signOut();
      result = logoutResult as AnyResult;
    });

    then('the logout succeeds', () => {
      expect(result?.type).toBe(RepositoryResultType.SUCCESS);
    });

    and('access token is removed from SecureStore', () => {
      expect(secureStore[TOKEN_KEYS.ACCESS_TOKEN]).toBeUndefined();
    });

    and('refresh token is removed from SecureStore', () => {
      expect(secureStore[TOKEN_KEYS.REFRESH_TOKEN]).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 3: Token valide retourné directement sans refresh
  // ══════════════════════════════════════════════════════════════════════════
  test('Token valide retourné directement sans refresh', ({ given, when, then, and }) => {
    defineBackground(given);

    given('a valid (non-expired) access token stored in SecureStore', () => {
      storeValidToken();
    });

    when('the app requests a valid token', async () => {
      const { AuthTokenManager } = require('../../src/infrastructure/auth/AuthTokenManager');
      const manager = new AuthTokenManager();
      result = await manager.getValidToken();
    });

    then('the existing access token is returned', () => {
      expect(result?.type).toBe(RepositoryResultType.SUCCESS);
      expect(result?.data).toBe('valid-access-token');
    });

    and('no refresh request is made', () => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 4: Token expiré hors réseau — même jour avant minuit
  // ══════════════════════════════════════════════════════════════════════════
  test('Token expiré hors réseau — même jour avant minuit', ({ given, when, then, and }) => {
    defineBackground(given);

    given('an expired access token stored in SecureStore', () => {
      storeExpiredToken();
    });

    given('the network is unavailable', () => {
      // fetch throws TypeError pour simuler absence réseau
      mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    });

    given('the current time is "14:00" (before midnight)', () => {
      const today = new Date();
      mockNow = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        14,
        0,
        0,
        0,
      ).getTime();
      dateSpy = jest.spyOn(Date, 'now').mockReturnValue(mockNow);
    });

    when('the app requests a valid token', async () => {
      const { AuthTokenManager } = require('../../src/infrastructure/auth/AuthTokenManager');
      const manager = new AuthTokenManager();
      result = await manager.getValidToken();
    });

    then('the expired token is returned as valid (offline mode)', () => {
      expect(result?.type).toBe(RepositoryResultType.SUCCESS);
      expect(result?.data).toBe('expired-access-token');
    });

    and('no logout is triggered', () => {
      // Les tokens doivent encore être présents
      expect(secureStore[TOKEN_KEYS.ACCESS_TOKEN]).toBe('expired-access-token');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 5: Token expiré hors réseau — minuit dépassé
  // ══════════════════════════════════════════════════════════════════════════
  test('Token expiré hors réseau — minuit dépassé', ({ given, when, then, and }) => {
    defineBackground(given);

    given('an expired access token stored in SecureStore', () => {
      storeExpiredToken();
    });

    given('the network is unavailable', () => {
      mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    });

    given('the current time is "00:01" of the next day', () => {
      // Simuler le lendemain à 00:01 — après minuit par rapport à l'expiration du token
      // Le token a expiré hier (basé sur EXPIRES_AT), maintenant c'est demain
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      mockNow = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        tomorrow.getDate(),
        0,
        1,
        0,
        0,
      ).getTime();
      dateSpy = jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      // Mettre à jour l'expiration pour qu'elle soit "hier" par rapport au mockNow
      const yesterday = mockNow - 24 * 3600 * 1000;
      secureStore[TOKEN_KEYS.EXPIRES_AT] = String(yesterday - 1000);
    });

    when('the app requests a valid token', async () => {
      const { AuthTokenManager } = require('../../src/infrastructure/auth/AuthTokenManager');
      const manager = new AuthTokenManager();
      result = await manager.getValidToken();
    });

    then('an auth error is returned', () => {
      expect(result?.type).toBe(RepositoryResultType.AUTH_ERROR);
    });

    and('the tokens are cleared from SecureStore', () => {
      expect(secureStore[TOKEN_KEYS.ACCESS_TOKEN]).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 6: Token expiré réseau disponible — refresh automatique
  // ══════════════════════════════════════════════════════════════════════════
  test('Token expiré réseau disponible — refresh automatique', ({ given, when, then, and }) => {
    defineBackground(given);

    given('an expired access token stored in SecureStore', () => {
      storeExpiredToken();
    });

    given('the network is available', () => {
      isNetworkAvailable = true;
    });

    given('the refresh endpoint returns a new token', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 3600,
        }),
      });
    });

    when('the app requests a valid token', async () => {
      const { AuthTokenManager } = require('../../src/infrastructure/auth/AuthTokenManager');
      const manager = new AuthTokenManager();
      result = await manager.getValidToken();
    });

    then('a refresh request is made', () => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/token'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    and('the new access token is stored in SecureStore', () => {
      expect(secureStore[TOKEN_KEYS.ACCESS_TOKEN]).toBe('new-access-token');
    });

    and('the new access token is returned', () => {
      expect(result?.type).toBe(RepositoryResultType.SUCCESS);
      expect(result?.data).toBe('new-access-token');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 7: Token révoqué — logout immédiat sans fallback offline
  // ══════════════════════════════════════════════════════════════════════════
  test('Token révoqué — logout immédiat sans fallback offline', ({ given, when, then, and }) => {
    defineBackground(given);

    given('an expired access token stored in SecureStore', () => {
      storeExpiredToken();
    });

    given('the network is available', () => {
      isNetworkAvailable = true;
    });

    given('the refresh endpoint returns 401 (token revoked)', () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token revoked' }),
      });
    });

    when('the app requests a valid token', async () => {
      const { AuthTokenManager } = require('../../src/infrastructure/auth/AuthTokenManager');
      const manager = new AuthTokenManager();
      result = await manager.getValidToken();
    });

    then('an auth error is returned', () => {
      expect(result?.type).toBe(RepositoryResultType.AUTH_ERROR);
    });

    and('the tokens are cleared from SecureStore', () => {
      expect(secureStore[TOKEN_KEYS.ACCESS_TOKEN]).toBeUndefined();
      expect(secureStore[TOKEN_KEYS.REFRESH_TOKEN]).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 8: Refresh automatique au retour du réseau
  // ══════════════════════════════════════════════════════════════════════════
  test('Refresh automatique au retour du réseau', ({ given, when, then, and }) => {
    defineBackground(given);

    given('an expired access token stored in SecureStore', () => {
      storeExpiredToken();
    });

    given('the network was unavailable but is now available', () => {
      isNetworkAvailable = true;
    });

    given('the refresh endpoint returns a new token', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: 'refreshed-access-token',
          refreshToken: 'refreshed-refresh-token',
          expiresIn: 3600,
        }),
      });
    });

    when('the app requests a valid token', async () => {
      const { AuthTokenManager } = require('../../src/infrastructure/auth/AuthTokenManager');
      const manager = new AuthTokenManager();
      result = await manager.getValidToken();
    });

    then('a refresh request is made', () => {
      expect(mockFetch).toHaveBeenCalled();
    });

    and('the new access token is returned', () => {
      expect(result?.type).toBe(RepositoryResultType.SUCCESS);
      expect(result?.data).toBe('refreshed-access-token');
    });
  });
});
