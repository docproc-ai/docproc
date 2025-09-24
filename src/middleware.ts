import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = getSessionCookie(request)
  const apiKey = request.headers.get('x-api-key')

  // For API routes (except auth), check for session or valid API key
  if (pathname.startsWith('/api/')) {
    // Allow unauthenticated access to the health endpoint
    if (pathname === '/api/health') {
      return NextResponse.next()
    }
    const validApiKey = process.env.API_KEY

    if (!sessionCookie && (!apiKey || !validApiKey || apiKey !== validApiKey)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // API routes are authenticated, continue
    return NextResponse.next()
  }

  // If no session and trying to access protected routes, redirect to login
  if (!sessionCookie && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    // Exclude the health endpoint so it remains public
    '/((?!api/auth|api/health|_next/static|_next/image|favicon.ico).*)',
  ],
}
