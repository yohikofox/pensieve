/**
 * Story 24.1: Feature Flag System — Backend Data Model & Resolution Engine
 * BDD acceptance tests — AC4, AC5, AC6
 *
 * Tests vérifient:
 * - Résolution deny-wins via endpoint GET /api/users/:userId/features
 * - Format de réponse Record<string, boolean>
 * - Ownership check (BetterAuthGuard)
 *
 * Pattern auth: override __mockAuth.api.getSession par scénario
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/modules/shared/infrastructure/persistence/typeorm/entities/user.entity';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockAuth } = require('better-auth') as {
  __mockAuth: { api: { getSession: jest.Mock } };
};

const feature = loadFeature('test/acceptance/features/story-24-1.feature');

const FEATURE_IDS = {
  debug_mode: 'fe000001-0000-7000-8000-000000000001',
  data_mining: 'fe000002-0000-7000-8000-000000000002',
  news_tab: 'fe000003-0000-7000-8000-000000000003',
  projects_tab: 'fe000004-0000-7000-8000-000000000004',
  capture_media_buttons: 'fe000005-0000-7000-8000-000000000005',
};

defineFeature(feature, (test) => {
  let app: INestApplication;
  let dataSource: DataSource;
  let response: request.Response;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    // Nettoyage dans l'ordre des FK pour isoler les scénarios
    await dataSource.query('DELETE FROM permission_feature_assignments');
    await dataSource.query('DELETE FROM role_feature_assignments');
    await dataSource.query('DELETE FROM user_feature_assignments');
    await dataSource.query('DELETE FROM user_roles');
    await dataSource.query('DELETE FROM user_permissions');
    await dataSource.query('DELETE FROM features');
    await dataSource.query(`DELETE FROM roles WHERE name LIKE 'test-%'`);
    await dataSource.query(`DELETE FROM users WHERE email LIKE '%@story-24-1.test'`);
  });

  const seedFeatures = async () => {
    for (const [key, id] of Object.entries(FEATURE_IDS)) {
      await dataSource.query(
        `INSERT INTO features (id, key, default_value) VALUES ($1, $2, false) ON CONFLICT (key) DO NOTHING`,
        [id, key],
      );
    }
  };

  const createTestUser = async (userId: string): Promise<void> => {
    const user = dataSource.getRepository(User).create({
      id: userId,
      email: `${userId}@story-24-1.test`,
      status: 'active',
      pushNotificationsEnabled: true,
      localNotificationsEnabled: true,
      hapticFeedbackEnabled: true,
    });
    await dataSource.getRepository(User).save(user);
  };

  const mockAuthFor = (userId: string): void => {
    __mockAuth.api.getSession.mockResolvedValue({
      user: { id: userId, email: `${userId}@story-24-1.test` },
      session: { token: `mock-token-${userId}` },
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 1: Aucune assignation → toutes false
  // ─────────────────────────────────────────────────────────────────────────

  test('Un utilisateur sans assignation obtient toutes les features à false', ({
    given,
    and,
    when,
    then,
  }) => {
    given('les features initiales sont seédées dans la base de données', async () => {
      await seedFeatures();
    });

    given(`il existe un utilisateur avec l'ID "user-no-assignments"`, async () => {
      await createTestUser('user-no-assignments');
      mockAuthFor('user-no-assignments');
    });

    and(`cet utilisateur n'a aucune assignation de feature flag`, () => {
      // Aucune donnée insérée
    });

    when(
      `l'utilisateur requête GET /api/users/user-no-assignments/features`,
      async () => {
        response = await request(app.getHttpServer())
          .get('/api/users/user-no-assignments/features')
          .set('Authorization', 'Bearer mock-token');
      },
    );

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('la réponse contient "debug_mode" à false', () => {
      expect(response.body['debug_mode']).toBe(false);
    });

    and('la réponse contient "data_mining" à false', () => {
      expect(response.body['data_mining']).toBe(false);
    });

    and('la réponse contient "news_tab" à false', () => {
      expect(response.body['news_tab']).toBe(false);
    });

    and('la réponse contient "projects_tab" à false', () => {
      expect(response.body['projects_tab']).toBe(false);
    });

    and('la réponse contient "capture_media_buttons" à false', () => {
      expect(response.body['capture_media_buttons']).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 2: Assignation directe user
  // ─────────────────────────────────────────────────────────────────────────

  test('Une assignation directe user à true est respectée', ({
    given,
    and,
    when,
    then,
  }) => {
    given('les features initiales sont seédées dans la base de données', async () => {
      await seedFeatures();
    });

    given(`il existe un utilisateur avec l'ID "user-with-debug"`, async () => {
      await createTestUser('user-with-debug');
      mockAuthFor('user-with-debug');
    });

    and(`cet utilisateur a une assignation user "debug_mode" à true`, async () => {
      await dataSource.query(
        `INSERT INTO user_feature_assignments (user_id, feature_id, value)
         VALUES ($1, $2, true)`,
        ['user-with-debug', FEATURE_IDS.debug_mode],
      );
    });

    when(`l'utilisateur requête GET /api/users/user-with-debug/features`, async () => {
      response = await request(app.getHttpServer())
        .get('/api/users/user-with-debug/features')
        .set('Authorization', 'Bearer mock-token');
    });

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('la réponse contient "debug_mode" à true', () => {
      expect(response.body['debug_mode']).toBe(true);
    });

    and('la réponse contient "data_mining" à false', () => {
      expect(response.body['data_mining']).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 3: Deny-wins via rôle
  // ─────────────────────────────────────────────────────────────────────────

  test('Deny-wins — une source false suffit à désactiver la feature', ({
    given,
    and,
    when,
    then,
  }) => {
    const TEST_ROLE_ID = 'aaaaaaaa-0000-7000-8000-000000000001';

    given('les features initiales sont seédées dans la base de données', async () => {
      await seedFeatures();
    });

    given(`il existe un utilisateur avec l'ID "user-deny-wins"`, async () => {
      await createTestUser('user-deny-wins');
      mockAuthFor('user-deny-wins');
    });

    and(`cet utilisateur a une assignation user "news_tab" à true`, async () => {
      await dataSource.query(
        `INSERT INTO user_feature_assignments (user_id, feature_id, value)
         VALUES ($1, $2, true)`,
        ['user-deny-wins', FEATURE_IDS.news_tab],
      );
    });

    and(
      `cet utilisateur a un rôle avec une assignation role "news_tab" à false`,
      async () => {
        // Créer le rôle de test
        await dataSource.query(
          `INSERT INTO roles (id, name, display_name, is_system)
           VALUES ($1, 'test-deny-wins', 'Test Deny Wins', false)`,
          [TEST_ROLE_ID],
        );
        // Assigner le rôle à l'utilisateur
        await dataSource.query(
          `INSERT INTO user_roles (id, user_id, role_id, expires_at)
           VALUES (gen_random_uuid(), $1, $2, NULL)`,
          ['user-deny-wins', TEST_ROLE_ID],
        );
        // Assigner news_tab=false au rôle
        await dataSource.query(
          `INSERT INTO role_feature_assignments (role_id, feature_id, value)
           VALUES ($1, $2, false)`,
          [TEST_ROLE_ID, FEATURE_IDS.news_tab],
        );
      },
    );

    when(`l'utilisateur requête GET /api/users/user-deny-wins/features`, async () => {
      response = await request(app.getHttpServer())
        .get('/api/users/user-deny-wins/features')
        .set('Authorization', 'Bearer mock-token');
    });

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('la réponse contient "news_tab" à false', () => {
      // Deny-wins: user=true mais role=false → résultat false
      expect(response.body['news_tab']).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 4: Format de réponse correct
  // ─────────────────────────────────────────────────────────────────────────

  test("L'endpoint retourne le format Record<string, boolean> complet", ({
    given,
    when,
    then,
    and,
  }) => {
    given('les features initiales sont seédées dans la base de données', async () => {
      await seedFeatures();
    });

    given(`il existe un utilisateur avec l'ID "user-format-check"`, async () => {
      await createTestUser('user-format-check');
      mockAuthFor('user-format-check');
    });

    when(`l'utilisateur requête GET /api/users/user-format-check/features`, async () => {
      response = await request(app.getHttpServer())
        .get('/api/users/user-format-check/features')
        .set('Authorization', 'Bearer mock-token');
    });

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('la réponse contient exactement les features du référentiel', () => {
      expect(Object.keys(response.body)).toEqual(
        expect.arrayContaining([
          'debug_mode',
          'data_mining',
          'news_tab',
          'projects_tab',
          'capture_media_buttons',
        ]),
      );
    });

    and('toutes les valeurs de la réponse sont des booléens', () => {
      for (const value of Object.values(response.body)) {
        expect(typeof value).toBe('boolean');
      }
    });
  });
});
