import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Same minimal better-auth stand-in as discovery.test.ts (the discovery
// routes are mounted next to the endpoint). Never loads the db.
vi.mock('../lib/auth', () => {
  const issuer = 'https://d.example/api/auth'
  return {
    auth: {
      options: { plugins: [] },
      $context: Promise.resolve({
        baseURL: issuer,
        getPlugin: () => ({ options: {} }),
      }),
      api: { getOAuthServerConfig: async () => ({ issuer }) },
    },
  }
})
vi.mock('./token', () => ({ verifyMcpAccessToken: vi.fn() }))
vi.mock('./caller', () => ({
  loadActiveUser: vi.fn(),
  checkPermission: vi.fn(),
}))
// A stand-in tool that echoes the caller it was built for, so a tools/call
// proves which user the per-request server received.
vi.mock('./tools/write', () => ({ registerWriteTools: vi.fn() }))
vi.mock('./tools/read', () => ({
  registerReadTools: (
    server: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer,
    caller: import('./caller').McpCaller,
  ) => {
    server.registerTool('whoami', { description: 'test' }, async () => ({
      content: [{ type: 'text', text: caller.id }],
    }))
  },
}))

import type { McpConfig } from '../lib/mcp-config'
import { loadActiveUser, type McpCaller } from './caller'
import { createMcpRoutes } from './index'
import { verifyMcpAccessToken } from './token'

const verify = vi.mocked(verifyMcpAccessToken)
const loadUser = vi.mocked(loadActiveUser)
const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
afterAll(() => {
  logSpy.mockRestore()
  errSpy.mockRestore()
})

const config = (path = '/mcp'): Extract<McpConfig, { enabled: true }> => ({
  enabled: true,
  baseUrl: 'https://d.example',
  path,
  resource: `https://d.example${path}`,
})

const USER: McpCaller = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'u@example.com',
  name: 'U',
  role: 'user',
}

const rpc = (method: string, params: Record<string, unknown> = {}, id = 1) =>
  JSON.stringify({ jsonrpc: '2.0', id, method, params })

function post(
  app: ReturnType<typeof createMcpRoutes>,
  opts: {
    path?: string
    host?: string
    headers?: Record<string, string>
    body?: string
  } = {},
) {
  if (!app) throw new Error('expected routes')
  return app.request(`https://d.example${opts.path ?? '/mcp'}`, {
    method: 'POST',
    headers: {
      Host: opts.host ?? 'd.example',
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...opts.headers,
    },
    body: opts.body ?? rpc('tools/list'),
  })
}
const bearer = { Authorization: 'Bearer good-token' }

