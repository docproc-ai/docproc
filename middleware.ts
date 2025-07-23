import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const envUser = process.env.AUTH_USERNAME
  const envPass = process.env.AUTH_PASSWORD

  // If auth credentials are not set in the environment, we cannot authenticate.
  // It's better to deny access than to allow it insecurely.
  // A non-empty string check is important.
  if (!envUser || !envPass) {
    console.error(
      'Authentication credentials are not set in the environment (AUTH_USERNAME, AUTH_PASSWORD).',
    )
    // Return a 500 error to indicate a server configuration issue.
    return new NextResponse('Internal Server Error: Authentication not configured.', {
      status: 500,
    })
  }

  const authHeader = request.headers.get('authorization')

  if (authHeader) {
    const [scheme, credentials] = authHeader.split(' ')

    if (scheme === 'Basic' && credentials) {
      try {
        const decoded = atob(credentials)
        const [username, password] = decoded.split(':')

        if (username === envUser && password === envPass) {
          // If credentials are valid, proceed with the request
          return NextResponse.next()
        }
      } catch (error) {
        console.error('Error decoding Basic Auth credentials:', error)
        // Fall through to the 401 response
      }
    }
  }

  // If authentication fails or is missing, prompt the user.
  // The 'WWW-Authenticate' header triggers the browser's native login prompt.
  return new NextResponse('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Secure Area"',
    },
  })
}

// Apply this middleware to all routes except for Next.js internals.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
