/**
 * AuthTokenManager — Stratégie de gestion des tokens Better Auth
 *
 * Story 15.2 — Migration Client Mobile Better Auth
 * ADR-022: Stockage dans expo-secure-store (jamais AsyncStorage)
 * ADR-023: Result Pattern (jamais throw)
 * ADR-025: fetch natif uniquement
 * ADR-029: Stratégie offline — token valide jusqu'à 23:59 du jour courant
 *
 * Règles de décision :
 * | Situation                                      | Action                         |
 * |------------------------------------------------|--------------------------------|
 * | Token valide                                   | Retourner token directement    |
 * | Token expiré + réseau OK                       | Refresh → retourner nouveau    |
 * | Token expiré + réseau KO + avant 23:59         | Retourner ancien token (offline) |
 * | Token expiré + réseau KO + après 23:59         | Logout → auth error            |
 * | Refresh → 401/403 (révoqué)                    | Logout immédiat (pas de fallback) |
 */

import * as SecureStore from 'expo-secure-store';
import { injectable } from 'tsyringe';
import {
  type Result,
  success,
  networkError,
  authError,
} from '../../contexts/shared/domain/Result';

const TOKEN_KEYS = {
  ACCESS_TOKEN: 'ba_access_token',
  REFRESH_TOKEN: 'ba_refresh_token',
  EXPIRES_AT: 'ba_token_expires_at',
  USER_ID: 'ba_user_id',
} as const;

@injectable()
export class AuthTokenManager {
  async getValidToken(): Promise<Result<string>> {
    const token = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_TOKEN);
    const expiresAtRaw = await SecureStore.getItemAsync(TOKEN_KEYS.EXPIRES_AT);

    if (!token) {
      return authError('Aucun token stocké');
    }

    const expiresAt = Number(expiresAtRaw ?? '0');
    const isExpired = Date.now() > expiresAt;

    if (!isExpired) {
      return success(token);
    }

    const refreshResult = await this.tryRefresh();

    if (refreshResult.type === 'success' && refreshResult.data) {
      return success(refreshResult.data);
    }

    if (refreshResult.type === 'network_error') {
      if (Date.now() < this.getEndOfExpiryDay(expiresAt)) {
        return success(token);
      }
      await this.clearTokens();
      return authError('Session expirée — reconnexion requise');
    }

    await this.clearTokens();
    return authError('Session invalide — reconnexion requise');
  }

  async storeTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    userId?: string,
  ): Promise<void> {
    const expiresAt = Date.now() + expiresIn * 1000;
    const ops: Promise<void>[] = [
      SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_TOKEN, accessToken),
      SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_TOKEN, refreshToken),
      SecureStore.setItemAsync(TOKEN_KEYS.EXPIRES_AT, String(expiresAt)),
    ];
    if (userId) {
      ops.push(SecureStore.setItemAsync(TOKEN_KEYS.USER_ID, userId));
    }
    await Promise.all(ops);
  }

  async getStoredUserId(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEYS.USER_ID);
  }

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(TOKEN_KEYS.EXPIRES_AT),
      SecureStore.deleteItemAsync(TOKEN_KEYS.USER_ID),
    ]);
  }

  /**
   * Retourne 23:59:59.999 du JOUR d'expiration du token (pas du jour courant).
   * Permet le fallback offline jusqu'à la fin du jour où le token a expiré.
   */
  private getEndOfExpiryDay(expiresAt: number): number {
    const expiryDate = new Date(expiresAt);
    return new Date(
      expiryDate.getFullYear(),
      expiryDate.getMonth(),
      expiryDate.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();
  }

  private async tryRefresh(): Promise<Result<string>> {
    const refreshToken = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      return authError('Aucun refresh token');
    }

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BETTER_AUTH_URL ?? ''}/api/auth/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
      );

      if (response.status === 401 || response.status === 403) {
        return authError('Refresh token invalide');
      }

      if (!response.ok) {
        return networkError(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };

      await this.storeTokens(data.accessToken, data.refreshToken, data.expiresIn);
      return success(data.accessToken);
    } catch {
      return networkError('Réseau indisponible');
    }
  }
}
