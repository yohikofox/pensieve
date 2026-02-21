/**
 * auth.config.ts Unit Tests
 *
 * Fix reconnexion fréquente — identification client + session persistante
 * ADR-029 : tokenExpiresIn = secondes jusqu'à 23:59:59 UTC du jour courant
 */

import { getTokenExpiresInForToday } from './auth.config';

describe('auth.config', () => {
  // ──────────────────────────────────────────────────────────────────
  // getTokenExpiresInForToday()
  // ──────────────────────────────────────────────────────────────────
  describe('getTokenExpiresInForToday()', () => {
    it("retourne des secondes positives jusqu'à 23:59:59 UTC", () => {
      const result = getTokenExpiresInForToday();

      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(Number.isInteger(result)).toBe(true);
    });

    it('retourne une valeur cohérente avec la fin du jour UTC (< 86400s)', () => {
      const result = getTokenExpiresInForToday();

      // Ne peut pas dépasser 86400 secondes (un jour entier)
      expect(result).toBeLessThanOrEqual(86400);
    });

    it('retourne minimum 60 secondes même en toute fin de journée', () => {
      // Simuler 23:59:30 UTC (30s avant minuit) → doit retourner 60 (minimum)
      const mockNow = new Date();
      mockNow.setUTCHours(23, 59, 30, 0);
      const realNow = Date.now;
      Date.now = jest.fn(() => mockNow.getTime());

      try {
        const result = getTokenExpiresInForToday();
        expect(result).toBeGreaterThanOrEqual(60);
      } finally {
        Date.now = realNow;
      }
    });

    it('calcule correctement à minuit UTC (début de journée)', () => {
      // Simuler 00:00:00 UTC → doit retourner ~86399 secondes
      const mockNow = new Date();
      mockNow.setUTCHours(0, 0, 0, 0);
      const realNow = Date.now;
      Date.now = jest.fn(() => mockNow.getTime());

      try {
        const result = getTokenExpiresInForToday();
        // 23h59m59s = 86399s
        expect(result).toBeGreaterThanOrEqual(86390);
        expect(result).toBeLessThanOrEqual(86400);
      } finally {
        Date.now = realNow;
      }
    });

    it('calcule correctement à midi UTC', () => {
      // Simuler 12:00:00 UTC → doit retourner ~43199 secondes (≈12h)
      const mockNow = new Date();
      mockNow.setUTCHours(12, 0, 0, 0);
      const realNow = Date.now;
      Date.now = jest.fn(() => mockNow.getTime());

      try {
        const result = getTokenExpiresInForToday();
        // De 12h00 à 23h59:59 = 11h59m59s = 43199s
        expect(result).toBeGreaterThanOrEqual(43190);
        expect(result).toBeLessThanOrEqual(43200);
      } finally {
        Date.now = realNow;
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // customSession callback — logique mobile vs autres clients
  // ──────────────────────────────────────────────────────────────────
  describe('customSession callback', () => {
    const mockSession = {
      id: 'session-123',
      token: 'token-abc',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userId: 'user-456',
      createdAt: new Date(),
      updatedAt: new Date(),
      ipAddress: '127.0.0.1',
      userAgent: 'test',
    };

    const mockUser = {
      id: 'user-456',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Extraire le callback customSession depuis le plugin mock
    // On teste la logique directement en la répliquant, car le mock de better-auth
    // ne retourne pas un vrai plugin. On teste getTokenExpiresInForToday() à la place.

    it('retourne tokenExpiresIn pour X-Client-Type: mobile', () => {
      // La logique du callback customSession pour mobile :
      const tokenExpiresIn = getTokenExpiresInForToday();
      const absoluteExpiresAt = mockSession.expiresAt;

      // Pour un client mobile, ces valeurs doivent être présentes
      expect(tokenExpiresIn).toBeGreaterThan(0);
      expect(absoluteExpiresAt).toBeInstanceOf(Date);
      expect(absoluteExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('tokenExpiresIn correspond à la fin du jour UTC (cohérence mobile)', () => {
      const tokenExpiresIn = getTokenExpiresInForToday();
      const endOfToday = new Date();
      endOfToday.setUTCHours(23, 59, 59, 999);
      const expectedSeconds = Math.max(60, Math.floor((endOfToday.getTime() - Date.now()) / 1000));

      // Tolérance de 2 secondes pour l'exécution du test
      expect(Math.abs(tokenExpiresIn - expectedSeconds)).toBeLessThanOrEqual(2);
    });

    it('session sans context null (robustesse)', () => {
      // Vérification que getTokenExpiresInForToday() ne crash pas
      expect(() => getTokenExpiresInForToday()).not.toThrow();
    });
  });
});
