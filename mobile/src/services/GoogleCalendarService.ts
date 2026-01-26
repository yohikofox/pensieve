/**
 * Google Calendar Service
 *
 * Handles OAuth2 authentication with Google and Calendar API operations.
 * Uses backend proxy for OAuth flow (same pattern as HuggingFace).
 *
 * Flow:
 * 1. Mobile opens browser to Google OAuth with backend as redirect
 * 2. Google redirects to backend with auth code
 * 3. Backend exchanges code for token
 * 4. Backend redirects to pensine://auth/google?access_token=XXX
 * 5. Mobile receives token via deep link
 */

import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

// Complete any pending auth sessions when app loads
WebBrowser.maybeCompleteAuthSession();

// Configuration
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const GOOGLE_BACKEND_REDIRECT = `${API_URL}/auth/google/callback`;
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

// Scopes needed for calendar
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// Storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'google_access_token',
  REFRESH_TOKEN: 'google_refresh_token',
  TOKEN_EXPIRY: 'google_token_expiry',
  USER_EMAIL: 'google_user_email',
};

export interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  startDateTime: Date;
  endDateTime?: Date;
}

export interface GoogleAuthState {
  isConnected: boolean;
  userEmail: string | null;
  isLoading: boolean;
}

class GoogleCalendarServiceClass {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private userEmail: string | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the service and restore saved session
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Restore tokens from secure storage
      this.accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      this.refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      this.userEmail = await SecureStore.getItemAsync(STORAGE_KEYS.USER_EMAIL);

