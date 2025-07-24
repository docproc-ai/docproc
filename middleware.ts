import { NextRequest, NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = getSessionCookie(request)
  const apiKey = request.headers.get('x-api-key')

  // Skip auth for API auth routes and static files
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('/favicon.ico') ||
    pathname.includes('/placeholder')
  ) {
    return NextResponse.next()
  }

  // If user has session and tries to access login page, redirect to dashboard
  if (sessionCookie && pathname === '/login') {
    return NextResponse.redirect(new URL('/document-types', request.url))
  }

  // For API routes (except auth), check for session or valid API key
  if (pathname.startsWith('/api/')) {
    const validApiKey = process.env.API_KEY
    
    if (!sessionCookie && (!apiKey || !validApiKey || apiKey !== validApiKey)) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
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
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
