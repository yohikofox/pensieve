import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

/**
 * Better Auth client — ADR-029
 *
 * Used for managing regular users via the Better Auth admin plugin.
 * Admin backoffice login uses a separate JWT flow (/api/auth/admin/login).
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  plugins: [adminClient()],
});

/**
 * Returns the admin JWT token stored in localStorage after admin login.
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

/**
 * Signs out the admin user by clearing localStorage and redirecting to login.
 */
export function signOut(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/login';
}