describe('MCP endpoint', () => {
  const app = createMcpRoutes(config())

  beforeEach(() => {
    verify.mockReset()
    loadUser.mockReset()
    verify.mockResolvedValue({ ok: true, userId: USER.id, clientId: 'c1' })
    loadUser.mockResolvedValue(USER)
  })

  it('401s without Authorization, pointing at the resource metadata', async () => {
    const res = await post(app)
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe(
      'Bearer resource_metadata="https://d.example/.well-known/oauth-protected-resource/mcp"',
    )
    expect(verify).not.toHaveBeenCalled()
  })

  it('does not accept the global API key', async () => {
    const res = await post(app, { headers: { 'x-api-key': 'the-api-key' } })
    expect(res.status).toBe(401)
    expect(loadUser).not.toHaveBeenCalled()
  })

  it("passes the plugin's 401 through for an invalid token", async () => {
    const header =
      'Bearer error="invalid_token", error_description="token expired", resource_metadata="https://d.example/.well-known/oauth-protected-resource/mcp"'
    verify.mockResolvedValue({
      ok: false,
      headers: { 'WWW-Authenticate': header },
      body: { error: 'invalid_token', error_description: 'token expired' },
    })
    const res = await post(app, { headers: bearer })
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe(header)
    expect(loadUser).not.toHaveBeenCalled()
  })

  it('403s with a JSON-RPC error when the user no longer has access', async () => {
    loadUser.mockResolvedValue(null)
    const res = await post(app, { headers: bearer })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Your DocProc account no longer has access.',
      },
      id: null,
    })
    expect(loadUser).toHaveBeenCalledWith(USER.id)
  })

  it('403s a foreign Host before verifying the token', async () => {
    const res = await post(app, { host: 'evil.example', headers: bearer })
    expect(res.status).toBe(403)
    expect(verify).not.toHaveBeenCalled()
  })

  it('403s a request with no Host header (fail closed)', async () => {
    if (!app) throw new Error('expected routes')
    const res = await app.request('https://d.example/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...bearer,
      },
      body: rpc('tools/list'),
    })
    expect(res.status).toBe(403)
    expect(verify).not.toHaveBeenCalled()
  })

  it('413s a body over 8 MiB with a JSON-RPC error', async () => {
    const res = await post(app, {
      headers: bearer,
      body: rpc('tools/call', {
        name: 'whoami',
        pad: 'x'.repeat(8 * 1024 * 1024),
      }),
    })
    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Request body too large' },
      id: null,
    })
  })

  it('accepts a ~6 MB body (reaches the transport)', async () => {
    const res = await post(app, {
      headers: bearer,
      body: rpc('tools/call', {
        name: 'whoami',
        arguments: {},
        pad: 'x'.repeat(6 * 1024 * 1024),
      }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).result.content[0].text).toBe(USER.id)
  })

  it('answers malformed JSON with a parse error', async () => {
    const res = await post(app, { headers: bearer, body: '{nope' })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe(-32700)
  })

  it('403s a Host on the right name but the wrong port', async () => {
    const res = await post(app, { host: 'd.example:8443', headers: bearer })
    expect(res.status).toBe(403)
  })

  for (const host of [
    'd.example',
    'D.EXAMPLE',
    'localhost:3001',
    '127.0.0.1:9',
    '[::1]:3000',
  ]) {
    it(`accepts Host ${host}`, async () => {
      const res = await post(app, { host, headers: bearer })
      expect(res.status).toBe(200)
      expect(verify).toHaveBeenCalled()
    })
  }

  it('answers tools/list with 200 JSON and no session id', async () => {
    const res = await post(app, { headers: bearer })
    expect(res.status).toBe(200)
    expect(res.headers.get('mcp-session-id')).toBeNull()
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.json()
    expect(body.result.tools.map((t: { name: string }) => t.name)).toContain(
      'whoami',
    )
  })

  it('answers initialize as server docproc', async () => {
    const res = await post(app, {
      headers: bearer,
      body: rpc('initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1' },
      }),
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('mcp-session-id')).toBeNull()
    const body = await res.json()
    expect(body.result.serverInfo.name).toBe('docproc')
  })

  it('re-reads the user on every request (live authorization)', async () => {
    loadUser.mockResolvedValueOnce(USER).mockResolvedValueOnce(null)
    const call = rpc('tools/call', { name: 'whoami', arguments: {} })

    const first = await post(app, { headers: bearer, body: call })
    expect(first.status).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.result.content[0].text).toBe(USER.id)

    const second = await post(app, { headers: bearer, body: call })
    expect(second.status).toBe(403)
    expect((await second.json()).error.message).toBe(
      'Your DocProc account no longer has access.',
    )
    expect(loadUser).toHaveBeenCalledTimes(2)
    expect(verify).toHaveBeenCalledTimes(2)
  })

  it('logs one line per request without tokens or arguments', async () => {
    logSpy.mockClear()
    await post(app, {
      headers: bearer,
      body: rpc('tools/call', {
        name: 'whoami',
        arguments: { secret: 'do-not-log' },
      }),
    })
    const lines = logSpy.mock.calls.filter((c) => c[0] === '[mcp]')
    expect(lines).toHaveLength(1)
    const text = lines[0].join(' ')
    expect(text).toContain('tools/call')
    expect(text).toContain('whoami')
    expect(text).toContain(USER.id)
    expect(text).not.toContain('do-not-log')
    expect(text).not.toContain('good-token')
  })

  it('500s (JSON-RPC internal error) when verification itself fails', async () => {
    verify.mockRejectedValue(new Error('jwks down'))
    const res = await post(app, { headers: bearer })
    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe(-32603)
  })

  for (const method of ['GET', 'DELETE']) {
    it(`${method} /mcp → 405`, async () => {
      if (!app) throw new Error('expected routes')
      const res = await app.request('https://d.example/mcp', {
        method,
        headers: { Host: 'd.example', ...bearer },
      })
      expect(res.status).toBe(405)
    })
  }
})

describe('MCP endpoint at a custom MCP_PATH', () => {
  const app = createMcpRoutes(config('/connectors/docproc'))

  it('serves POST at the configured path', async () => {
    const res = await post(app, { path: '/connectors/docproc' })
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toBe(
      'Bearer resource_metadata="https://d.example/.well-known/oauth-protected-resource/connectors/docproc"',
    )
  })

  it('does not serve /mcp', async () => {
    const res = await post(app, { path: '/mcp', headers: bearer })
    expect(res.status).toBe(404)
  })
})
