/**
 * Supabase Authentication Service
 *
 * Story 6.2 - Architecture Decision: Isolate Supabase dependency
 *
 * SINGLE SOURCE OF TRUTH for Supabase auth integration.
 * All Supabase auth calls MUST go through this service.
 *
 * Benefits:
 * - Supabase upgrade v2 → v3 = modify only THIS file
 * - Easy to swap provider (create FirebaseAuthService implementing IAuthService)
 * - Easy to test (mock IAuthService instead of Supabase)
 */

import { injectable } from 'tsyringe';
import { supabase } from '../../../lib/supabase';
import type { IAuthService, AuthSession } from '../domain/IAuthService';

@injectable()
export class SupabaseAuthService implements IAuthService {
  /**
   * Get current session
   */
  async getSession(): Promise<AuthSession | null> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token || !session?.user?.id) {
      return null;
    }

    return {
      accessToken: session.access_token,
      userId: session.user.id,
      expiresAt: session.expires_at ? new Date(session.expires_at).getTime() : undefined,
    };
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
      if (!supabaseSession?.access_token || !supabaseSession?.user?.id) {
        callback(null);
        return;
      }

      const session: AuthSession = {
        accessToken: supabaseSession.access_token,
        userId: supabaseSession.user.id,
        expiresAt: supabaseSession.expires_at
          ? new Date(supabaseSession.expires_at).getTime()
          : undefined,
      };

      callback(session);
    });

    return () => subscription.unsubscribe();
  }
}
