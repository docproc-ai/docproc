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

import type { McpConfig } from '../lib/mcp-config'
import { createMcpRoutes, resourceMetadataUrl } from './index'

const enabled: Extract<McpConfig, { enabled: true }> = {
  enabled: true,
  baseUrl: 'https://d.example',
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
