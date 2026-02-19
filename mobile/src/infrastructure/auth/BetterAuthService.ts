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
    if (tokenResult.type !== 'success' || !tokenResult.data) {
      return null;
    }

    if (this.currentSession) {
      return {
        ...this.currentSession,
        accessToken: tokenResult.data,
      };
    }

    // Cold start : currentSession est null (mémoire vidée).
    // 1. Tente de restaurer depuis SecureStore (offline-first, ADR-022)
    const storedUserId = await this.tokenManager.getStoredUserId();
    if (storedUserId) {
      this.currentSession = { accessToken: tokenResult.data, userId: storedUserId };
      return this.currentSession;
    }

    // 2. Fallback réseau si le userId n'est pas en SecureStore (ancienne installation)
    try {
      const response = await authClient.getSession();
      if (response.data?.session && response.data?.user) {
        this.currentSession = {
          accessToken: tokenResult.data,
          userId: response.data.user.id,
        };
        return this.currentSession;
      }
    } catch {
      // Erreur réseau — impossible de récupérer le profil
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

      await this.tokenManager.storeTokens(
        token,
        (response.data as { refreshToken?: string }).refreshToken ?? '',
        (response.data as { expiresIn?: number }).expiresIn ?? 3600,
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
