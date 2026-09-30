import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;

  // Ignore static assets, next internal paths, and API rewrites
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const isPublicAuthRoute = ['/login', '/signup', '/register'].includes(pathname);
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    ['/onboarding', '/pipeline', '/discovery', '/analytics', '/profile'].some((route) =>
      pathname.startsWith(route)
    );

  // 1. If accessing protected route without access_token cookie -> redirect to login with next param
  if (isProtectedPath && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search || ''}`);
    return NextResponse.redirect(loginUrl);
  }

  // 2. If logged in and visiting login/signup -> redirect to pipeline
  if (isPublicAuthRoute && token) {
    return NextResponse.redirect(new URL('/pipeline', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
