const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** Human-readable description of where an authorization will be sent. */
export function describeDestination(redirectUri: string): string {
  let url: URL
  try {
    url = new URL(redirectUri)
  } catch {
    return 'an unknown destination'
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    const scheme = url.protocol.replace(/:$/, '')
    return scheme
      ? `an app on this computer (${scheme})`
      : 'an unknown destination'
  }
  if (LOOPBACK_HOSTS.has(url.hostname)) return 'a program on this computer'
  return url.hostname || 'an unknown destination'
}

/** What a connected app may do on behalf of a user with the given role. */
export function describeAccess(role: 'user' | 'admin'): string[] {
  const access = [
    'Read document types',
    'Upload, process, edit, approve and reject documents',
  ]
  if (role === 'admin') access.push('Create and edit document types')
  return access
}
