import { describe, expect, it, vi } from 'vitest'

// Minimal stand-in for the better-auth instance: just what the plugin's
// metadata helpers touch. Avoids loading the db / real better-auth.
vi.mock('../lib/auth', () => {
  const issuer = 'https://d.example/api/auth'
  return {
    auth: {
      options: { plugins: [] },
      $context: Promise.resolve({
        baseURL: issuer,
        getPlugin: () => ({ options: {} }),
      }),
      api: {
        getOAuthServerConfig: async () => ({
          issuer,
          authorization_endpoint: `${issuer}/oauth2/authorize`,
          token_endpoint: `${issuer}/oauth2/token`,
          registration_endpoint: `${issuer}/oauth2/register`,
          code_challenge_methods_supported: ['S256'],
        }),
      },
    },
  }
})

// createMcpRoutes also mounts the MCP endpoint, whose user lookup imports the db.
vi.mock('../lib/db/user-operations', () => ({ getUserAccessRow: vi.fn() }))
vi.mock('./tools/read', () => ({ registerReadTools: vi.fn() }))

import type { McpConfig } from '../lib/mcp-config'
import { createMcpRoutes, resourceMetadataUrl } from './index'

const enabled: Extract<McpConfig, { enabled: true }> = {
  enabled: true,
  baseUrl: 'https://d.example',
  path: '/mcp',
  resource: 'https://d.example/mcp',
}

describe('createMcpRoutes', () => {
  it('returns null when MCP is disabled, so nothing is mounted under /.well-known', () => {
    expect(createMcpRoutes({ enabled: false })).toBeNull()
    expect(createMcpRoutes({ enabled: false, reason: 'x' })).toBeNull()
  })

  it('builds the protected-resource metadata URL', () => {
    expect(resourceMetadataUrl(enabled)).toBe(
      'https://d.example/.well-known/oauth-protected-resource/mcp',
    )
  })

  describe('when enabled', () => {
    const app = createMcpRoutes(enabled)
    if (!app) throw new Error('expected routes')

    for (const path of [
      '/.well-known/oauth-protected-resource/mcp',
      '/.well-known/oauth-protected-resource',
    ]) {
      it(`GET ${path}`, async () => {
        const res = await app.request(path)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.resource).toBe('https://d.example/mcp')
        expect(body.authorization_servers).toContain(
          'https://d.example/api/auth',
        )
        expect(body.bearer_methods_supported).toEqual(['header'])
        expect(body.scopes_supported).toBeUndefined()
      })
    }

    for (const path of [
      '/.well-known/oauth-authorization-server',
      '/.well-known/oauth-authorization-server/api/auth',
    ]) {
      it(`GET ${path}`, async () => {
        const res = await app.request(path)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.registration_endpoint).toBeTruthy()
        expect(body.authorization_endpoint).toBeTruthy()
        expect(body.token_endpoint).toBeTruthy()
        expect(body.code_challenge_methods_supported).toContain('S256')
      })
    }
  })
})

describe('createMcpRoutes with a custom path', () => {
  const custom: Extract<McpConfig, { enabled: true }> = {
    enabled: true,
    baseUrl: 'https://d.example',
    path: '/connectors/docproc',
    resource: 'https://d.example/connectors/docproc',
  }
  const app = createMcpRoutes(custom)
  if (!app) throw new Error('expected routes')

  it('builds the metadata URL from the configured path', () => {
    expect(resourceMetadataUrl(custom)).toBe(
      'https://d.example/.well-known/oauth-protected-resource/connectors/docproc',
    )
  })

  it('serves metadata at the configured path', async () => {
    const res = await app.request(
      '/.well-known/oauth-protected-resource/connectors/docproc',
    )
    expect(res.status).toBe(200)
    expect((await res.json()).resource).toBe(
      'https://d.example/connectors/docproc',
    )
  })

  it('serves the bare well-known path too', async () => {
    const res = await app.request('/.well-known/oauth-protected-resource')
    expect(res.status).toBe(200)
  })

  it('does not serve the default /mcp metadata path', async () => {
    const res = await app.request('/.well-known/oauth-protected-resource/mcp')
    expect(res.status).toBe(404)
  })
})
