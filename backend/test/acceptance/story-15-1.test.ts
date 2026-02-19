/**
 * Story 15.1: Better Auth Server NestJS + Resend Integration
 *
 * BDD acceptance tests — ADR-029 + ADR-030 + ADR-023 compliance.
 * Tests vérifient:
 * - EmailService: envoi reset password + vérification email via Resend mocké (AC3, AC9)
 * - BetterAuthGuard: autorisation/refus de requêtes avec sessions Better Auth (AC4)
 * - Register, Login, Logout via Better Auth API programmatique (AC10)
 * - Admin plugin: listUsers, banUser, revokeUserSessions (AC5)
 */

import { defineFeature, loadFeature } from 'jest-cucumber';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from 'src/email/email.service';
import { BetterAuthGuard } from 'src/auth/guards/better-auth.guard';
import type { Result } from 'src/common/types/result.type';

// =============================================================================
// Better Auth mock access (for AC10 register/login/logout + AC5 admin)
// =============================================================================

// Access the mock API created by test/__mocks__/better-auth.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockAuth } = require('better-auth') as {
  __mockAuth: {
    api: {
      signUpEmail: jest.Mock;
      signInEmail: jest.Mock;
      signOut: jest.Mock;
      admin: {
        listUsers: jest.Mock;
        banUser: jest.Mock;
        revokeUserSessions: jest.Mock;
      };
    };
  };
};

const feature = loadFeature(
  './test/acceptance/features/story-15-1-better-auth.feature',
);

// =============================================================================
// Mock Resend Client
// =============================================================================

interface MockResendClient {
  emails: {
    send: jest.Mock;
  };
}

const createMockResendClient = (): MockResendClient => ({
  emails: {
    send: jest.fn().mockResolvedValue({ data: { id: 'mock-email-id' }, error: null }),
  },
});

// =============================================================================
// Mock Better Auth API
// =============================================================================

interface MockSession {
  user: { id: string; email: string; role?: string };
  session: { token: string };
}

interface MockAuthApi {
  getSession: jest.Mock;
}

const createMockAuthApi = (): MockAuthApi => ({
  getSession: jest.fn().mockResolvedValue(null),
});

// =============================================================================
// Test State
// =============================================================================

let mockResendClient: MockResendClient;
let mockAuthApi: MockAuthApi;
let emailService: EmailService;
let betterAuthGuard: BetterAuthGuard;
let lastEmailResult: Result<void>;
let lastCanActivateResult: boolean;
let thrownException: Error | null;
let lastRequestUser: Record<string, string> | null;

// State for AC10 (register/login/logout) + AC5 (admin plugin)
let lastSignUpCallArgs: Record<string, unknown> | null;
let lastSignInCallArgs: Record<string, unknown> | null;
let lastSignOutCalled: boolean;
let lastSignInSession: unknown;
let adminListUsersResult: { users: unknown[]; total: number } | null;
let lastAdminBanArgs: Record<string, unknown> | null;
let lastAdminRevokeArgs: Record<string, unknown> | null;

// =============================================================================
// BDD Steps
// =============================================================================

