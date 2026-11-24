import { describe, expect, it } from 'vitest'
import { describeAccess, describeDestination } from './consent-text'

describe('describeDestination', () => {
  it('returns the host for a web redirect', () => {
    expect(describeDestination('https://claude.ai/api/mcp/auth_callback')).toBe(
      'claude.ai',
    )
  })

  it('describes loopback redirects as a local program', () => {
    expect(describeDestination('http://127.0.0.1:33418/callback')).toBe(
      'a program on this computer',
    )
    expect(describeDestination('http://localhost:1234/cb')).toBe(
      'a program on this computer',
    )
    expect(describeDestination('http://[::1]:1234/cb')).toBe(
      'a program on this computer',
    )
  })

  it('describes private-use scheme redirects as a local app', () => {
    expect(describeDestination('com.example.app:/callback')).toBe(
      'an app on this computer (com.example.app)',
    )
  })

  it('handles unparseable input', () => {
    expect(describeDestination('not a url')).toBe('an unknown destination')
  })
})

describe('describeAccess', () => {
  const user = [
    'Read document types',
    'Upload, process, edit, approve and reject documents',
  ]

  it('lists user access', () => {
    expect(describeAccess('user')).toEqual(user)
  })

  it('adds document type editing for admins', () => {
    expect(describeAccess('admin')).toEqual([
      ...user,
      'Create and edit document types',
    ])
  })
})
