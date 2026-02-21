import 'reflect-metadata';

/**
 * BetterAuthService Unit Tests
 *
 * Story 15.x — Fix reconnexion fréquente (token end-of-day + session persistante 7j)
 * ADR-029 : Better Auth session-based, tokenExpiresIn = fin du jour UTC
 *
 * Bugs fixés :
 * - Bug 1 : signIn() utilisait expiresIn ?? 3600 → maintenant calcul local fin du jour
 * - Bug 2 : signIn() stockait refreshToken ?? '' → maintenant session token réutilisé
 * - Bug 4 : getSession() ignorait authClient si token invalide → fallback ajouté
 */

import * as SecureStore from 'expo-secure-store';
import { BetterAuthService } from '../BetterAuthService';
import { AuthTokenManager } from '../AuthTokenManager';

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock auth-client
jest.mock('../auth-client', () => ({
  authClient: {
    signIn: {
      email: jest.fn(),
    },
    signOut: jest.fn(),
    getSession: jest.fn(),
  },
}));

import { authClient } from '../auth-client';

const mockSignInEmail = authClient.signIn.email as jest.Mock;
const mockSignOut = authClient.signOut as jest.Mock;
const mockGetSession = authClient.getSession as jest.Mock;
const mockGetItem = SecureStore.getItemAsync as jest.Mock;
const mockSetItem = SecureStore.setItemAsync as jest.Mock;
const mockDeleteItem = SecureStore.deleteItemAsync as jest.Mock;

