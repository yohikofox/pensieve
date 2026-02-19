/**
 * Auth Listener Hook — Better Auth
 *
 * Story 15.2 — Migration Client Mobile Better Auth
 * ADR-029: Better Auth comme provider d'authentification
 * ADR-022: Tokens dans expo-secure-store
 *
 * Remplace l'ancien hook Supabase.
 */

import { useEffect, useState } from 'react';
import { container } from '../../../infrastructure/di/container';
import type { IAuthService } from '../domain/IAuthService';

interface AuthUser {
  id: string;
}

export const useAuthListener = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Résolution lazy via DI — conforme ADR-021 (jamais au niveau module)
    const authService = container.resolve<IAuthService>('IAuthService');

    // Vérifie la session existante au mount (cold start / refresh)
    const checkSession = async () => {
      const session = await authService.getSession();
      setUser(session ? { id: session.userId } : null);
      setLoading(false);
    };

    void checkSession();

    // S'abonne aux changements d'état auth (signIn / signOut)
    const unsubscribe = authService.onAuthStateChange((session) => {
      setUser(session ? { id: session.userId } : null);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
};
