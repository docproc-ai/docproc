import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ServiceError } from '../../services/errors'
import {
  checkPermission,
  type McpAction,
  type McpCaller,
  type McpResource,
} from '../caller'

/** A tool-level failure the model can read and act on. */
export function toolError(text: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text }] }
}

/** A JSON tool result; plain objects are also sent as structuredContent. */
export function toolJson(value: unknown): CallToolResult {
  const result: CallToolResult = {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    result.structuredContent = value as Record<string, unknown>
  }
  return result
}

/**
 * Runs a tool body only if the caller holds `resource:action` right now
 * (checked live via better-auth on every call). Service errors become their
 * user-facing message; anything else is logged and hidden.
 */
export async function guard(
  caller: McpCaller,
  resource: McpResource,
  action: McpAction,
  fn: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  if (!(await checkPermission(caller, resource, action))) {
    return toolError(
      `Your DocProc role is \`${caller.role}\`; this needs ${resource}:${action}. Ask an admin for access.`,
    )
  }
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ServiceError) return toolError(error.message)
    console.error(`[mcp] ${resource}:${action} tool failed:`, error)
    return toolError('Something went wrong; the error was logged.')
  }
}
