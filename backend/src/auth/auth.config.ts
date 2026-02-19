// Charger .env avant la création du pool pg (module évalué avant NestJS ConfigModule — ADR-029)
import 'dotenv/config';

import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { expo } from '@better-auth/expo';
import { Pool } from 'pg';
import { v7 as uuidv7 } from 'uuid';
import type { EmailService } from '../email/email.service';

/**
 * Better Auth configuration — ADR-029
 *
 * Uses a pg.Pool for direct PostgreSQL connection (Kysely adapter built-in).
 * Note: better-auth-typeorm does not exist; pg.Pool is the correct approach.
 * UUID v7 generated in application domain per ADR-026 R1.
 *
 * EmailService is injected post-initialization via setEmailService()
 * to break the circular dependency (module-level auth object vs NestJS DI).
 */

let emailServiceRef: EmailService | null = null;

export function setEmailService(service: EmailService): void {
  emailServiceRef = service;
}

type UserProvisioningCallback = (userId: string, email: string) => Promise<void>;
let userProvisioningCallbackRef: UserProvisioningCallback | null = null;

export function setUserProvisioningCallback(callback: UserProvisioningCallback): void {
  userProvisioningCallbackRef = callback;
}

/**
 * Secondary pg.Pool for Better Auth (Kysely adapter).
 * TypeORM maintains its own primary pool — this pool is dedicated to Better Auth
 * (auth tables: user, session, account, verification) and is intentionally separate
 * to avoid coupling Better Auth's query lifecycle to TypeORM transactions.
 * Pool size capped at 5 to limit total connections (TypeORM default: 10).
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

export const auth = betterAuth({
  database: pool,

  advanced: {
    database: {
      generateId: () => uuidv7(),
    },
  },

  emailAndPassword: {
    enabled: true,
    // Désactiver la vérification email obligatoire en développement (RESEND_API_KEY non configuré)
    requireEmailVerification: process.env.NODE_ENV === 'production',
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
    }) => {
      if (emailServiceRef) {
        await emailServiceRef.sendResetPassword(user.email, url);
      }
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: { email: string };
      url: string;
      token: string;
    }) => {
      if (emailServiceRef) {
        await emailServiceRef.sendEmailVerification(user.email, url);
      }
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (userProvisioningCallbackRef) {
            try {
              await userProvisioningCallbackRef(user.id, user.email);
            } catch (error) {
              // Ne pas bloquer l'inscription si le provisioning échoue
              console.error('[AuthConfig] User provisioning hook failed:', error);
            }
          }
        },
      },
    },
  },

  plugins: [
    admin(),
    expo(),  // Plugin Expo/React Native — bypass vérification d'origine pour les apps mobiles (story 15.2)
  ],

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  // Origines autorisées pour les clients mobiles Expo (story 15.2)
  // pensine-dev:// → build de développement (IS_DEV = true)
  // pensine://     → build de production
  trustedOrigins: ['pensine-dev://', 'pensine://'],
});

/**
 * Type export for BetterAuthGuard dependency injection.
 * Allows injecting a mock auth API in tests.
 */
export type AuthApiType = typeof auth.api;