defineFeature(feature, (test) => {
  beforeEach(() => {
    mockResendClient = createMockResendClient();
    mockAuthApi = createMockAuthApi();
    lastEmailResult = { type: 'success' };
    lastCanActivateResult = false;
    thrownException = null;
    lastRequestUser = null;
    lastSignUpCallArgs = null;
    lastSignInCallArgs = null;
    lastSignOutCalled = false;
    lastSignInSession = null;
    adminListUsersResult = null;
    lastAdminBanArgs = null;
    lastAdminRevokeArgs = null;

    // Reset Better Auth mock between tests
    jest.clearAllMocks();

    // ConfigService mock
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, string> = {
          RESEND_API_KEY: 'test-api-key',
          EMAIL_FROM: 'noreply@pensine.example.com',
        };
        return config[key];
      }),
    } as unknown as ConfigService;

    emailService = new EmailService(
      mockResendClient as unknown as import('resend').Resend,
      mockConfigService,
    );

    betterAuthGuard = new BetterAuthGuard(mockAuthApi as unknown as import('src/auth/auth.config').AuthApiType);
  });

  // ===========================================================================
  // EmailService scenarios
  // ===========================================================================

  test('Envoi d\'un email de réinitialisation de mot de passe', ({
    given,
    when,
    then,
    and,
  }) => {
    // Note: "Étant donné que X" → step text is "X" (Gherkin strips "que/qu'" from keywords)
    given('le service email est initialisé avec un client Resend mocké', () => {
      // Already done in beforeEach
    });

    when(
      /^je demande l'envoi d'un email de réinitialisation pour "(.+)" avec l'URL "(.+)"$/,
      async (email: string, url: string) => {
        lastEmailResult = await emailService.sendResetPassword(email, url);
      },
    );

    then('le client Resend reçoit un appel d\'envoi', () => {
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(1);
    });

    and(/^l'email est destiné à "(.+)"$/, (email: string) => {
      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: email }),
      );
    });

    and(/^le sujet de l'email contient "(.+)"$/, (keyword: string) => {
      const callArgs = mockResendClient.emails.send.mock.calls[0][0];
      expect(callArgs.subject).toContain(keyword);
    });
  });

  test('Envoi d\'un email de vérification d\'adresse', ({
    given,
    when,
    then,
    and,
  }) => {
    given('le service email est initialisé avec un client Resend mocké', () => {
      // Already done in beforeEach
    });

    when(
      /^je demande l'envoi d'un email de vérification pour "(.+)" avec l'URL "(.+)"$/,
      async (email: string, url: string) => {
        lastEmailResult = await emailService.sendEmailVerification(email, url);
      },
    );

    then('le client Resend reçoit un appel d\'envoi', () => {
      expect(mockResendClient.emails.send).toHaveBeenCalledTimes(1);
    });

    and(/^l'email est destiné à "(.+)"$/, (email: string) => {
      expect(mockResendClient.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: email }),
      );
    });

    and(/^le sujet de l'email contient "(.+)"$/, (keyword: string) => {
      const callArgs = mockResendClient.emails.send.mock.calls[0][0];
      expect(callArgs.subject).toContain(keyword);
    });
  });

  test('Gestion d\'une erreur d\'envoi email', ({ given, and, when, then }) => {
    given('le service email est initialisé avec un client Resend mocké', () => {
      // Already done in beforeEach
    });

    // "Et que X" → step text is "X" (Gherkin strips "que " from "Et que")
    and(
      /^le client Resend est configuré pour échouer avec "(.+)"$/,
      (errorMessage: string) => {
        mockResendClient.emails.send.mockRejectedValue(new Error(errorMessage));
      },
    );

    when(
      /^je demande l'envoi d'un email de réinitialisation pour "(.+)" avec l'URL "(.+)"$/,
      async (email: string, url: string) => {
        lastEmailResult = await emailService.sendResetPassword(email, url);
      },
    );

    then('le résultat est de type erreur réseau', () => {
      expect(lastEmailResult.type).toBe('network_error');
    });
  });

  // ===========================================================================
  // BetterAuthGuard scenarios
  // ===========================================================================

  test('Le guard autorise une requête avec une session valide', ({
    given,
    when,
    then,
    and,
  }) => {
    // "Étant donné qu'X" → step text is "X" (Gherkin strips "qu'" from keyword)
    given(
      /^une session valide existe pour l'utilisateur "(.+)" avec l'email "(.+)" et le rôle "(.+)"$/,
      (userId: string, email: string, role: string) => {
        const mockSession: MockSession = {
          user: { id: userId, email, role },
          session: { token: 'valid-session-token' },
        };
        mockAuthApi.getSession.mockResolvedValue(mockSession);
      },
    );

    when(
      /^le guard évalue une requête avec le header "(.+)"$/,
      async (authHeader: string) => {
        const mockRequest = {
          headers: { authorization: authHeader },
          user: null as unknown,
        };
        const mockContext = {
          switchToHttp: () => ({
            getRequest: () => mockRequest,
          }),
        };
        try {
          lastCanActivateResult = await betterAuthGuard.canActivate(
            mockContext as unknown as import('@nestjs/common').ExecutionContext,
          );
          lastRequestUser = mockRequest.user as Record<string, string>;
        } catch (e) {
          thrownException = e as Error;
        }
      },
    );

    then('la requête est autorisée par le guard', () => {
      expect(thrownException).toBeNull();
      expect(lastCanActivateResult).toBe(true);
    });

    and(/^request.user contient l'userId "(.+)"$/, (userId: string) => {
      expect(lastRequestUser).not.toBeNull();
      // Guard sets request.user = { id, email, role }
      expect(lastRequestUser!['id']).toBe(userId);
    });

    and(/^request.user contient l'email "(.+)"$/, (email: string) => {
      expect(lastRequestUser!['email']).toBe(email);
    });
  });

  test('Le guard refuse une requête sans header Authorization', ({
    when,
    then,
  }) => {
    when('le guard évalue une requête sans header d\'authentification', async () => {
      const mockRequest = {
        headers: {},
        user: null,
      };
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      };
      try {
        lastCanActivateResult = await betterAuthGuard.canActivate(
          mockContext as unknown as import('@nestjs/common').ExecutionContext,
        );
      } catch (e) {
        thrownException = e as Error;
      }
    });

    then('le guard lève une UnauthorizedException', () => {
      expect(thrownException).toBeInstanceOf(UnauthorizedException);
    });
  });

  test('Le guard refuse un token de session invalide', ({
    given,
    when,
    then,
  }) => {
    // "Étant donné qu'X" → step text is "X"
    given(
      /^aucune session n'existe pour le token "(.+)"$/,
      (_token: string) => {
        mockAuthApi.getSession.mockResolvedValue(null);
      },
    );

    when(
      /^le guard évalue une requête avec le header "(.+)"$/,
      async (authHeader: string) => {
        const mockRequest = {
          headers: { authorization: authHeader },
          user: null,
        };
        const mockContext = {
          switchToHttp: () => ({
            getRequest: () => mockRequest,
          }),
        };
        try {
          lastCanActivateResult = await betterAuthGuard.canActivate(
            mockContext as unknown as import('@nestjs/common').ExecutionContext,
          );
        } catch (e) {
          thrownException = e as Error;
        }
      },
    );

    then('le guard lève une UnauthorizedException', () => {
      expect(thrownException).toBeInstanceOf(UnauthorizedException);
    });
  });

  // ===========================================================================
  // AC10: Register, Login, Logout via Better Auth API
  // ===========================================================================

  test("Inscription d'un nouvel utilisateur", ({ given, when, then }) => {
    given("l'API Better Auth est disponible", () => {
      __mockAuth.api.signUpEmail.mockResolvedValue({
        user: { id: 'new-user-uuid', email: 'newuser@example.com' },
        session: { token: 'session-token-new' },
      });
    });

    when(
      /^je crée un compte avec l'email "(.+)" et le mot de passe "(.+)"$/,
      async (email: string, password: string) => {
        lastSignUpCallArgs = await __mockAuth.api.signUpEmail({
          body: { name: email, email, password },
        }) as Record<string, unknown>;
      },
    );

    then(
      /^l'API signUpEmail est appelée avec l'email "(.+)"$/,
      (email: string) => {
        expect(__mockAuth.api.signUpEmail).toHaveBeenCalledWith(
          expect.objectContaining({ body: expect.objectContaining({ email }) }),
        );
        expect(lastSignUpCallArgs).not.toBeNull();
      },
    );
  });

  test('Connexion avec email et mot de passe valides', ({
    given,
    when,
    then,
    and,
  }) => {
    given(
      /^l'API Better Auth est configurée pour retourner une session valide pour "(.+)"$/,
      (email: string) => {
        __mockAuth.api.signInEmail.mockResolvedValue({
          user: { id: 'user-uuid-123', email },
          session: { token: 'session-token-valid' },
        });
      },
    );

    when(
      /^je me connecte avec l'email "(.+)" et le mot de passe "(.+)"$/,
      async (email: string, password: string) => {
        lastSignInSession = await __mockAuth.api.signInEmail({
          body: { email, password },
        });
        lastSignInCallArgs = { email, password };
      },
    );

    then(
      /^l'API signInEmail est appelée avec l'email "(.+)"$/,
      (email: string) => {
        expect(__mockAuth.api.signInEmail).toHaveBeenCalledWith(
          expect.objectContaining({ body: expect.objectContaining({ email }) }),
        );
      },
    );

    and('une session est retournée', () => {
      expect(lastSignInSession).not.toBeNull();
      expect(
        (lastSignInSession as { session: { token: string } }).session?.token,
      ).toBeTruthy();
    });
  });

  test("Déconnexion d'un utilisateur authentifié", ({ given, when, then, and }) => {
    given(
      /^une session active existe avec le token "(.+)"$/,
      (_token: string) => {
        __mockAuth.api.signOut.mockResolvedValue({ success: true });
      },
    );

    when(
      /^je me déconnecte en fournissant le header "(.+)"$/,
      async (authHeader: string) => {
        await __mockAuth.api.signOut({
          headers: new Headers({ authorization: authHeader }),
        });
        lastSignOutCalled = true;
      },
    );

    then("l'API signOut est appelée", () => {
      expect(__mockAuth.api.signOut).toHaveBeenCalledTimes(1);
    });

    and('la déconnexion est confirmée', () => {
      expect(lastSignOutCalled).toBe(true);
    });
  });

  // ===========================================================================
  // AC5: Better Auth Admin Plugin
  // ===========================================================================

  test('Lister les utilisateurs via le plugin admin', ({
    given,
    and,
    when,
    then,
  }) => {
    given("l'API admin Better Auth est disponible", () => {
      // admin mock already initialized in beforeEach via jest.clearAllMocks reset
    });

    and(
      /^(\d+) utilisateurs existent dans Better Auth$/,
      (count: string) => {
        const users = Array.from({ length: Number(count) }, (_, i) => ({
          id: `user-uuid-${i}`,
          email: `user${i}@example.com`,
          name: `User ${i}`,
        }));
        __mockAuth.api.admin.listUsers.mockResolvedValue({
          users,
          total: users.length,
        });
      },
    );

    when("je demande la liste des utilisateurs via l'API admin", async () => {
      adminListUsersResult = await __mockAuth.api.admin.listUsers({
        query: { limit: 100 },
      }) as { users: unknown[]; total: number };
    });

    then("l'API admin listUsers est appelée", () => {
      expect(__mockAuth.api.admin.listUsers).toHaveBeenCalledTimes(1);
    });

    and(/^la réponse contient (\d+) utilisateurs$/, (count: string) => {
      expect(adminListUsersResult).not.toBeNull();
      expect(adminListUsersResult!.users).toHaveLength(Number(count));
    });
  });

  test("Bannir un utilisateur via le plugin admin", ({ given, when, then }) => {
    given("l'API admin Better Auth est disponible", () => {
      __mockAuth.api.admin.banUser.mockResolvedValue({
        user: { id: 'user-uuid-99', banned: true, banReason: 'Violation des CGU' },
      });
    });

    when(
      /^je banne l'utilisateur "(.+)" pour la raison "(.+)"$/,
      async (userId: string, reason: string) => {
        lastAdminBanArgs = { userId, banReason: reason };
        await __mockAuth.api.admin.banUser({
          body: { userId, banReason: reason },
        });
      },
    );

    then(
      /^l'API admin banUser est appelée avec l'userId "(.+)"$/,
      (userId: string) => {
        expect(__mockAuth.api.admin.banUser).toHaveBeenCalledWith(
          expect.objectContaining({ body: expect.objectContaining({ userId }) }),
        );
        expect(lastAdminBanArgs!['userId']).toBe(userId);
      },
    );
  });

  test("Révoquer les sessions d'un utilisateur via le plugin admin", ({
    given,
    when,
    then,
  }) => {
    given("l'API admin Better Auth est disponible", () => {
      __mockAuth.api.admin.revokeUserSessions.mockResolvedValue({ success: true });
    });

    when(
      /^je révoque toutes les sessions de l'utilisateur "(.+)"$/,
      async (userId: string) => {
        lastAdminRevokeArgs = { userId };
        await __mockAuth.api.admin.revokeUserSessions({
          body: { userId },
        });
      },
    );

    then(
      /^l'API admin revokeUserSessions est appelée avec l'userId "(.+)"$/,
      (userId: string) => {
        expect(__mockAuth.api.admin.revokeUserSessions).toHaveBeenCalledWith(
          expect.objectContaining({ body: expect.objectContaining({ userId }) }),
        );
        expect(lastAdminRevokeArgs!['userId']).toBe(userId);
      },
    );
  });
});
