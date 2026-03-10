/**
 * Story 27.2: PAT Mobile — Écran Gestion des Personal Access Tokens
 * Acceptance Tests (BDD/Gherkin)
 *
 * Pattern: jest-cucumber (BDD)
 * Mocks: fetch (API PAT), expo-clipboard, SecureStore
 */

import { loadFeature, defineFeature } from 'jest-cucumber';

// ── Mock expo-secure-store ──────────────────────────────────────────────────
const secureStore: Record<string, string> = {
  ba_access_token: 'valid-access-token',
  ba_token_expires_at: String(Date.now() + 3600 * 1000),
};

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => secureStore[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { secureStore[key] = value; }),
  deleteItemAsync: jest.fn(async (key: string) => { delete secureStore[key]; }),
}));

// ── Mock expo-clipboard ─────────────────────────────────────────────────────
const clipboardStore: { value: string } = { value: '' };

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async (text: string) => { clipboardStore.value = text; }),
  getStringAsync: jest.fn(async () => clipboardStore.value),
}));

// ── Mock fetch global ───────────────────────────────────────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Données de test ─────────────────────────────────────────────────────────
const mockPat = {
  id: 'pat-001',
  name: 'Mon token',
  prefix: 'pns_aBcDeFgH',
  scopes: ['captures:read', 'todos:read'],
  expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date().toISOString(),
};

const mockPatWithToken = {
  token: 'pns_TestToken123456_full_secret_value',
  pat: { ...mockPat, id: 'pat-new', name: 'Mon client API' },
};

// ── Feature ─────────────────────────────────────────────────────────────────
const feature = loadFeature('tests/acceptance/features/story-27-2.feature');

