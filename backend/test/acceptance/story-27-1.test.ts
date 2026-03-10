/**
 * Story 27.1: PAT Backend — Personal Access Tokens
 * BDD acceptance tests — AC1 à AC9
 *
 * Tests vérifient:
 * - Génération PAT avec token en clair (AC1)
 * - Validation scope invalide → 400 (AC2)
 * - Listage sans token_hash (AC3)
 * - Modification nom/scopes (AC4)
 * - Renew atomique (AC5)
 * - Révocation (AC6)
 * - Admin peut gérer les PATs d'un utilisateur non-admin via ?userId= (AC9)
 *
 * Pattern auth: override __mockAuth.api.getSession par scénario
 * IAuthorizationService est mocké pour isoler les tests de la base de permissions
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockAuth } = require('better-auth') as {
  __mockAuth: { api: { getSession: jest.Mock } };
};

const feature = loadFeature(
  'test/acceptance/features/story-27-1-pat-backend.feature',
);

/** Mock IAuthorizationService : pat.manage = true, pat.admin = false par défaut */
const mockAuthorizationService = {
  hasPermission: jest.fn(({ permission }: { permission: string }) =>
    Promise.resolve(permission === 'pat.manage'),
  ),
  getUserPermissions: jest.fn().mockResolvedValue(['pat.manage']),
  isResourceOwner: jest.fn().mockResolvedValue(false),
  shareResource: jest.fn().mockResolvedValue(undefined),
  revokeShare: jest.fn().mockResolvedValue(undefined),
};

