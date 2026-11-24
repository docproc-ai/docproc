/**
 * MCP feature flag. MCP is off unless MCP_ENABLED is exactly 'true' and
 * BETTER_AUTH_URL is a valid absolute URL; that URL (the public base URL)
 * determines the OAuth issuer and the `/mcp` resource identifier.
 */
export type McpConfig =
  | { enabled: true; baseUrl: string; resource: string }
  | { enabled: false; reason?: string }

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

  const baseUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, '')
  return { enabled: true, baseUrl, resource: `${baseUrl}/mcp` }
}

export const mcpConfig: McpConfig = getMcpConfig()

if (!mcpConfig.enabled && mcpConfig.reason) {
  console.error(`[mcp] disabled: ${mcpConfig.reason}`)
}
