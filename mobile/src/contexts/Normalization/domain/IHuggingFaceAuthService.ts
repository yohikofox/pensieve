/**
 * HuggingFace Authentication Service Interface
 *
 * OAuth authentication for HuggingFace gated models.
 * Enables downloading models requiring user consent (e.g., Gemma).
 *
 * Story: 3.1 - Post-Processing with LLM
 * Architecture Decision: ADR-017 - IoC/DI with TSyringe
 */

/** HuggingFace user information */
export interface HuggingFaceUser {
  id: string;
  name: string;
  fullname: string;
  email?: string;
  avatarUrl?: string;
}

/** Authentication state snapshot */
export interface AuthState {
  isAuthenticated: boolean;
  user: HuggingFaceUser | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * HuggingFace Authentication Service
 *
 * Manages OAuth 2.0 authentication with HuggingFace for gated model access.
 * Uses PKCE flow with backend proxy for secure token exchange.
 *
 * Flow:
 * 1. User initiates login
 * 2. Browser opens to HuggingFace OAuth page
 * 3. User accepts license and authorizes app
 * 4. Backend receives code and exchanges for token
 * 5. App receives token via deep link
 * 6. Token stored securely for future downloads
 */
export interface IHuggingFaceAuthService {
  /**
   * Initialize the service and restore saved session
   */
  initialize(): Promise<void>;

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState;

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean;

  /**
   * Get current user information
   */
  getUser(): HuggingFaceUser | null;

  /**
   * Get access token for API calls
   */
  getAccessToken(): string | null;

  /**
   * Initiate OAuth login flow
   * @returns true if login successful, false otherwise
   */
  login(): Promise<boolean>;

  /**
   * Logout and clear session
   */
  logout(): Promise<void>;

  /**
   * Get authorization header for authenticated requests
   * @returns Authorization header object or empty object if not authenticated
   */
  getAuthHeader(): Record<string, string>;

  /**
   * Check if a model URL requires authentication
   * @param url - Model download URL
   * @returns true if URL is for a gated model
   */
  isGatedModelUrl(url: string): boolean;
}