defineFeature(feature, (test) => {
  let app: INestApplication;
  let dataSource: DataSource;
  let response: request.Response;
  let createdPatId: string;
  let createdToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('IAuthorizationService')
      .useValue(mockAuthorizationService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    __mockAuth.api.getSession.mockResolvedValue(null);
    // Réinitialiser IAuthorizationService : pat.manage = true, pat.admin = false
    mockAuthorizationService.hasPermission.mockImplementation(
      ({ permission }: { permission: string }) =>
        Promise.resolve(permission === 'pat.manage'),
    );
    createdPatId = '';
    createdToken = '';

    await dataSource.query(
      `DELETE FROM personal_access_tokens WHERE user_id LIKE 'user-pat-%'`,
    );
    await dataSource.query(
      `DELETE FROM users WHERE email LIKE '%@story-27-1.test'`,
    );
  });

  const createTestUser = async (userId: string): Promise<void> => {
    await dataSource.query(
      `INSERT INTO users (id, email, status, "pushNotificationsEnabled", "localNotificationsEnabled", "hapticFeedbackEnabled")
       VALUES ($1, $2, 'active', true, true, true)
       ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@story-27-1.test`],
    );
  };

  const mockAuthFor = (userId: string): void => {
    __mockAuth.api.getSession.mockResolvedValue({
      user: {
        id: userId,
        email: `${userId}@story-27-1.test`,
        role: 'user',
      },
      session: { token: `mock-token-${userId}` },
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 1: Création d'un PAT valide
  // ─────────────────────────────────────────────────────────────────────────

  test('Création d\'un PAT valide retourne le token en clair une seule fois', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      'l\'application est démarrée et connectée à la base de données',
      () => {
        // app est déjà initialisée dans beforeAll
      },
    );

    given(
      'un utilisateur authentifié avec l\'ID "user-pat-create"',
      async () => {
        await createTestUser('user-pat-create');
        mockAuthFor('user-pat-create');
      },
    );

    when(
      'il crée un PAT avec le nom "Mon PAT MCP" et les scopes "captures:read,thoughts:read" et expiresInDays 30',
      async () => {
        response = await request(app.getHttpServer())
          .post('/api/auth/pat')
          .set('Authorization', 'Bearer mock-token')
          .send({
            name: 'Mon PAT MCP',
            scopes: ['captures:read', 'thoughts:read'],
            expiresInDays: 30,
          });
      },
    );

    then('la réponse a le statut 201', () => {
      expect(response.status).toBe(201);
    });

    and('la réponse contient un champ "token" commençant par "pns_"', () => {
      expect(response.body.token).toBeDefined();
      expect(response.body.token).toMatch(/^pns_/);
    });

    and(
      'la réponse contient un objet "pat" avec le nom "Mon PAT MCP"',
      () => {
        expect(response.body.pat).toBeDefined();
        expect(response.body.pat.name).toBe('Mon PAT MCP');
      },
    );

    and('la réponse ne contient pas de champ "tokenHash"', () => {
      expect(response.body.tokenHash).toBeUndefined();
      expect(response.body.pat?.tokenHash).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 2: Scope invalide → 400
  // ─────────────────────────────────────────────────────────────────────────

  test('Création avec un scope invalide retourne 400', ({
    given,
    when,
    then,
  }) => {
    given(
      'l\'application est démarrée et connectée à la base de données',
      () => {},
    );

    given(
      'un utilisateur authentifié avec l\'ID "user-pat-invalid-scope"',
      async () => {
        await createTestUser('user-pat-invalid-scope');
        mockAuthFor('user-pat-invalid-scope');
      },
    );

    when(
      'il crée un PAT avec le nom "Mauvais scope" et les scopes "admin:all" et expiresInDays 30',
      async () => {
        response = await request(app.getHttpServer())
          .post('/api/auth/pat')
          .set('Authorization', 'Bearer mock-token')
          .send({
            name: 'Mauvais scope',
            scopes: ['admin:all'],
            expiresInDays: 30,
          });
      },
    );

    then('la réponse a le statut 400', () => {
      expect(response.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 3: Listage sans token_hash
  // ─────────────────────────────────────────────────────────────────────────

  test('Le listage des PATs ne retourne pas le token_hash', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'l\'application est démarrée et connectée à la base de données',
      () => {},
    );

    given(
      'un utilisateur authentifié avec l\'ID "user-pat-list"',
      async () => {
        await createTestUser('user-pat-list');
        mockAuthFor('user-pat-list');
      },
    );

    and('cet utilisateur a déjà un PAT créé', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/auth/pat')
        .set('Authorization', 'Bearer mock-token')
        .send({
          name: 'PAT de test',
          scopes: ['captures:read'],
          expiresInDays: 7,
        });
      expect(createResponse.status).toBe(201);
      createdPatId = createResponse.body.pat.id as string;
    });

    when('il liste ses PATs via GET /api/auth/pat', async () => {
      response = await request(app.getHttpServer())
        .get('/api/auth/pat')
        .set('Authorization', 'Bearer mock-token');
    });

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('la réponse est un tableau', () => {
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    and('aucun élément du tableau ne contient le champ "tokenHash"', () => {
      for (const pat of response.body as Record<string, unknown>[]) {
        expect(pat['tokenHash']).toBeUndefined();
        expect(pat['token_hash']).toBeUndefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 4: Modification nom/scopes
  // ─────────────────────────────────────────────────────────────────────────

  test('Modification du nom et des scopes d\'un PAT existant', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'l\'application est démarrée et connectée à la base de données',
      () => {},
    );

    given(
      'un utilisateur authentifié avec l\'ID "user-pat-update"',
      async () => {
        await createTestUser('user-pat-update');
        mockAuthFor('user-pat-update');
      },
    );

    and('cet utilisateur a déjà un PAT créé', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/auth/pat')
        .set('Authorization', 'Bearer mock-token')
        .send({
          name: 'Ancien Nom',
          scopes: ['captures:read'],
          expiresInDays: 7,
        });
      expect(createResponse.status).toBe(201);
      createdPatId = createResponse.body.pat.id as string;
    });

    when(
      'il modifie ce PAT avec le nom "Nouveau Nom" et les scopes "todos:read"',
      async () => {
        response = await request(app.getHttpServer())
          .patch(`/api/auth/pat/${createdPatId}`)
          .set('Authorization', 'Bearer mock-token')
          .send({
            name: 'Nouveau Nom',
            scopes: ['todos:read'],
          });
      },
    );

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('la réponse contient un objet "pat" avec le nom "Nouveau Nom"', () => {
      // Le PATCH retourne directement le PAT modifié (pas enveloppé dans "pat")
      const pat =
        (response.body.pat as { name: string } | undefined) ??
        (response.body as { name: string });
      expect(pat.name).toBe('Nouveau Nom');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 5: Renew atomique
  // ─────────────────────────────────────────────────────────────────────────

  test('Le renew crée un nouveau token et révoque l\'ancien atomiquement', ({
    given,
    and,
    when,
    then,
  }) => {
    let oldPatId: string;

    given(
      'l\'application est démarrée et connectée à la base de données',
      () => {},
    );

    given(
      'un utilisateur authentifié avec l\'ID "user-pat-renew"',
      async () => {
        await createTestUser('user-pat-renew');
        mockAuthFor('user-pat-renew');
      },
    );

    and('cet utilisateur a déjà un PAT créé', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/auth/pat')
        .set('Authorization', 'Bearer mock-token')
        .send({
          name: 'PAT à renouveler',
          scopes: ['captures:read'],
          expiresInDays: 7,
        });
      expect(createResponse.status).toBe(201);
      oldPatId = createResponse.body.pat.id as string;
      createdToken = createResponse.body.token as string;
    });

    when('il renouvelle ce PAT avec expiresInDays 60', async () => {
      response = await request(app.getHttpServer())
        .post(`/api/auth/pat/${oldPatId}/renew`)
        .set('Authorization', 'Bearer mock-token')
        .send({ expiresInDays: 60 });
    });

    then('la réponse a le statut 201', () => {
      expect(response.status).toBe(201);
    });

    and('la réponse contient un champ "token" commençant par "pns_"', () => {
      expect(response.body.token).toBeDefined();
      expect(response.body.token).toMatch(/^pns_/);
      // Le nouveau token doit être différent de l'ancien
      expect(response.body.token).not.toBe(createdToken);
    });

    and('l\'ancien PAT est marqué comme révoqué en base de données', async () => {
      const rows = await dataSource.query(
        `SELECT revoked_at FROM personal_access_tokens WHERE id = $1`,
        [oldPatId],
      );
      expect(rows[0].revoked_at).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 6: Révocation
  // ─────────────────────────────────────────────────────────────────────────

  test('Un PAT révoqué est marqué comme révoqué en base de données', ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      'l\'application est démarrée et connectée à la base de données',
      () => {},
    );

    given(
      'un utilisateur authentifié avec l\'ID "user-pat-revoke"',
      async () => {
        await createTestUser('user-pat-revoke');
        mockAuthFor('user-pat-revoke');
      },
    );

    and('cet utilisateur a déjà un PAT créé', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/auth/pat')
        .set('Authorization', 'Bearer mock-token')
        .send({
          name: 'PAT à révoquer',
          scopes: ['captures:read'],
          expiresInDays: 7,
        });
      expect(createResponse.status).toBe(201);
      createdPatId = createResponse.body.pat.id as string;
    });

    when('il révoque ce PAT via DELETE /api/auth/pat/:id', async () => {
      response = await request(app.getHttpServer())
        .delete(`/api/auth/pat/${createdPatId}`)
        .set('Authorization', 'Bearer mock-token');
    });

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('ce PAT est marqué comme révoqué en base de données', async () => {
      const rows = await dataSource.query(
        `SELECT revoked_at FROM personal_access_tokens WHERE id = $1`,
        [createdPatId],
      );
      expect(rows[0].revoked_at).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 7: AC9 — Admin peut gérer les PATs d'un autre utilisateur
  // ─────────────────────────────────────────────────────────────────────────

  test('Un admin peut lister les PATs d\'un autre utilisateur via ?userId', ({
    given,
    and,
    when,
    then,
  }) => {
    let targetUserId: string;

    given(
      'l\'application est démarrée et connectée à la base de données',
      () => {},
    );

    given('un admin authentifié avec l\'ID "admin-pat-test"', async () => {
      await createTestUser('admin-pat-test');
      // L'admin a pat.manage ET pat.admin, la cible (user normal) n'a que pat.manage
      mockAuthorizationService.hasPermission.mockImplementation(
        ({ userId, permission }: { userId: string; permission: string }) => {
          if (permission === 'pat.manage') return Promise.resolve(true);
          if (permission === 'pat.admin') {
            // Seul l'admin a pat.admin — la cible (user normal) ne l'a pas
            return Promise.resolve(userId === 'admin-pat-test');
          }
          return Promise.resolve(false);
        },
      );
      __mockAuth.api.getSession.mockResolvedValue({
        user: {
          id: 'admin-pat-test',
          email: 'admin-pat-test@story-27-1.test',
          role: 'admin',
        },
        session: { token: 'mock-token-admin' },
      });
    });

    and('un utilisateur cible avec l\'ID "target-user-pat"', async () => {
      targetUserId = 'target-user-pat';
      await createTestUser(targetUserId);
    });

    and('cet utilisateur cible a déjà un PAT créé', async () => {
      // Créer un PAT en tant que l'utilisateur cible
      __mockAuth.api.getSession.mockResolvedValue({
        user: {
          id: targetUserId,
          email: `${targetUserId}@story-27-1.test`,
          role: 'user',
        },
        session: { token: 'mock-token-target' },
      });
      const createResponse = await request(app.getHttpServer())
        .post('/api/auth/pat')
        .set('Authorization', 'Bearer mock-token-target')
        .send({
          name: 'PAT de la cible',
          scopes: ['captures:read'],
          expiresInDays: 7,
        });
      expect(createResponse.status).toBe(201);
      createdPatId = createResponse.body.pat.id as string;

      // Repasser en admin pour la suite
      __mockAuth.api.getSession.mockResolvedValue({
        user: {
          id: 'admin-pat-test',
          email: 'admin-pat-test@story-27-1.test',
          role: 'admin',
        },
        session: { token: 'mock-token-admin' },
      });
    });

    when(
      'l\'admin liste les PATs de l\'utilisateur cible via GET /api/auth/pat?userId=target-user-pat',
      async () => {
        response = await request(app.getHttpServer())
          .get(`/api/auth/pat?userId=${targetUserId}`)
          .set('Authorization', 'Bearer mock-token-admin');
      },
    );

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('la réponse est un tableau contenant le PAT de l\'utilisateur cible', () => {
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      const ids = (response.body as { id: string }[]).map((p) => p.id);
      expect(ids).toContain(createdPatId);
    });
  });
});
