import { describe, expect, it } from 'vitest'
import { getMcpConfig } from '../mcp-config'
import { buildMcpAuthOptions } from './mcp-plugins'

describe('buildMcpAuthOptions', () => {
  it('adds nothing when MCP is disabled', () => {
    expect(buildMcpAuthOptions(getMcpConfig({}))).toEqual({
      plugins: [],
      disabledPaths: [],
      trustedOrigins: [],
    })
    expect(
      buildMcpAuthOptions({ enabled: false, reason: 'misconfigured' }),
    ).toEqual({ plugins: [], disabledPaths: [], trustedOrigins: [] })
  })

  it('adds the jwt and oauth-provider plugins when MCP is enabled', () => {
    const config = getMcpConfig({
      MCP_ENABLED: 'true',
      BETTER_AUTH_URL: 'https://docs.example.com',
    })
    const options = buildMcpAuthOptions(config)
    expect(options.plugins.map((p) => p.id).sort()).toEqual([
      'jwt',
      'oauth-provider',
    ])
    expect(options.disabledPaths).toEqual(['/token'])
    expect(options.trustedOrigins).toEqual(['https://docs.example.com'])
  })
})
