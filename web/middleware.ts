import { NextRequest, NextResponse } from 'next/server';

/**
 * Route protection middleware for /dashboard/* routes.
 *
 * ADR-029: Better Auth — session validation à implémenter
 * quand les routes /dashboard seront créées.
 * Pour l'instant, le web n'a que des pages publiques (landing, privacy).
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
