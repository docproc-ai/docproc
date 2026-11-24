import { APIError } from 'better-auth/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessTokenRequest = vi.fn()
vi.mock('@better-auth/oauth-provider/resource-client', () => ({
  oauthProviderResourceClient: () => ({
    getActions: () => ({ verifyAccessTokenRequest }),
  }),
}))
vi.mock('../lib/auth', () => ({ auth: {} }))

import type { McpConfig } from '../lib/mcp-config'
import { verifyMcpAccessToken } from './token'

const config: Extract<McpConfig, { enabled: true }> = {
  enabled: true,
  baseUrl: 'https://d.example',
  path: '/mcp',
  resource: 'https://d.example/mcp',
}
const req = () =>
  new Request('https://d.example/mcp', {
    method: 'POST',
    headers: { Authorization: 'Bearer abc' },
  })

describe('verifyMcpAccessToken', () => {
  beforeEach(() => {
    verifyAccessTokenRequest.mockReset()
  })

  it('verifies with the plugin: audience = resource, at+jwt, azp required', async () => {
    verifyAccessTokenRequest.mockResolvedValue({ sub: 'u1', azp: 'client1' })
    const request = req()
    expect(await verifyMcpAccessToken(request, config)).toEqual({
      ok: true,
      userId: 'u1',
      clientId: 'client1',
    })
    expect(verifyAccessTokenRequest).toHaveBeenCalledWith(request, {
      verifyOptions: {
        audience: 'https://d.example/mcp',
        typ: 'at+jwt',
        requiredClaims: ['azp'],
      },
    })
  })

  it("maps the plugin's 401 to a failure carrying its WWW-Authenticate", async () => {
    const header =
      'Bearer error="invalid_token", error_description="token expired", resource_metadata="https://d.example/.well-known/oauth-protected-resource/mcp"'
    verifyAccessTokenRequest.mockRejectedValue(
      new APIError(
        'UNAUTHORIZED',
        { error: 'invalid_token', error_description: 'token expired' },
        { 'WWW-Authenticate': header },
      ),
    )
    const result = await verifyMcpAccessToken(req(), config)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.headers['WWW-Authenticate']).toBe(header)
    expect(result.body).toEqual({
      error: 'invalid_token',
      error_description: 'token expired',
    })
  })

  it('rejects a token without sub', async () => {
    verifyAccessTokenRequest.mockResolvedValue({ azp: 'client1' })
    const result = await verifyMcpAccessToken(req(), config)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.headers['WWW-Authenticate']).toBe(
      'Bearer error="invalid_token", resource_metadata="https://d.example/.well-known/oauth-protected-resource/mcp"',
    )
  })

  it('rethrows non-401 failures (e.g. JWKS infrastructure)', async () => {
    verifyAccessTokenRequest.mockRejectedValue(new Error('jwks down'))
    await expect(verifyMcpAccessToken(req(), config)).rejects.toThrow(
      'jwks down',
    )
  })
})