      // Verify token is still valid if we have one
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
      console.log('[GoogleCalendar] Initialized, connected:', !!this.accessToken);
    } catch (error) {
      console.error('[GoogleCalendar] Initialization error:', error);
      await this.clearSession();
      this.isInitialized = true;
    }
  }

  /**
   * Check if user is connected to Google
   */
  async isConnected(): Promise<boolean> {
    await this.initialize();
    return !!this.accessToken;
  }

  /**
   * Get connected user email
   */
  async getUserEmail(): Promise<string | null> {
    await this.initialize();
    return this.userEmail;
  }

  /**
   * Get current auth state
   */
  async getAuthState(): Promise<GoogleAuthState> {
    await this.initialize();
    return {
      isConnected: !!this.accessToken,
      userEmail: this.userEmail,
      isLoading: false,
    };
  }

  /**
   * Initiate OAuth login flow via backend proxy
   *
   * Flow:
   * 1. Open browser to Google OAuth with backend as redirect
   * 2. Backend receives code, exchanges for token
   * 3. Backend redirects to pensine://auth/google?access_token=XXX
   * 4. App receives token via deep link
   */
  async connect(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[GoogleCalendar] Starting OAuth login flow via backend');
      console.log('[GoogleCalendar] Config:', {
        GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID ? '(set)' : '(empty)',
        GOOGLE_BACKEND_REDIRECT,
      });

      if (!GOOGLE_CLIENT_ID) {
        console.error('[GoogleCalendar] ERROR: GOOGLE_CLIENT_ID is empty!');
        return { success: false, error: 'Google Client ID non configuré' };
      }

      // Generate state for security
      const state = this.generateState();

      // Build Google authorization URL
      const authUrl = new URL(GOOGLE_AUTH_ENDPOINT);
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', GOOGLE_BACKEND_REDIRECT);
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      console.log('[GoogleCalendar] Opening auth URL...');

      // Use openAuthSessionAsync which handles deep link return automatically
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl.toString(),
        'pensine://auth/google'
      );

      console.log('[GoogleCalendar] Auth session result:', result.type);

      if (result.type === 'success' && result.url) {
        console.log('[GoogleCalendar] Callback URL:', result.url);

        // Parse the URL to get token
        const url = new URL(result.url);
        const accessToken = url.searchParams.get('access_token');
        const refreshToken = url.searchParams.get('refresh_token');
        const expiresIn = url.searchParams.get('expires_in');
        const error = url.searchParams.get('error');

        if (error) {
          console.error('[GoogleCalendar] Auth error:', error);
          return { success: false, error };
        }

        if (accessToken) {
          this.accessToken = accessToken;
          await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken);

          if (refreshToken) {
            this.refreshToken = refreshToken;
            await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
          }

          if (expiresIn) {
            const expiry = Date.now() + parseInt(expiresIn, 10) * 1000;
            await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_EXPIRY, expiry.toString());
          }

          // Fetch user email
          await this.fetchUserEmail();

          console.log('[GoogleCalendar] Login successful:', this.userEmail);
          return { success: true };
        } else {
          console.error('[GoogleCalendar] No token in callback URL');
          return { success: false, error: 'Pas de token reçu' };
        }
      } else if (result.type === 'cancel') {
        console.log('[GoogleCalendar] User cancelled');
        return { success: false, error: 'Connexion annulée' };
      } else {
        console.log('[GoogleCalendar] Auth failed:', result.type);
        return { success: false, error: 'Échec de la connexion' };
      }
    } catch (error) {
      console.error('[GoogleCalendar] Connect error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
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
   * Disconnect Google account
   */
  async disconnect(): Promise<void> {
    console.log('[GoogleCalendar] Disconnecting');
    await this.clearSession();
  }

  /**
   * Create a calendar event
   */
  async createEvent(event: GoogleCalendarEvent): Promise<{ success: boolean; eventId?: string; error?: string }> {
    await this.initialize();

    if (!this.accessToken) {
      return { success: false, error: 'Non connecté à Google' };
    }

    try {
      // Default end time: 1 hour after start
      const endDateTime = event.endDateTime || new Date(event.startDateTime.getTime() + 60 * 60 * 1000);

      const eventData = {
        summary: event.summary,
        description: event.description || '',
        start: {
          dateTime: event.startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventData),
        }
      );

      if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await this.refreshAccessToken();
        if (refreshed) {
          // Retry the request
          return this.createEvent(event);
        }
        return { success: false, error: 'Session expirée, reconnectez-vous' };
      }

      if (!response.ok) {
        const error = await response.json();
        console.error('[GoogleCalendar] Create event error:', error);
        return { success: false, error: error.error?.message || 'Erreur API Google' };
      }

      const createdEvent = await response.json();
      console.log('[GoogleCalendar] Event created:', createdEvent.id);

      return { success: true, eventId: createdEvent.id };
    } catch (error) {
      console.error('[GoogleCalendar] Create event error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  // Private methods

  private async verifyToken(): Promise<boolean> {
    if (!this.accessToken) return false;

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      console.log('[GoogleCalendar] Refreshing access token via backend');

      // Call backend to refresh token
      const response = await fetch(`${API_URL}/auth/google/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.access_token;

        await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);

        if (data.expires_in) {
          const expiry = Date.now() + data.expires_in * 1000;
          await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN_EXPIRY, expiry.toString());
        }

        console.log('[GoogleCalendar] Token refreshed successfully');
        return true;
      }

      console.error('[GoogleCalendar] Token refresh failed:', response.status);
      return false;
    } catch (error) {
      console.error('[GoogleCalendar] Token refresh error:', error);
      return false;
    }
  }

  private async fetchUserEmail(): Promise<void> {
    if (!this.accessToken) return;

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (response.ok) {
        const userInfo = await response.json();
        if (userInfo.email) {
          this.userEmail = userInfo.email;
          await SecureStore.setItemAsync(STORAGE_KEYS.USER_EMAIL, userInfo.email);
        }
      }
    } catch (e) {
      console.log('[GoogleCalendar] Failed to fetch user email:', e);
    }
  }

  private async clearSession(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.userEmail = null;

    await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN_EXPIRY);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL);
  }
}

// Export singleton instance
export const GoogleCalendarService = new GoogleCalendarServiceClass();
