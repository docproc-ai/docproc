import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Temporarily disable authentication in middleware due to Edge Runtime limitations
  // Authentication will be handled in individual API routes and pages
  
  // Skip auth for API auth routes
  if (request.nextUrl.pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  // For now, allow all requests to proceed
  // TODO: Implement Edge Runtime compatible authentication
  return NextResponse.next()
}

// Apply this middleware to all routes except for Next.js internals and auth routes
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