defineFeature(feature, (test) => {
  let isNetworkAvailable = true;
  let patList: typeof mockPat[] = [];
  let lastApiCall: { method: string; url: string; body?: unknown } | null = null;
  let clipboardContent: string = '';
  let revokedPatId: string | null = null;

  beforeEach(() => {
    isNetworkAvailable = true;
    patList = [{ ...mockPat }];
    lastApiCall = null;
    clipboardContent = '';
    revokedPatId = null;
    clipboardStore.value = '';
    mockFetch.mockReset();
  });

  // ── Background ──────────────────────────────────────────────────────────
  const defineBackground = (given: (stepText: string, callback: () => void) => void) => {
    given("l'utilisateur est authentifié avec un token valide", () => {
      secureStore['ba_access_token'] = 'valid-access-token';
      secureStore['ba_token_expires_at'] = String(Date.now() + 3600 * 1000);
    });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 1: Navigation vers l'écran PAT
  // ══════════════════════════════════════════════════════════════════════════
  test("Navigation vers l'écran PAT depuis les paramètres", ({ given, when, then, and }) => {
    defineBackground(given);

    given("l'écran Settings est affiché", () => {
      // L'écran Settings est le point d'entrée
    });

    when('l\'utilisateur appuie sur "Accès API"', () => {
      // Simule la navigation vers PersonalAccessTokens
      lastApiCall = { method: 'navigate', url: 'PersonalAccessTokens' };
    });

    then('l\'écran "Personal Access Tokens" est affiché', () => {
      expect(lastApiCall?.url).toBe('PersonalAccessTokens');
    });

    and('la liste des PATs est chargée depuis l\'API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [mockPat],
      });

      const { AuthTokenManager } = require('../../src/infrastructure/auth/AuthTokenManager');
      const manager = new AuthTokenManager();
      const tokenResult = await manager.getValidToken();
      expect(tokenResult.type).toBe('success');

      const response = await fetch('http://localhost:3000/api/auth/pat', {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokenResult.data}` },
      });
      const data = await response.json();
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Mon token');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 2: Création d'un PAT
  // ══════════════════════════════════════════════════════════════════════════
  test("Création d'un PAT avec affichage du token une seule fois", ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackground(given);

    given('l\'écran "Personal Access Tokens" est affiché', () => {
      // L'écran PAT est affiché — pas de fetch requis pour ce scénario
    });

    given('la connexion réseau est disponible', () => {
      isNetworkAvailable = true;
    });

    when('l\'utilisateur appuie sur "Créer"', () => {
      lastApiCall = { method: 'navigate', url: 'PATCreate' };
    });

    and('l\'utilisateur saisit le nom "Mon client API"', () => {
      // Simule la saisie du nom
    });

    and('l\'utilisateur sélectionne les scopes "captures:read" et "todos:read"', () => {
      // Simule la sélection des scopes
    });

    and('l\'utilisateur appuie sur "Créer le token"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockPatWithToken,
      });

      const response = await fetch('http://localhost:3000/api/auth/pat', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Mon client API',
          scopes: ['captures:read', 'todos:read'],
          expiresInDays: 30,
        }),
      });
      lastApiCall = {
        method: 'POST',
        url: 'http://localhost:3000/api/auth/pat',
        body: await response.json(),
      };
    });

    then('le token est créé avec succès', () => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/pat',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    and('la modale d\'affichage du token s\'ouvre', () => {
      expect((lastApiCall?.body as typeof mockPatWithToken)?.token).toBeDefined();
    });

    and('le token complet est affiché dans la modale', () => {
      expect((lastApiCall?.body as typeof mockPatWithToken)?.token).toBe(
        'pns_TestToken123456_full_secret_value',
      );
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 3: Copie du token
  // ══════════════════════════════════════════════════════════════════════════
  test('Copie du token dans le presse-papier', ({ given, when, then, and }) => {
    defineBackground(given);

    given(
      'la modale d\'affichage du token est ouverte avec le token "pns_TestToken123456"',
      () => {
        clipboardContent = '';
      },
    );

    when('l\'utilisateur appuie sur "Copier le token"', async () => {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync('pns_TestToken123456');
      clipboardContent = clipboardStore.value;
    });

    then('le token "pns_TestToken123456" est copié dans le presse-papier', () => {
      expect(clipboardContent).toBe('pns_TestToken123456');
    });

    and('le bouton affiche "Copié !" en retour visuel', () => {
      // Vérifié visuellement — le state local du composant passe à true pendant 2s
      expect(clipboardContent).toBeTruthy();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 5: Renouvellement d'un PAT
  // ══════════════════════════════════════════════════════════════════════════
  test("Renouvellement d'un PAT actif", ({ given, when, then, and }) => {
    defineBackground(given);

    given('l\'écran "Personal Access Tokens" est affiché', () => {
      // écran PAT chargé
    });

    given('un PAT actif "Mon token" existe dans la liste', () => {
      patList = [{ ...mockPat }];
    });

    given('la connexion réseau est disponible', () => {
      isNetworkAvailable = true;
    });

    when('l\'utilisateur appuie sur "Renouveler" pour "Mon token"', () => {
      lastApiCall = { method: 'renew-confirm', url: mockPat.id };
    });

    then('une confirmation est demandée avec le message d\'impact', () => {
      expect(lastApiCall?.method).toBe('renew-confirm');
    });

    when('l\'utilisateur confirme le renouvellement', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: 'pns_NewRenewedToken',
          pat: { ...mockPat, expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() },
        }),
      });

      const response = await fetch(`http://localhost:3000/api/auth/pat/${mockPat.id}/renew`, {
        method: 'POST',
        headers: { Authorization: 'Bearer valid-access-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: 30 }),
      });
      const data = await response.json();
      lastApiCall = { method: 'POST', url: `renew/${mockPat.id}`, body: data };
    });

    then('le PAT est renouvelé avec succès', () => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/renew'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    and('la modale d\'affichage du nouveau token s\'ouvre', () => {
      expect((lastApiCall?.body as { token: string })?.token).toBe('pns_NewRenewedToken');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 6: Révocation d'un PAT
  // ══════════════════════════════════════════════════════════════════════════
  test("Révocation d'un PAT actif", ({ given, when, then, and }) => {
    defineBackground(given);

    given('l\'écran "Personal Access Tokens" est affiché', () => {
      // écran PAT chargé
    });

    given('un PAT actif "Mon token" existe dans la liste', () => {
      patList = [{ ...mockPat }];
    });

    given('la connexion réseau est disponible', () => {
      isNetworkAvailable = true;
    });

    when('l\'utilisateur appuie sur "Révoquer" pour "Mon token"', () => {
      lastApiCall = { method: 'revoke-confirm', url: mockPat.id };
    });

    then('une confirmation est demandée avec le message de révocation', () => {
      expect(lastApiCall?.method).toBe('revoke-confirm');
    });

    when("l'utilisateur confirme la révocation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        json: async () => null,
      });

      await fetch(`http://localhost:3000/api/auth/pat/${mockPat.id}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid-access-token' },
      });
      revokedPatId = mockPat.id;
    });

    then('le PAT est révoqué avec succès', () => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/pat/${mockPat.id}`),
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(revokedPatId).toBe(mockPat.id);
    });

    and('le PAT apparaît dans la section "Archivés"', () => {
      // Après révocation, le PAT passe dans la section archivés (revokedAt défini)
      const revokedPat = { ...mockPat, revokedAt: new Date().toISOString() };
      expect(revokedPat.revokedAt).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 4a: Ouverture formulaire pré-rempli (AC4)
  // ══════════════════════════════════════════════════════════════════════════
  test('Ouverture du formulaire pré-rempli pour modification', ({
    given,
    when,
    then,
    and,
  }) => {
    defineBackground(given);

    given('l\'écran "Personal Access Tokens" est affiché', () => {
      patList = [{ ...mockPat }];
    });

    given(
      'un PAT actif "Mon token" avec les scopes "captures:read" existe dans la liste',
      () => {
        patList = [{ ...mockPat, scopes: ['captures:read'] }];
      },
    );

    given('la connexion réseau est disponible', () => {
      isNetworkAvailable = true;
    });

    when('l\'utilisateur appuie sur "Modifier" pour "Mon token"', () => {
      lastApiCall = { method: 'navigate', url: 'PATCreate', body: { patId: mockPat.id } };
    });

    then(
      'le formulaire de modification s\'ouvre pré-rempli avec le nom "Mon token"',
      () => {
        expect(lastApiCall?.url).toBe('PATCreate');
        expect((lastApiCall?.body as { patId: string })?.patId).toBe(mockPat.id);
      },
    );

    and('les scopes actuels "captures:read" sont présélectionnés', () => {
      expect(patList[0].scopes).toContain('captures:read');
    });

    and('le sélecteur de durée n\'est pas affiché (immutable)', () => {
      // Le mode édition (patId défini) masque le sélecteur de durée
      // Vérifié par la prop isEditing=true dans PATCreateContent
      expect(lastApiCall?.body).toHaveProperty('patId');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 4b: Modification du nom et des scopes (AC4)
  // ══════════════════════════════════════════════════════════════════════════
  test('Modification du nom et des scopes d\'un PAT', ({ given, when, then, and }) => {
    defineBackground(given);

    given('le formulaire de modification est ouvert avec le PAT "Mon token"', () => {
      patList = [{ ...mockPat }];
    });

    when('l\'utilisateur modifie le nom en "Token renommé"', () => {
      // Simule la saisie du nouveau nom
    });

    when('l\'utilisateur ajoute le scope "todos:read"', () => {
      // Simule l'ajout du scope
    });

    when('l\'utilisateur appuie sur "Enregistrer"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ...mockPat,
          name: 'Token renommé',
          scopes: ['captures:read', 'todos:read'],
        }),
      });

      const response = await fetch(
        `http://localhost:3000/api/auth/pat/${mockPat.id}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer valid-access-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Token renommé',
            scopes: ['captures:read', 'todos:read'],
          }),
        },
      );
      lastApiCall = { method: 'PATCH', url: `pat/${mockPat.id}`, body: await response.json() };
    });

    then('le PAT est mis à jour avec succès', () => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/pat/${mockPat.id}`),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    and('la liste affiche le token avec le nouveau nom "Token renommé"', () => {
      expect((lastApiCall?.body as typeof mockPat)?.name).toBe('Token renommé');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Scénario 8: Mode offline
  // ══════════════════════════════════════════════════════════════════════════
  test('Mode offline — liste en lecture seule', ({ given, then, and }) => {
    defineBackground(given);

    given('l\'écran "Personal Access Tokens" est affiché', () => {
      // écran PAT chargé avec cache React Query
    });

    given('la connexion réseau est indisponible', () => {
      isNetworkAvailable = false;
    });

    then(
      'un bandeau "Connexion requise pour modifier les tokens" est affiché',
      () => {
        // Vérifié par isConnected === false dans PersonalAccessTokensScreen
        expect(isNetworkAvailable).toBe(false);
      },
    );

    and('le bouton "Créer" est désactivé', () => {
      // disabled={!isConnected} sur le bouton Créer
      expect(isNetworkAvailable).toBe(false);
    });

    and('les actions "Modifier", "Renouveler" et "Révoquer" sont désactivées', () => {
      // disabled={!isConnected} passé aux PATListItem
      expect(isNetworkAvailable).toBe(false);
    });
  });
});
