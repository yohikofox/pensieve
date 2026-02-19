/**
 * Authentication Service Interface
 *
 * Story 6.2 - Architecture Decision: Abstract auth provider
 *
 * Isolates authentication provider (Supabase) from business logic.
 * Allows easy provider swap (Supabase → Firebase → Custom) without breaking changes.
 *
 * Benefits:
 * - Single point of change when upgrading auth provider
 * - Easy to mock for testing
 * - No vendor lock-in
 */

export interface AuthSession {
  accessToken: string;
  userId: string;
  expiresAt?: number;
}

export interface IAuthService {
  /**
   * Get current authentication session (one-shot)
   * @returns Session if authenticated, null otherwise
   */
  getSession(): Promise<AuthSession | null>;

  /**
   * Subscribe to authentication state changes
   * @param callback Called when auth state changes (login/logout)
   * @returns Unsubscribe function
   */
  onAuthStateChange(
    callback: (session: AuthSession | null) => void
  ): () => void;

  /**
   * Sign in with email and password
   * Story 15.2 — Better Auth client
   */
  signIn(email: string, password: string): Promise<import('../../shared/domain/Result').Result<void>>;

  /**
   * Sign out current user and clear tokens
   * Story 15.2 — Better Auth client
   */
  signOut(): Promise<import('../../shared/domain/Result').Result<void>>;
}
