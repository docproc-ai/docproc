import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client'
import { isAPIError } from 'better-auth/api'
import { auth } from '../lib/auth'
import type { EnabledMcpConfig } from '../lib/mcp-config'
import { resourceMetadataUrl } from './discovery'

export type TokenResult =
  | { ok: true; userId: string; clientId?: string }
  | { ok: false; headers: Record<string, string>; body: unknown }

const makeActions = () => oauthProviderResourceClient(auth).getActions()
let actions: ReturnType<typeof makeActions> | undefined

/**
 * Verifies the request's access token in-process with the oauth-provider
 * plugin (local JWKS): JWT, audience = the MCP resource. Returns the token's
 * user id, or the plugin's 401 (its WWW-Authenticate already names the
 * resource metadata). Other failures (e.g. JWKS errors) are rethrown.
 */
export async function verifyMcpAccessToken(
  request: Request,
  config: EnabledMcpConfig,
): Promise<TokenResult> {
  actions ??= makeActions()
  try {
    const payload = await actions.verifyAccessTokenRequest(request, {
      verifyOptions: {
        audience: config.resource,
        typ: 'at+jwt',
        requiredClaims: ['azp'],
      },
    })
    if (typeof payload.sub !== 'string' || !payload.sub) {
      return {
        ok: false,
        headers: {
          'WWW-Authenticate': `Bearer error="invalid_token", resource_metadata="${resourceMetadataUrl(config)}"`,
        },
        body: { error: 'invalid_token', error_description: 'missing sub' },
      }
    }
    const azp = payload.azp
    return {
      ok: true,
      userId: payload.sub,
      clientId: typeof azp === 'string' ? azp : undefined,
    }
  } catch (error) {
    if (isAPIError(error) && error.statusCode === 401) {
      return {
        ok: false,
        headers: toHeaderRecord(error.headers),
        body: error.body,
      }
    }
    throw error
  }
}

function toHeaderRecord(headers: unknown): Record<string, string> {
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (headers && typeof headers === 'object') {
    return Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k, String(v)]),
    )
  }
  return {}
}