describe('BetterAuthService', () => {
  let service: BetterAuthService;
  let tokenManager: AuthTokenManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetItem.mockResolvedValue(undefined);
    mockDeleteItem.mockResolvedValue(undefined);
    tokenManager = new AuthTokenManager();
    service = new BetterAuthService(tokenManager);
  });

  // ──────────────────────────────────────────────────────────────────
  // signIn() — fix Bug 1 et Bug 2
  // ──────────────────────────────────────────────────────────────────
  describe('signIn()', () => {
    it('utilise tokenExpiresIn du serveur si disponible', async () => {
      mockSignInEmail.mockResolvedValue({
        data: {
          token: 'session-token-123',
          user: { id: 'user-456' },
          session: { tokenExpiresIn: 7200 },  // serveur envoie 7200s
        },
        error: null,
      });

      await service.signIn('test@example.com', 'password');

      const setItemCalls = mockSetItem.mock.calls;
      const expiresAtCall = setItemCalls.find(([key]: [string]) => key === 'ba_token_expires_at');
      expect(expiresAtCall).toBeDefined();

      // L'expiry doit être dans ~7200 secondes depuis maintenant
      const storedExpiry = Number(expiresAtCall[1]);
      const expectedExpiry = Date.now() + 7200 * 1000;
      expect(Math.abs(storedExpiry - expectedExpiry)).toBeLessThan(1000); // ±1s
    });

    it('calcule la fin du jour UTC si le serveur ne fournit pas tokenExpiresIn', async () => {
      mockSignInEmail.mockResolvedValue({
        data: {
          token: 'session-token-abc',
          user: { id: 'user-789' },
          // Pas de session.tokenExpiresIn
        },
        error: null,
      });

      const endOfToday = new Date();
      endOfToday.setUTCHours(23, 59, 59, 999);
      const expectedExpiresIn = Math.max(60, Math.floor((endOfToday.getTime() - Date.now()) / 1000));

      await service.signIn('test@example.com', 'password');

      const setItemCalls = mockSetItem.mock.calls;
      const expiresAtCall = setItemCalls.find(([key]: [string]) => key === 'ba_token_expires_at');
      expect(expiresAtCall).toBeDefined();

      const storedExpiry = Number(expiresAtCall[1]);
      const expectedExpiry = Date.now() + expectedExpiresIn * 1000;
      // Tolérance de 2 secondes pour l'exécution du test
      expect(Math.abs(storedExpiry - expectedExpiry)).toBeLessThan(2000);
    });

    it('stocke le session token comme refreshToken (pas de chaîne vide)', async () => {
      mockSignInEmail.mockResolvedValue({
        data: {
          token: 'session-token-xyz',
          user: { id: 'user-111' },
        },
        error: null,
      });

      await service.signIn('test@example.com', 'password');

      const setItemCalls = mockSetItem.mock.calls;
      const refreshTokenCall = setItemCalls.find(([key]: [string]) => key === 'ba_refresh_token');
      expect(refreshTokenCall).toBeDefined();
      expect(refreshTokenCall[1]).toBe('session-token-xyz');  // session token, pas ''
    });

    it('retourne authError si response.error est défini', async () => {
      mockSignInEmail.mockResolvedValue({
        data: null,
        error: { message: 'Invalid credentials' },
      });

      const result = await service.signIn('bad@example.com', 'wrong');

      expect(result.type).toBe('auth_error');
    });

    it('retourne networkError si la requête lève une exception', async () => {
      mockSignInEmail.mockRejectedValue(new Error('Network error'));

      const result = await service.signIn('test@example.com', 'password');

      expect(result.type).toBe('network_error');
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // getSession() — fix Bug 4
  // ──────────────────────────────────────────────────────────────────
  describe('getSession()', () => {
    it('retourne la session depuis le token valide sans appeler authClient', async () => {
      const futureExpiry = Date.now() + 3600 * 1000;
      mockGetItem.mockImplementation(async (key: string) => {
        if (key === 'ba_access_token') return 'valid-token';
        if (key === 'ba_token_expires_at') return String(futureExpiry);
        if (key === 'ba_user_id') return 'user-stored';
        return null;
      });

      const session = await service.getSession();

      expect(session).not.toBeNull();
      expect(session?.accessToken).toBe('valid-token');
      expect(session?.userId).toBe('user-stored');
      expect(mockGetSession).not.toHaveBeenCalled();
    });

    it('appelle authClient.getSession() si le token local est invalide (expiré)', async () => {
      // Token absent → getValidToken retourne auth_error
      mockGetItem.mockResolvedValue(null);

      mockGetSession.mockResolvedValue({
        data: {
          session: { token: 'server-token', tokenExpiresIn: 3600 },
          user: { id: 'user-from-server' },
        },
        error: null,
      });

      const session = await service.getSession();

      expect(mockGetSession).toHaveBeenCalled();
      expect(session).not.toBeNull();
      expect(session?.accessToken).toBe('server-token');
      expect(session?.userId).toBe('user-from-server');
    });

    it('re-stocke le token avec tokenExpiresIn du serveur après renouvellement', async () => {
      mockGetItem.mockResolvedValue(null);  // Aucun token local

      mockGetSession.mockResolvedValue({
        data: {
          session: { token: 'renewed-token', tokenExpiresIn: 7200 },
          user: { id: 'user-renewed' },
        },
        error: null,
      });

      await service.getSession();

      const setItemCalls = mockSetItem.mock.calls;
      const expiresAtCall = setItemCalls.find(([key]: [string]) => key === 'ba_token_expires_at');
      expect(expiresAtCall).toBeDefined();

      const storedExpiry = Number(expiresAtCall[1]);
      expect(Math.abs(storedExpiry - (Date.now() + 7200 * 1000))).toBeLessThan(1000);
    });

    it('calcule fin du jour si authClient ne retourne pas tokenExpiresIn', async () => {
      mockGetItem.mockResolvedValue(null);

      mockGetSession.mockResolvedValue({
        data: {
          session: { token: 'server-token-no-expiry' },  // pas de tokenExpiresIn
          user: { id: 'user-no-expiry' },
        },
        error: null,
      });

      const session = await service.getSession();

      expect(session).not.toBeNull();
      // L'expiry stocké doit être vers 23:59:59 UTC du jour courant
      const setItemCalls = mockSetItem.mock.calls;
      const expiresAtCall = setItemCalls.find(([key]: [string]) => key === 'ba_token_expires_at');
      expect(expiresAtCall).toBeDefined();

      const storedExpiry = Number(expiresAtCall[1]);
      const endOfToday = new Date();
      endOfToday.setUTCHours(23, 59, 59, 999);
      expect(Math.abs(storedExpiry - endOfToday.getTime())).toBeLessThan(2000);
    });

    it('retourne null si authClient retourne null (hors ligne ou session expirée)', async () => {
      mockGetItem.mockResolvedValue(null);

      mockGetSession.mockResolvedValue({ data: null, error: null });

      const session = await service.getSession();

      expect(session).toBeNull();
    });

    it('retourne null sans crash si authClient lève une exception', async () => {
      mockGetItem.mockResolvedValue(null);

      mockGetSession.mockRejectedValue(new Error('Network unavailable'));

      const session = await service.getSession();

      expect(session).toBeNull();
    });
  });
});
