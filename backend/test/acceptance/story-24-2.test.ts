/**
 * Story 24.2: Feature Flag System — Admin API & Interface d'Administration
 * BDD acceptance tests — AC1, AC2, AC7
 *
 * Tests vérifient:
 * - Admin peut créer une feature, l'assigner à un user, vérifier la résolution
 * - Non-admin reçoit 401
 * - Suppression d'assignation directe fait retomber la résolution à false
 *
 * Pattern auth admin: créer admin_user + bcrypt hash + POST /api/auth/admin/login → token JWT
 */

import { loadFeature, defineFeature } from 'jest-cucumber';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/modules/shared/infrastructure/persistence/typeorm/entities/user.entity';

const feature = loadFeature('test/acceptance/features/story-24-2.feature');

const FEATURE_IDS = {
  debug_mode: 'fe000001-0000-7000-8000-000000000001',
  data_mining: 'fe000002-0000-7000-8000-000000000002',
  news_tab: 'fe000003-0000-7000-8000-000000000003',
  projects_tab: 'fe000004-0000-7000-8000-000000000004',
  capture_media_buttons: 'fe000005-0000-7000-8000-000000000005',
};

const TEST_ADMIN_EMAIL = 'admin-24-2@story-24-2.test';
const TEST_ADMIN_PASSWORD = 'TestAdmin@2026!';

defineFeature(feature, (test) => {
  let app: INestApplication;
  let dataSource: DataSource;
  let response: request.Response;
  let adminToken: string;

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
    // Nettoyage dans l'ordre des FK
    await dataSource.query('DELETE FROM permission_feature_assignments');
    await dataSource.query('DELETE FROM role_feature_assignments');
    await dataSource.query('DELETE FROM user_feature_assignments');
    await dataSource.query('DELETE FROM user_roles');
    await dataSource.query('DELETE FROM user_permissions');
    await dataSource.query('DELETE FROM features');
    await dataSource.query(`DELETE FROM admin_users WHERE email = $1`, [TEST_ADMIN_EMAIL]);
    await dataSource.query(`DELETE FROM users WHERE email LIKE '%@story-24-2.test'`);

    adminToken = '';
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
      email: `${userId}@story-24-2.test`,
      status: 'active',
      pushNotificationsEnabled: true,
      localNotificationsEnabled: true,
      hapticFeedbackEnabled: true,
    });
    await dataSource.getRepository(User).save(user);
  };

  const loginAsAdmin = async (): Promise<string> => {
    const passwordHash = await bcrypt.hash(TEST_ADMIN_PASSWORD, 10);
    await dataSource.query(
      `INSERT INTO admin_users (email, password_hash, name, is_super_admin, must_change_password)
       VALUES ($1, $2, 'Test Admin', true, false)`,
      [TEST_ADMIN_EMAIL, passwordHash],
    );

    const loginResp = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

    return loginResp.body.accessToken as string;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 1: Admin crée feature + assigne à user + vérifie résolution
  // ─────────────────────────────────────────────────────────────────────────

  test('Admin crée une feature, l\'assigne à un user, et vérifie la résolution', ({
    given,
    and,
    when,
    then,
  }) => {
    given('les features initiales sont seédées dans la base de données', async () => {
      await seedFeatures();
    });

    given(`il existe un utilisateur avec l'ID "user-ff-admin-test"`, async () => {
      await createTestUser('user-ff-admin-test');
    });

    and('je suis authentifié en tant qu\'admin', async () => {
      adminToken = await loginAsAdmin();
    });

    when(
      'l\'admin requête POST /api/admin/features avec key "beta_feature" et defaultValue false',
      async () => {
        response = await request(app.getHttpServer())
          .post('/api/admin/features')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ key: 'beta_feature', description: 'Beta feature for testing', defaultValue: false });
      },
    );

    then('la réponse a le statut 201', () => {
      expect(response.status).toBe(201);
    });

    and('la réponse contient la feature avec key "beta_feature"', () => {
      expect(response.body.key).toBe('beta_feature');
    });

    when(
      'l\'admin requête PUT /api/admin/users/user-ff-admin-test/features/beta_feature avec value true',
      async () => {
        response = await request(app.getHttpServer())
          .put('/api/admin/users/user-ff-admin-test/features/beta_feature')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ value: true });
      },
    );

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('la réponse contient source "user"', () => {
      expect(response.body.source).toBe('user');
    });

    when('l\'admin requête GET /api/admin/users/user-ff-admin-test/features', async () => {
      response = await request(app.getHttpServer())
        .get('/api/admin/users/user-ff-admin-test/features')
        .set('Authorization', `Bearer ${adminToken}`);
    });

    then('la réponse a le statut 200', () => {
      expect(response.status).toBe(200);
    });

    and('la trace de "beta_feature" a resolved à true', () => {
      expect(response.body['beta_feature'].resolved).toBe(true);
    });

    and('la trace de "beta_feature" a 1 source de type "user"', () => {
      const sources = response.body['beta_feature'].sources as Array<{ type: string }>;
      expect(sources).toHaveLength(1);
      expect(sources[0].type).toBe('user');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 2: Non-admin → 401
  // ─────────────────────────────────────────────────────────────────────────

  test('Non-admin reçoit 401 sur les endpoints admin features', ({
    given,
    when,
    then,
  }) => {
    given('les features initiales sont seédées dans la base de données', async () => {
      await seedFeatures();
    });

    given('je ne suis pas authentifié', () => {
      // adminToken reste vide
    });

    when('je requête GET /api/admin/features sans token', async () => {
      response = await request(app.getHttpServer()).get('/api/admin/features');
    });

    then('la réponse a le statut 401', () => {
      expect(response.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Scénario 3: Suppression assignation directe → résolution retombe à false
  // ─────────────────────────────────────────────────────────────────────────

  test('Suppression d\'assignation directe fait retomber la résolution à false', ({
    given,
    and,
    when,
    then,
  }) => {
    given('les features initiales sont seédées dans la base de données', async () => {
      await seedFeatures();
    });

    given(`il existe un utilisateur avec l'ID "user-ff-delete-test"`, async () => {
      await createTestUser('user-ff-delete-test');
    });

    and('je suis authentifié en tant qu\'admin', async () => {
      adminToken = await loginAsAdmin();
    });

    and(
      'l\'utilisateur "user-ff-delete-test" a une assignation directe "debug_mode" à true',
      async () => {
        await dataSource.query(
          `INSERT INTO user_feature_assignments (user_id, feature_id, value)
           VALUES ($1, $2, true)`,
          ['user-ff-delete-test', FEATURE_IDS.debug_mode],
        );
      },
    );

    when(
      'l\'admin requête DELETE /api/admin/users/user-ff-delete-test/features/debug_mode',
      async () => {
        response = await request(app.getHttpServer())
          .delete('/api/admin/users/user-ff-delete-test/features/debug_mode')
          .set('Authorization', `Bearer ${adminToken}`);
      },
    );

    then('la réponse a le statut 204', () => {
      expect(response.status).toBe(204);
    });

    when('l\'admin requête GET /api/admin/users/user-ff-delete-test/features', async () => {
      response = await request(app.getHttpServer())
        .get('/api/admin/users/user-ff-delete-test/features')
        .set('Authorization', `Bearer ${adminToken}`);
    });

    then('la trace de "debug_mode" a resolved à false', () => {
      expect(response.body['debug_mode'].resolved).toBe(false);
    });

    and('la trace de "debug_mode" a 0 sources', () => {
      expect(response.body['debug_mode'].sources).toHaveLength(0);
    });
  });
});
