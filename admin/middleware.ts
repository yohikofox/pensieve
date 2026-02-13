import { NextResponse, type NextRequest } from 'next/server';

const publicPaths = ['/login', '/first-time-setup'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if user is authenticated (token in cookie or will be read from localStorage client-side)
  // For server-side rendering, we can't access localStorage, so we redirect to login
  // The actual auth check happens client-side in the layout
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
