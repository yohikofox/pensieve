/**
 * Better Auth Service — Implémentation de IAuthService
 *
 * Story 15.2 — Migration Client Mobile Better Auth
 * ADR-022: Stockage tokens dans expo-secure-store (jamais AsyncStorage)
 * ADR-023: Result Pattern (jamais throw)
 * ADR-029: Better Auth comme provider d'authentification
 *
 * Implémente IAuthService via Better Auth (ADR-029)
 */

import { injectable, inject } from 'tsyringe';
import type { IAuthService, AuthSession } from '../../contexts/identity/domain/IAuthService';
import { AuthTokenManager } from './AuthTokenManager';
import { authClient } from './auth-client';
import {
  type Result,
  success,
  authError,
  networkError,
} from '../../contexts/shared/domain/Result';
import { TOKENS } from '../di/tokens';

type AuthStateCallback = (session: AuthSession | null) => void;

@injectable()
export class BetterAuthService implements IAuthService {
  private readonly authStateListeners: Set<AuthStateCallback> = new Set();
  private currentSession: AuthSession | null = null;

  constructor(
    @inject(TOKENS.IAuthTokenManager) private readonly tokenManager: AuthTokenManager,
  ) {}

  async getSession(): Promise<AuthSession | null> {
    const tokenResult = await this.tokenManager.getValidToken();

    if (tokenResult.type === 'success' && tokenResult.data) {
      if (this.currentSession) {
        return {
          ...this.currentSession,
          accessToken: tokenResult.data,
        };
      }

      // Cold start : currentSession est null (mémoire vidée).
      // Tente de restaurer depuis SecureStore (offline-first, ADR-022)
      const storedUserId = await this.tokenManager.getStoredUserId();
      if (storedUserId) {
        this.currentSession = { accessToken: tokenResult.data, userId: storedUserId };
        return this.currentSession;
      }
    }

    // Token local invalide ou expiré → tenter renouvellement via authClient.
    // La session serveur est valide jusqu'à 7 jours après la dernière connexion (ADR-029).
    return this.tryGetSessionFromAuthClient();
  }

  private async tryGetSessionFromAuthClient(): Promise<AuthSession | null> {
    try {
      const response = await authClient.getSession();
      if (response.data?.session && response.data?.user) {
        const sessionData = response.data.session as {
          token: string;
          tokenExpiresIn?: number;
        };
        const user = response.data.user as { id: string };

        // Utiliser tokenExpiresIn du serveur (fin du jour UTC) ou calculer localement
        const tokenExpiresIn = sessionData.tokenExpiresIn ?? (() => {
          const endOfToday = new Date();
          endOfToday.setUTCHours(23, 59, 59, 999);
          return Math.max(60, Math.floor((endOfToday.getTime() - Date.now()) / 1000));
        })();

        await this.tokenManager.storeTokens(
          sessionData.token,
          sessionData.token,  // session-based auth : pas de refreshToken séparé
          tokenExpiresIn,
          user.id,
        );

        this.currentSession = { accessToken: sessionData.token, userId: user.id };
        return this.currentSession;
      }
    } catch {
      // Hors ligne ou session serveur expirée (> 7 jours)
    }
    return null;
  }

  onAuthStateChange(callback: AuthStateCallback): () => void {
    this.authStateListeners.add(callback);
    return () => {
      this.authStateListeners.delete(callback);
    };
  }

  async signIn(email: string, password: string): Promise<Result<void>> {
    try {
      const response = await authClient.signIn.email({
        email,
        password,
      });

      if (response.error) {
        return authError(response.error.message ?? 'Échec de connexion');
      }

      if (!response.data?.token) {
        return authError('Réponse invalide du serveur');
      }

      const { token, user } = response.data;

      // Lire tokenExpiresIn depuis la réponse serveur (si disponible).
      // Better Auth n'envoie pas expiresIn ni refreshToken dans signIn.email() —
      // on calcule localement : fin du jour courant UTC (cohérent avec customSession).
      const serverExpiresIn = (response.data as { session?: { tokenExpiresIn?: number } }).session?.tokenExpiresIn;
      const tokenExpiresIn = serverExpiresIn ?? (() => {
        const endOfToday = new Date();
        endOfToday.setUTCHours(23, 59, 59, 999);
        return Math.max(60, Math.floor((endOfToday.getTime() - Date.now()) / 1000));
      })();

      await this.tokenManager.storeTokens(
        token,
        token,  // session-based auth : le session token est le credential de renouvellement
        tokenExpiresIn,
        user?.id,
      );

      this.currentSession = {
        accessToken: token,
        userId: user?.id ?? '',
      };

      this.notifyListeners(this.currentSession);
      return success(undefined);
    } catch {
      return networkError('Connexion impossible');
    }
  }

  async signOut(): Promise<Result<void>> {
    try {
      await authClient.signOut();
      await this.tokenManager.clearTokens();
      this.currentSession = null;
      this.notifyListeners(null);
      return success(undefined);
    } catch {
      await this.tokenManager.clearTokens();
      this.currentSession = null;
      this.notifyListeners(null);
      return success(undefined);
    }
  }

  private notifyListeners(session: AuthSession | null): void {
    this.authStateListeners.forEach((cb) => cb(session));
  }
}
