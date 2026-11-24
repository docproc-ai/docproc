import { Hono } from 'hono'
import type { McpConfig } from '../lib/mcp-config'
import { createDiscoveryRoutes } from './discovery'

export { resourceMetadataUrl } from './discovery'

/** MCP routes (discovery now, MCP endpoint later), or null when disabled. */
export function createMcpRoutes(config: McpConfig): Hono | null {
  if (!config.enabled) return null
  const app = new Hono()
  app.route('/', createDiscoveryRoutes(config))
  return app
}
