import { describe, expect, it } from 'vitest'
import { getMcpConfig } from './mcp-config'

describe('getMcpConfig', () => {
  it('is disabled without a reason when MCP_ENABLED is unset', () => {
    expect(getMcpConfig({})).toEqual({ enabled: false })
  })

  it('is disabled with a reason naming BETTER_AUTH_URL when it is missing', () => {
    const config = getMcpConfig({ MCP_ENABLED: 'true' })
    expect(config.enabled).toBe(false)
    expect(config.enabled === false && config.reason).toContain(
      'BETTER_AUTH_URL',
    )
  })

  it('derives baseUrl and resource from BETTER_AUTH_URL', () => {
    expect(
      getMcpConfig({
        MCP_ENABLED: 'true',
        BETTER_AUTH_URL: 'https://docs.example.com/',
      }),
    ).toEqual({
      enabled: true,
      baseUrl: 'https://docs.example.com',
      resource: 'https://docs.example.com/mcp',
    })
  })

  it('is disabled with a reason when BETTER_AUTH_URL is not a URL', () => {
    const config = getMcpConfig({
      MCP_ENABLED: 'true',
      BETTER_AUTH_URL: 'docs.example.com',
    })
    expect(config.enabled).toBe(false)
    expect(config.enabled === false && config.reason).toContain(
      'BETTER_AUTH_URL',
    )
  })

  it('only the literal "true" enables MCP', () => {
    expect(getMcpConfig({ MCP_ENABLED: '1' }).enabled).toBe(false)
    expect(
      getMcpConfig({
        MCP_ENABLED: 'TRUE',
        BETTER_AUTH_URL: 'https://docs.example.com',
      }).enabled,
    ).toBe(false)
  })
})
