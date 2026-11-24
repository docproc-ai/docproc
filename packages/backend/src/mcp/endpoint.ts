import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { Context } from 'hono'
import type { EnabledMcpConfig } from '../lib/mcp-config'
import { loadActiveUser } from './caller'
import { resourceMetadataUrl } from './discovery'
import { createMcpServer } from './server'
import { verifyMcpAccessToken } from './token'

const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

/** DNS-rebinding protection: the public host (port-sensitive) or loopback. */
export function isAllowedHost(
  host: string | null | undefined,
  config: EnabledMcpConfig,
): boolean {
  if (!host) return false
  const h = host.toLowerCase()
  return h === new URL(config.baseUrl).host || LOOPBACK_HOST.test(h)
}

function jsonRpcError(
  status: number,
  code: number,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id: null }),
    { status, headers: { 'Content-Type': 'application/json', ...headers } },
  )
}

type LogFields = {
  status: number
  method?: string
  tool?: string
  user?: string
  client?: string
  oauthClient?: string
  protocol?: string
  reject?: string
}

/** Hard cap on a request body: 5 MB decoded upload is ~6.7 MB of base64. */
export const MAX_BODY_BYTES = 8 * 1024 * 1024

/** Reads the body once, stopping as soon as it exceeds `max`; null = too big. */
async function readBodyLimited(
  req: Request,
  max: number,
): Promise<string | null> {
  const declared = Number(req.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) return null
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Pulls the loggable fields out of an already-parsed JSON-RPC body: method,
 * tool name, client name, protocol version. Never arguments.
 */
function describeBody(
  parsed: unknown,
  req: Request,
): Pick<LogFields, 'method' | 'tool' | 'client' | 'protocol'> {
  const fields: Pick<LogFields, 'method' | 'tool' | 'client' | 'protocol'> = {
    protocol: req.headers.get('mcp-protocol-version') ?? undefined,
  }
  try {
    const messages = (Array.isArray(parsed) ? parsed : [parsed]) as {
      method?: unknown
      params?: {
        name?: unknown
        protocolVersion?: unknown
        clientInfo?: { name?: unknown }
      }
    }[]
    const str = (v: unknown) =>
      typeof v === 'string' ? v.slice(0, 100) : undefined
    const methods = messages.map((m) => str(m?.method) ?? '?')
    fields.method = methods.join(',')
    for (const m of messages) {
      if (m?.method === 'tools/call') fields.tool ??= str(m.params?.name)
      if (m?.method === 'initialize') {
        fields.client ??= str(m.params?.clientInfo?.name)
        fields.protocol = str(m.params?.protocolVersion) ?? fields.protocol
      }
    }
  } catch {
    fields.method = 'unparseable'
  }
  return fields
}

/**
 * `POST ${config.path}`: stateless Streamable HTTP. Every request is
 * authorized from scratch: host check, bearer token (verified in-process by
 * the oauth-provider plugin), then a fresh read of the user row. A new
 * McpServer bound to that caller handles the request and is closed after.
 */
export async function handleMcp(
  c: Context,
  config: EnabledMcpConfig,
): Promise<Response> {
  const log: LogFields = { status: 0 }
  try {
    const res = await authorizeAndServe(c.req.raw, config, log)
    log.status = res.status
    return res
  } catch (error) {
    console.error('[mcp] request failed:', error)
    log.status = 500
    return jsonRpcError(500, -32603, 'Internal error')
  } finally {
    console.log('[mcp]', JSON.stringify(log))
  }
}

async function authorizeAndServe(
  req: Request,
  config: EnabledMcpConfig,
  log: LogFields,
): Promise<Response> {
  const host = req.headers.get('host')
  if (!isAllowedHost(host, config)) {
    log.reject = 'host'
    return jsonRpcError(403, -32000, 'Invalid Host header')
  }

  // The global API key is deliberately not accepted here: OAuth only.
  if (!req.headers.get('authorization')) {
    log.reject = 'no_token'
    return new Response(
      JSON.stringify({ message: 'missing authorization header' }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl(config)}"`,
          'Access-Control-Expose-Headers': 'WWW-Authenticate',
        },
      },
    )
  }

  const token = await verifyMcpAccessToken(req, config)
  if (!token.ok) {
    log.reject = 'invalid_token'
    return new Response(JSON.stringify(token.body ?? {}), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...token.headers },
    })
  }
  log.user = token.userId
  log.oauthClient = token.clientId

  const caller = await loadActiveUser(token.userId)
  if (!caller) {
    log.reject = 'inactive_user'
    return jsonRpcError(
      403,
      -32001,
      'Your DocProc account no longer has access.',
    )
  }

  // Read only once the caller is known, so anonymous bodies are never read.
  const text = await readBodyLimited(req, MAX_BODY_BYTES)
  if (text === null) {
    log.reject = 'body_too_large'
    return jsonRpcError(413, -32600, 'Request body too large')
  }
  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(text)
  } catch {
    log.method = 'unparseable'
    log.reject = 'parse_error'
    return jsonRpcError(400, -32700, 'Parse error')
  }
  Object.assign(log, describeBody(parsedBody, req))

  const server = createMcpServer(caller)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY_BYTES,
  })
  try {
    await server.connect(transport)
    return await transport.handleRequest(req, { parsedBody })
  } finally {
    // JSON mode: the response is complete once handleRequest resolves.
    await server.close()
  }
}
