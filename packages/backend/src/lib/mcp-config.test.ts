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
      path: '/mcp',
      resource: 'https://docs.example.com/mcp',
    })
  })

  it('honours a custom MCP_PATH', () => {
    expect(
      getMcpConfig({
        MCP_ENABLED: 'true',
        BETTER_AUTH_URL: 'https://docs.example.com',
        MCP_PATH: '/connectors/docproc',
      }),
    ).toEqual({
      enabled: true,
      baseUrl: 'https://docs.example.com',
      path: '/connectors/docproc',
      resource: 'https://docs.example.com/connectors/docproc',
    })
  })

  it.each([
    'mcp',
    '/mcp/',
    '/',
    '/api/mcp',
    '/api',
    '/.well-known/x',
    '/a/../b',
    '/a/./b',
    '/a b',
    '/oauth',
    '/users/x',
  ])('is disabled with a reason naming MCP_PATH for %j', (path) => {
    const config = getMcpConfig({
      MCP_ENABLED: 'true',
      BETTER_AUTH_URL: 'https://docs.example.com',
      MCP_PATH: path,
    })
    expect(config.enabled).toBe(false)
    expect(config.enabled === false && config.reason).toContain('MCP_PATH')
  })

  it('allows a path that merely shares a prefix with a reserved one', () => {
    const config = getMcpConfig({
      MCP_ENABLED: 'true',
      BETTER_AUTH_URL: 'https://docs.example.com',
      MCP_PATH: '/apiary',
    })
    expect(config.enabled).toBe(true)
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

  it('is disabled with a reason when BETTER_AUTH_URL has a sub-path', () => {
    for (const BETTER_AUTH_URL of [
      'https://docs.example.com/docproc',
      'https://docs.example.com/docproc/',
    ]) {
      const config = getMcpConfig({ MCP_ENABLED: 'true', BETTER_AUTH_URL })
      expect(config.enabled).toBe(false)
      expect(config.enabled === false && config.reason).toContain(
        'BETTER_AUTH_URL',
      )
    }
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
