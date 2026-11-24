import { Hono } from 'hono'
import type { McpConfig } from '../lib/mcp-config'
import { createDiscoveryRoutes } from './discovery'
import { handleMcp } from './endpoint'
import { createUploadRoutes } from './upload-routes'

export { resourceMetadataUrl } from './discovery'

/**
 * MCP routes (OAuth discovery, the MCP endpoint and the browser upload-link
 * API), or null when disabled.
 */
export function createMcpRoutes(config: McpConfig): Hono | null {
  if (!config.enabled) return null
  const app = new Hono()
  app.route('/', createDiscoveryRoutes(config))
  app.post(config.path, (c) => handleMcp(c, config))
  app.route('/api/mcp/uploads', createUploadRoutes())
  // Stateless server: no SSE stream to GET, no session to DELETE.
  app.on(['GET', 'DELETE'], config.path, () =>
    Response.json(
      {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      },
      { status: 405, headers: { Allow: 'POST' } },
    ),
  )
  return app
}
