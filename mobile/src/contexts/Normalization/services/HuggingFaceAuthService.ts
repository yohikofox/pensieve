/**
 * HuggingFaceAuthService - OAuth authentication for HuggingFace
 *
 * Enables downloading gated models (like Gemma) that require user consent.
 * Uses OAuth 2.0 with PKCE for secure authentication.
 *
 * Flow:
 * 1. User initiates login
 * 2. Browser opens to HuggingFace OAuth page
 * 3. User accepts license and authorizes app
 * 4. App receives authorization code
 * 5. Exchange code for access token
 * 6. Store token securely for future downloads
 */

import 'reflect-metadata';
import { injectable } from 'tsyringe';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import type { IHuggingFaceAuthService, HuggingFaceUser, AuthState } from '../domain/IHuggingFaceAuthService';

// Complete any pending auth sessions when app loads
WebBrowser.maybeCompleteAuthSession();

/**
 * HuggingFace OAuth configuration
 *
 * Flow with backend proxy:
 * 1. Mobile opens browser to HuggingFace OAuth
 * 2. HuggingFace redirects to backend with auth code
 * 3. Backend exchanges code for token
 * 4. Backend redirects to pensine://auth/huggingface?access_token=XXX
 * 5. Mobile receives token via deep link
 */
const HF_CLIENT_ID = process.env.EXPO_PUBLIC_HF_CLIENT_ID || '';
const HF_BACKEND_REDIRECT = `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/auth/huggingface/callback`;
const HF_AUTH_ENDPOINT = 'https://huggingface.co/oauth/authorize';
const HF_TOKEN_ENDPOINT = 'https://huggingface.co/oauth/token';
const HF_USER_ENDPOINT = 'https://huggingface.co/api/whoami-v2';

// Secure storage keys
const TOKEN_KEY = 'hf_access_token';
const REFRESH_TOKEN_KEY = 'hf_refresh_token';
const USER_KEY = 'hf_user_info';

// Re-export types from interface
export type { HuggingFaceUser, AuthState };

