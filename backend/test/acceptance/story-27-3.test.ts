/**
 * Story 27.3: PAT Admin — Gestion des PATs par utilisateur (support)
 * BDD acceptance tests — AC2 à AC6
 *
 * Tests vérifient:
 * - Admin crée PAT → audit log 'create' en base (AC2 + AC5)
 * - Admin révoque PAT → audit log 'revoke' en base (AC3 + AC5)
 * - Admin renouvelle PAT → audit log 'renew' en base (AC4 + AC5)
 * - Admin consulte GET /api/auth/pat/audit?userId= → liste logs (AC5)
 * - Admin cible un autre admin → 403 (AC6)
 *
 * Note: Les IDs utilisateur sont des UUIDs v7 générés dynamiquement.
 * Les labels Gherkin (admin-27-3-*) servent d'emails pour le cleanup.
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockAuth } = require('better-auth') as {
  __mockAuth: { api: { getSession: jest.Mock } };
};

const feature = loadFeature(
  'test/acceptance/features/story-27-3-pat-admin.feature',
);

/** Mock IAuthorizationService adaptatif par scénario */
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

  // IDs courants dans chaque test (UUIDs valides)
  let adminDbId: string;
  let targetDbId: string;
  let targetPatId: string;
  let adminLabel: string;

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
    // Reset : pat.manage = true, pat.admin = false
    mockAuthorizationService.hasPermission.mockImplementation(
      ({ permission }: { permission: string }) =>
        Promise.resolve(permission === 'pat.manage'),
    );
    adminDbId = '';
    targetDbId = '';
    targetPatId = '';
    adminLabel = '';

    // Cleanup par email (évite les problèmes de cast UUID)
    await dataSource.query(
      `DELETE FROM personal_access_tokens WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE '%@story-27-3.test'
      )`,
    );
    await dataSource.query(
      `DELETE FROM pat_audit_logs WHERE admin_id::text IN (
        SELECT id::text FROM users WHERE email LIKE '%@story-27-3.test'
      )`,
    );
    await dataSource.query(
      `DELETE FROM users WHERE email LIKE '%@story-27-3.test'`,
    );
  });

  /** Crée un user en base avec un vrai UUID, retourne cet UUID */
  const createUser = async (label: string): Promise<string> => {
    const dbId = uuidv7();
    await dataSource.query(
      `INSERT INTO users (id, email, status, "pushNotificationsEnabled", "localNotificationsEnabled", "hapticFeedbackEnabled")
       VALUES ($1, $2, 'active', true, true, true)
       ON CONFLICT (id) DO NOTHING`,
      [dbId, `${label}@story-27-3.test`],
    );
    return dbId;
  };

  const mockAdminAuth = (dbId: string, label: string): void => {
    __mockAuth.api.getSession.mockResolvedValue({
      user: {
        id: dbId,
        email: `${label}@story-27-3.test`,
        role: 'admin',
      },
      session: { token: `mock-token-${label}` },
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 1: Admin crée un PAT + audit log 'create'
  // ─────────────────────────────────────────────────────────────────────────

  test("Admin crée un PAT pour un utilisateur et un audit log est enregistré", ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      "l'application est démarrée et connectée à la base de données",
      () => {},
    );

    and(/^un admin authentifié "([^"]*)"$/, async (label: string) => {
      adminLabel = label;
      adminDbId = await createUser(label);
      mockAuthorizationService.hasPermission.mockImplementation(
        ({ userId, permission }: { userId: string; permission: string }) => {
          if (permission === 'pat.manage') return Promise.resolve(true);
          if (permission === 'pat.admin')
            return Promise.resolve(userId === adminDbId);
          return Promise.resolve(false);
        },
      );
      mockAdminAuth(adminDbId, label);
    });

    and(/^un utilisateur cible "([^"]*)"$/, async (label: string) => {
      targetDbId = await createUser(label);
    });

    when("l'admin crée un PAT pour l'utilisateur cible", async () => {
      response = await request(app.getHttpServer())
        .post(`/api/auth/pat?userId=${targetDbId}`)
        .set('Authorization', `Bearer mock-token-${adminLabel}`)
        .send({
          name: 'PAT Admin Create',
          scopes: ['captures:read'],
          expiresInDays: 30,
        });
    });

    then('la réponse a le statut 201', () => {
      expect(response.status).toBe(201);
    });

    and('la réponse contient un champ "token" commençant par "pns_"', () => {
      expect(response.body.token).toBeDefined();
      expect(response.body.token).toMatch(/^pns_/);
    });

    and('un audit log de type "create" est enregistré en base', async () => {
      const rows = await dataSource.query(
        `SELECT * FROM pat_audit_logs WHERE admin_id = $1 AND user_id = $2 AND action = 'create'`,
        [adminDbId, targetDbId],
      );
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 2: Admin révoque un PAT + audit log 'revoke'
  // ─────────────────────────────────────────────────────────────────────────

  test("Admin révoque un PAT et un audit log est enregistré", ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      "l'application est démarrée et connectée à la base de données",
      () => {},
    );

    and(/^un admin authentifié "([^"]*)"$/, async (label: string) => {
      adminLabel = label;
      adminDbId = await createUser(label);
      mockAuthorizationService.hasPermission.mockImplementation(
        ({ userId, permission }: { userId: string; permission: string }) => {
          if (permission === 'pat.manage') return Promise.resolve(true);
          if (permission === 'pat.admin')
            return Promise.resolve(userId === adminDbId);
          return Promise.resolve(false);
        },
      );
      mockAdminAuth(adminDbId, label);
    });

    and(/^un utilisateur cible "([^"]*)"$/, async (label: string) => {
      targetDbId = await createUser(label);
    });

    and("cet utilisateur cible a un PAT existant", async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/auth/pat?userId=${targetDbId}`)
        .set('Authorization', `Bearer mock-token-${adminLabel}`)
        .send({
          name: 'PAT à révoquer',
          scopes: ['captures:read'],
          expiresInDays: 7,
        });
      expect(createResponse.status).toBe(201);
      targetPatId = createResponse.body.pat.id as string;
    });

    when("l'admin révoque ce PAT", async () => {
      response = await request(app.getHttpServer())
        .delete(`/api/auth/pat/${targetPatId}?userId=${targetDbId}`)
        .set('Authorization', `Bearer mock-token-${adminLabel}`);
    });

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('un audit log de type "revoke" est enregistré en base', async () => {
      const rows = await dataSource.query(
        `SELECT * FROM pat_audit_logs WHERE admin_id = $1 AND user_id = $2 AND action = 'revoke'`,
        [adminDbId, targetDbId],
      );
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 3: Admin renouvelle un PAT + audit log 'renew'
  // ─────────────────────────────────────────────────────────────────────────

  test("Admin renouvelle un PAT et un audit log est enregistré", ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      "l'application est démarrée et connectée à la base de données",
      () => {},
    );

    and(/^un admin authentifié "([^"]*)"$/, async (label: string) => {
      adminLabel = label;
      adminDbId = await createUser(label);
      mockAuthorizationService.hasPermission.mockImplementation(
        ({ userId, permission }: { userId: string; permission: string }) => {
          if (permission === 'pat.manage') return Promise.resolve(true);
          if (permission === 'pat.admin')
            return Promise.resolve(userId === adminDbId);
          return Promise.resolve(false);
        },
      );
      mockAdminAuth(adminDbId, label);
    });

    and(/^un utilisateur cible "([^"]*)"$/, async (label: string) => {
      targetDbId = await createUser(label);
    });

    and("cet utilisateur cible a un PAT existant", async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/auth/pat?userId=${targetDbId}`)
        .set('Authorization', `Bearer mock-token-${adminLabel}`)
        .send({
          name: 'PAT à renouveler',
          scopes: ['captures:read'],
          expiresInDays: 7,
        });
      expect(createResponse.status).toBe(201);
      targetPatId = createResponse.body.pat.id as string;
    });

    when("l'admin renouvelle ce PAT", async () => {
      response = await request(app.getHttpServer())
        .post(`/api/auth/pat/${targetPatId}/renew?userId=${targetDbId}`)
        .set('Authorization', `Bearer mock-token-${adminLabel}`)
        .send({ expiresInDays: 60 });
    });

    then('la réponse a le statut 201', () => {
      expect(response.status).toBe(201);
    });

    and(
      'la réponse contient un nouveau champ "token" commençant par "pns_"',
      () => {
        expect(response.body.token).toBeDefined();
        expect(response.body.token).toMatch(/^pns_/);
      },
    );

    and('un audit log de type "renew" est enregistré en base', async () => {
      const rows = await dataSource.query(
        `SELECT * FROM pat_audit_logs WHERE admin_id = $1 AND user_id = $2 AND action = 'renew'`,
        [adminDbId, targetDbId],
      );
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 4: Admin consulte les audit logs
  // ─────────────────────────────────────────────────────────────────────────

  test("Admin consulte les audit logs d'un utilisateur", ({
    given,
    and,
    when,
    then,
  }) => {
    given(
      "l'application est démarrée et connectée à la base de données",
      () => {},
    );

    and(/^un admin authentifié "([^"]*)"$/, async (label: string) => {
      adminLabel = label;
      adminDbId = await createUser(label);
      mockAuthorizationService.hasPermission.mockImplementation(
        ({ userId, permission }: { userId: string; permission: string }) => {
          if (permission === 'pat.manage') return Promise.resolve(true);
          if (permission === 'pat.admin')
            return Promise.resolve(userId === adminDbId);
          return Promise.resolve(false);
        },
      );
      mockAdminAuth(adminDbId, label);
    });

    and(/^un utilisateur cible "([^"]*)"$/, async (label: string) => {
      targetDbId = await createUser(label);
    });

    and("l'admin a créé un PAT pour l'utilisateur cible", async () => {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/auth/pat?userId=${targetDbId}`)
        .set('Authorization', `Bearer mock-token-${adminLabel}`)
        .send({
          name: 'PAT pour audit',
          scopes: ['captures:read'],
          expiresInDays: 7,
        });
      expect(createResponse.status).toBe(201);
    });

    when("l'admin consulte les audit logs de l'utilisateur cible", async () => {
      response = await request(app.getHttpServer())
        .get(`/api/auth/pat/audit?userId=${targetDbId}`)
        .set('Authorization', `Bearer mock-token-${adminLabel}`);
    });

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and("la réponse est un tableau contenant au moins un log d'audit", () => {
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      const log = (response.body as Record<string, unknown>[])[0];
      expect(log['action']).toBe('create');
      expect(log['userId']).toBe(targetDbId);
      expect(log['adminId']).toBe(adminDbId);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 5: Admin tente de gérer les PATs d'un autre admin → 403
  // ─────────────────────────────────────────────────────────────────────────

  test("Admin tente de gérer les PATs d'un autre admin et reçoit 403", ({
    given,
    and,
    when,
    then,
  }) => {
    let targetAdminDbId: string;

    given(
      "l'application est démarrée et connectée à la base de données",
      () => {},
    );

    and(/^un admin authentifié "([^"]*)"$/, async (label: string) => {
      adminLabel = label;
      adminDbId = await createUser(label);
      // Les deux sont admins : pat.admin = true pour tout le monde
      mockAuthorizationService.hasPermission.mockImplementation(
        ({ permission }: { permission: string }) => {
          if (permission === 'pat.manage') return Promise.resolve(true);
          if (permission === 'pat.admin') return Promise.resolve(true);
          return Promise.resolve(false);
        },
      );
      mockAdminAuth(adminDbId, label);
    });

    and(/^un utilisateur cible admin "([^"]*)"$/, async (label: string) => {
      targetAdminDbId = await createUser(label);
    });

    when("l'admin tente de lister les PATs de l'admin cible", async () => {
      response = await request(app.getHttpServer())
        .get(`/api/auth/pat?userId=${targetAdminDbId}`)
        .set('Authorization', `Bearer mock-token-${adminLabel}`);
    });

    then('la réponse a le statut 403', () => {
      expect(response.status).toBe(403);
    });
  });
});
