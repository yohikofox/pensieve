import { loadFeature, defineFeature } from 'jest-cucumber';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../../src/modules/shared/infrastructure/persistence/typeorm/entities/user.entity';

const feature = loadFeature('test/acceptance/features/story-7-1.feature');

defineFeature(feature, (test) => {
  let app: INestApplication;
  let dataSource: DataSource;
  let testUser: User;
  let otherUser: User;
  let authToken: string; // Mock Supabase JWT
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
    // Clean database before each scenario
    await dataSource.query('DELETE FROM users');
  });

  // Background: Given un utilisateur authentifié
  const givenAuthenticatedUser = (given: any) => {
    given(
      /un utilisateur authentifié avec l'ID "(.*)" et l'email "(.*)"/,
      async (userId: string, email: string) => {
        // Create test user
        testUser = dataSource.getRepository(User).create({
          id: userId,
          email: email,
          status: 'active',
          pushNotificationsEnabled: true,
          localNotificationsEnabled: true,
          hapticFeedbackEnabled: true,
          debug_mode_access: false, // Default value
        });
        await dataSource.getRepository(User).save(testUser);

        // Mock Supabase JWT token (simplified for testing)
        authToken = `Bearer mock-jwt-${userId}`;
      },
    );
  };

  // AC1: Récupération des permissions utilisateur avec succès
  test('Récupération des permissions utilisateur avec succès', ({
    given,
    when,
    then,
    and,
  }) => {
    givenAuthenticatedUser(given);

    given(
      /l'utilisateur "(.*)" a la permission "debug_mode_access" définie à "(.*)"/,
      async (userId: string, value: string) => {
        const debugModeAccess = value === 'true';
        await dataSource
          .getRepository(User)
          .update({ id: userId }, { debug_mode_access: debugModeAccess });
      },
    );

    when(
      /l'utilisateur requête "GET \/api\/users\/(.*?)\/features"/,
      async (userId: string) => {
        response = await request(app.getHttpServer())
          .get(`/api/users/${userId}/features`)
          .set('Authorization', authToken);
      },
    );

    then(/la réponse a le statut (\d+)/, (statusCode: string) => {
      expect(response.status).toBe(parseInt(statusCode, 10));
    });

    and(/la réponse JSON contient:/, (jsonString: string) => {
      const expectedJson = JSON.parse(jsonString);
      expect(response.body).toMatchObject(expectedJson);
    });
  });

  // AC1: Récupération avec debug_mode_access activé
  test('Récupération des permissions avec debug_mode_access activé', ({
    given,
    when,
    then,
    and,
  }) => {
    givenAuthenticatedUser(given);

    given(
      /l'utilisateur "(.*)" a la permission "debug_mode_access" définie à "(.*)"/,
      async (userId: string, value: string) => {
        const debugModeAccess = value === 'true';
        await dataSource
          .getRepository(User)
          .update({ id: userId }, { debug_mode_access: debugModeAccess });
      },
    );

    when(
      /l'utilisateur requête "GET \/api\/users\/(.*?)\/features"/,
      async (userId: string) => {
        response = await request(app.getHttpServer())
          .get(`/api/users/${userId}/features`)
          .set('Authorization', authToken);
      },
    );

    then(/la réponse a le statut (\d+)/, (statusCode: string) => {
      expect(response.status).toBe(parseInt(statusCode, 10));
    });

    and(/la réponse JSON contient:/, (jsonString: string) => {
      const expectedJson = JSON.parse(jsonString);
      expect(response.body).toMatchObject(expectedJson);
    });
  });

  // AC1: Protection par authentification
  test('Accès refusé sans authentification', ({ when, then }) => {
    when(
      /un utilisateur non authentifié requête "GET \/api\/users\/(.*?)\/features"/,
      async (userId: string) => {
        response = await request(app.getHttpServer()).get(
          `/api/users/${userId}/features`,
        );
        // No Authorization header
      },
    );

    then(/la réponse a le statut (\d+)/, (statusCode: string) => {
      expect(response.status).toBe(parseInt(statusCode, 10));
    });
  });

  // AC1: Un utilisateur ne peut pas accéder aux permissions d'un autre
  test("Un utilisateur ne peut pas accéder aux permissions d'un autre utilisateur", ({
    given,
    when,
    then,
    and,
  }) => {
    givenAuthenticatedUser(given);

    given(
      /un autre utilisateur existe avec l'ID "(.*)"/,
      async (otherUserId: string) => {
        otherUser = dataSource.getRepository(User).create({
          id: otherUserId,
          email: 'other@example.com',
          status: 'active',
          pushNotificationsEnabled: true,
          localNotificationsEnabled: true,
          hapticFeedbackEnabled: true,
          debug_mode_access: false,
        });
        await dataSource.getRepository(User).save(otherUser);
      },
    );

    when(
      /l'utilisateur "(.*)" requête "GET \/api\/users\/(.*?)\/features"/,
      async (requestingUserId: string, targetUserId: string) => {
        response = await request(app.getHttpServer())
          .get(`/api/users/${targetUserId}/features`)
          .set('Authorization', authToken); // authToken is for test-user-id
      },
    );

    then(/la réponse a le statut (\d+)/, (statusCode: string) => {
      expect(response.status).toBe(parseInt(statusCode, 10));
    });

    and(
      /la réponse contient un message d'erreur "(.*)"/,
      (errorMessage: string) => {
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain(errorMessage);
      },
    );
  });

  // AC1: Format extensible
  test('Le format de réponse est extensible pour futures permissions', ({
    given,
    when,
    then,
    and,
  }) => {
    givenAuthenticatedUser(given);

    given(
      /l'utilisateur "(.*)" a la permission "debug_mode_access" définie à "(.*)"/,
      async (userId: string, value: string) => {
        const debugModeAccess = value === 'true';
        await dataSource
          .getRepository(User)
          .update({ id: userId }, { debug_mode_access: debugModeAccess });
      },
    );

    when(
      /l'utilisateur requête "GET \/api\/users\/(.*?)\/features"/,
      async (userId: string) => {
        response = await request(app.getHttpServer())
          .get(`/api/users/${userId}/features`)
          .set('Authorization', authToken);
      },
    );

    then('la réponse JSON a une structure extensible', () => {
      expect(response.body).toHaveProperty('debug_mode_access');
      expect(typeof response.body).toBe('object');
    });

    and(
      'la réponse peut contenir des permissions additionnelles sans breaking changes',
      () => {
        // Verify that adding new fields won't break existing clients
        // The response is a flat object, not an array, so new fields can be added
        const responseKeys = Object.keys(response.body);
        expect(responseKeys).toContain('debug_mode_access');
        // Future permissions like 'error_reporting_enabled' can be added without breaking
      },
    );
  });
});
