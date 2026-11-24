import { oauthProviderAuthServerMetadata } from '@better-auth/oauth-provider'
import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client'
import { Hono } from 'hono'
import { auth } from '../lib/auth'
import type { McpConfig } from '../lib/mcp-config'

type EnabledConfig = Extract<McpConfig, { enabled: true }>

/** URL clients fetch to learn how to authorize against `/mcp` (RFC 9728). */
export function resourceMetadataUrl(config: EnabledConfig): string {
  return `${config.baseUrl}/.well-known/oauth-protected-resource/mcp`
}

/**
 * OAuth discovery documents at the site root. better-auth only serves its
 * authorization-server metadata under `/api/auth`, but MCP clients look at
 * `/.well-known/*` (RFC 8414 / RFC 9728), so we expose them here.
 */
export function createDiscoveryRoutes(config: EnabledConfig): Hono {
  const app = new Hono()
  const resourceClient = oauthProviderResourceClient(auth).getActions()

  const protectedResource = async (): Promise<Response> => {
    // scopes_supported is omitted: the server only knows `offline_access`
    // and clients must not be told about scopes it would reject.
    const metadata = await resourceClient.getProtectedResourceMetadata({
      resource: config.resource,
      bearer_methods_supported: ['header'],
    })
    return new Response(JSON.stringify(metadata), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=15',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  const authServer = oauthProviderAuthServerMetadata(auth, {
    headers: {
      'Cache-Control': 'public, max-age=15, stale-while-revalidate=15',
      'Access-Control-Allow-Origin': '*',
    },
  })

  app.get('/.well-known/oauth-protected-resource', () => protectedResource())
  app.get('/.well-known/oauth-protected-resource/mcp', () =>
    protectedResource(),
  )
  app.get('/.well-known/oauth-authorization-server', (c) =>
    authServer(c.req.raw),
  )
  app.get('/.well-known/oauth-authorization-server/api/auth', (c) =>
    authServer(c.req.raw),
  )

  return app
}