@injectable()
export class HuggingFaceAuthService implements IHuggingFaceAuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private user: HuggingFaceUser | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the service and restore saved session
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Restore tokens from secure storage
      this.accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
      this.refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      const userJson = await SecureStore.getItemAsync(USER_KEY);
      if (userJson) {
        this.user = JSON.parse(userJson);
      }

      // Verify token is still valid
      if (this.accessToken) {
        const isValid = await this.verifyToken();
        if (!isValid) {
          // Try to refresh
          if (this.refreshToken) {
            await this.refreshAccessToken();
          } else {
            await this.clearSession();
          }
        }
      }

      this.isInitialized = true;
      console.log('[HuggingFaceAuth] Initialized, authenticated:', !!this.accessToken);
    } catch (error) {
      console.error('[HuggingFaceAuth] Initialization error:', error);
      await this.clearSession();
      this.isInitialized = true;
    }
  }

  /**
   * Get current auth state
   */
  getAuthState(): AuthState {
    return {
      isAuthenticated: !!this.accessToken,
      user: this.user,
      isLoading: false,
      error: null,
    };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  /**
   * Get current user info
   */
  getUser(): HuggingFaceUser | null {
    return this.user;
  }

  /**
   * Get access token for API calls
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Initiate OAuth login flow via backend proxy
   *
   * Flow:
   * 1. Open browser to HuggingFace OAuth with backend as redirect
   * 2. Backend receives code, exchanges for token
   * 3. Backend redirects to pensine://auth/huggingface?access_token=XXX
   * 4. App receives token via deep link
   */
  async login(): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        console.log('[HuggingFaceAuth] Starting OAuth login flow via backend');
        console.log('[HuggingFaceAuth] Config:', {
          HF_CLIENT_ID: HF_CLIENT_ID || '(empty)',
          HF_BACKEND_REDIRECT: HF_BACKEND_REDIRECT || '(empty)',
          HF_AUTH_ENDPOINT,
        });

        if (!HF_CLIENT_ID) {
          console.error('[HuggingFaceAuth] ERROR: HF_CLIENT_ID is empty! Check EXPO_PUBLIC_HF_CLIENT_ID in .env');
          resolve(false);
          return;
        }

        if (!HF_BACKEND_REDIRECT) {
          console.error('[HuggingFaceAuth] ERROR: HF_BACKEND_REDIRECT is empty! Check EXPO_PUBLIC_API_URL in .env');
          resolve(false);
          return;
        }

        // Build HuggingFace authorization URL
        const authUrl = new URL(HF_AUTH_ENDPOINT);
        authUrl.searchParams.set('client_id', HF_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', HF_BACKEND_REDIRECT);
        authUrl.searchParams.set('scope', 'read-repos');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('state', this.generateState());

        console.log('[HuggingFaceAuth] Full auth URL:', authUrl.toString());

        // Use openAuthSessionAsync which handles deep link return automatically
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl.toString(),
          'pensine://auth/huggingface'
        );

        console.log('[HuggingFaceAuth] Auth session result:', result.type);

        if (result.type === 'success' && result.url) {
          console.log('[HuggingFaceAuth] Callback URL:', result.url);

          // Parse the URL to get token
          const url = new URL(result.url);
          const accessToken = url.searchParams.get('access_token');
          const error = url.searchParams.get('error');

          if (error) {
            console.error('[HuggingFaceAuth] Auth error:', error);
            resolve(false);
            return;
          }

          if (accessToken) {
            this.accessToken = accessToken;
            await SecureStore.setItemAsync(TOKEN_KEY, accessToken);

            // Fetch user info
            await this.fetchUserInfo();

            console.log('[HuggingFaceAuth] Login successful:', this.user?.name);
            resolve(true);
          } else {
            console.error('[HuggingFaceAuth] No token in callback URL');
            resolve(false);
          }
        } else if (result.type === 'cancel') {
          console.log('[HuggingFaceAuth] User cancelled');
          resolve(false);
        } else {
          console.log('[HuggingFaceAuth] Auth failed:', result.type);
          resolve(false);
        }

      } catch (error) {
        console.error('[HuggingFaceAuth] Login error:', error);
        resolve(false);
      }
    });
  }

  /**
   * Generate random state for OAuth security
   */
  private generateState(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    console.log('[HuggingFaceAuth] Logging out');
    await this.clearSession();
  }

  /**
   * Get authorization header for authenticated requests
   */
  getAuthHeader(): Record<string, string> {
    if (!this.accessToken) {
      return {};
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
    };
  }

  /**
   * Check if a model requires authentication
   */
  isGatedModelUrl(url: string): boolean {
    // HuggingFace gated models patterns
    const gatedPatterns = [
      /huggingface\.co\/.*\/resolve\//,
      /huggingface\.co\/.*gemma/i,
      /huggingface\.co\/google\//,
      /huggingface\.co\/litert-community\//,
    ];

    return gatedPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Verify current token is valid
   */
  private async verifyToken(): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      const response = await fetch(HF_USER_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      console.log('[HuggingFaceAuth] Refreshing access token');

      const response = await fetch(HF_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
          client_id: HF_CLIENT_ID,
        }).toString(),
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token || this.refreshToken;

        await SecureStore.setItemAsync(TOKEN_KEY, this.accessToken);
        if (this.refreshToken) {
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, this.refreshToken);
        }

        console.log('[HuggingFaceAuth] Token refreshed successfully');
        return true;
      }

      console.error('[HuggingFaceAuth] Token refresh failed:', response.status);
      return false;
    } catch (error) {
      console.error('[HuggingFaceAuth] Token refresh error:', error);
      return false;
    }
  }

  /**
   * Fetch user info from HuggingFace API
   */
  private async fetchUserInfo(): Promise<void> {
    if (!this.accessToken) return;

    try {
      const response = await fetch(HF_USER_ENDPOINT, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.user = {
          id: data.id,
          name: data.name,
          fullname: data.fullname || data.name,
          email: data.email,
          avatarUrl: data.avatarUrl,
        };

        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(this.user));
      }
    } catch (error) {
      console.error('[HuggingFaceAuth] Failed to fetch user info:', error);
    }
  }

  /**
   * Clear all session data
   */
  private async clearSession(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;

    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  }
}
