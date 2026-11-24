import { readFileSync } from 'node:fs'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { EnabledMcpConfig } from '../lib/mcp-config'
import type { McpCaller } from './caller'
import { registerReadTools } from './tools/read'
import { registerWriteTools } from './tools/write'

const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string }

/**
 * A fresh MCP server for one request, bound to the caller loaded for it.
 * Tools re-check permissions at call time (see tools/helpers `guard`).
 */
export function createMcpServer(
  caller: McpCaller,
  config: EnabledMcpConfig,
): McpServer {
  const server = new McpServer({ name: 'docproc', version })
  registerReadTools(server, caller)
  registerWriteTools(server, caller, config)
  return server
}
