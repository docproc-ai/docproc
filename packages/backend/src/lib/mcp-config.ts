/**
 * MCP feature flag. MCP is off unless MCP_ENABLED is exactly 'true' and
 * BETTER_AUTH_URL is a valid absolute URL; that URL (the public base URL)
 * determines the OAuth issuer and, with MCP_PATH (default `/mcp`), the
 * resource identifier.
 */
export type McpConfig =
  | { enabled: true; baseUrl: string; path: string; resource: string }
  | { enabled: false; reason?: string }

/** The config once MCP is known to be on. */
export type EnabledMcpConfig = Extract<McpConfig, { enabled: true }>

const DEFAULT_MCP_PATH = '/mcp'

/** Paths owned by the app; the MCP endpoint may not be at or under these. */
const RESERVED_PREFIXES = [
  '/api',
  '/ws',
  '/assets',
  '/.well-known',
  '/health',
  '/login',
  '/oauth',
  '/users',
  '/document-types',
]

/** Returns an error message, or null when `path` is a valid MCP_PATH. */
function validateMcpPath(path: string): string | null {
  const bad = (why: string) => `MCP_PATH (${path}) ${why}`
  if (!path.startsWith('/')) return bad('must start with "/"')
  if (path === '/') return bad('must not be "/" alone')
  if (path.endsWith('/')) return bad('must not end with "/"')
  const segments = path.slice(1).split('/')
  for (const seg of segments) {
    if (seg === '.' || seg === '..') return bad('must not contain "." or ".."')
    if (!/^[A-Za-z0-9._~-]+$/.test(seg)) {
      return bad('may only contain segments of [A-Za-z0-9._~-]')
    }
  }
  const reserved = RESERVED_PREFIXES.find(
    (p) => path === p || path.startsWith(`${p}/`),
  )
  if (reserved) return bad(`must not be at or under reserved path ${reserved}`)
  return null
}

export function getMcpConfig(
  env: Record<string, string | undefined> = process.env,
): McpConfig {
  if (env.MCP_ENABLED !== 'true') {
    return { enabled: false }
  }

  const rawUrl = env.BETTER_AUTH_URL?.trim()
  if (!rawUrl) {
    return {
      enabled: false,
      reason:
        'MCP_ENABLED=true but BETTER_AUTH_URL is not set; set it to the public base URL to enable MCP',
    }
  }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return {
      enabled: false,
      reason: `MCP_ENABLED=true but BETTER_AUTH_URL (${rawUrl}) is not a valid URL`,
    }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      enabled: false,
      reason: `MCP_ENABLED=true but BETTER_AUTH_URL (${rawUrl}) must be an http(s) URL`,
    }
  }
  // DocProc is served from the origin root; a sub-path would break discovery.
  if (url.pathname.replace(/\/+$/, '') !== '') {
    return {
      enabled: false,
      reason: `MCP_ENABLED=true but BETTER_AUTH_URL (${rawUrl}) must not have a path; DocProc does not support sub-path hosting`,
    }
  }

  const path = env.MCP_PATH?.trim() || DEFAULT_MCP_PATH
  const pathError = validateMcpPath(path)
  if (pathError) {
    return { enabled: false, reason: `MCP_ENABLED=true but ${pathError}` }
  }

  const baseUrl = url.origin
  return { enabled: true, baseUrl, path, resource: `${baseUrl}${path}` }
}

export const mcpConfig: McpConfig = getMcpConfig()

if (!mcpConfig.enabled && mcpConfig.reason) {
  console.error(`[mcp] disabled: ${mcpConfig.reason}`)
}
