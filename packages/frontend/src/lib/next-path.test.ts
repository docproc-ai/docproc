import { describe, expect, it } from 'vitest'
import { safeNextPath } from './next-path'

describe('safeNextPath', () => {
  it('allows an upload page', () => {
    expect(safeNextPath('/upload/AbC_-123')).toBe('/upload/AbC_-123')
  })

  it.each([
    null,
    undefined,
    '',
    'https://evil.example',
    '//evil.example',
    '/users',
    '/upload/',
    '/upload',
    '/upload/a/b',
    '/upload/a?x=1',
    '/upload/a#x',
    '/upload/..',
    '/upload/a\n',
    'javascript:alert(1)',
    '/\\evil.example',
  ])('ignores %j', (next) => {
    expect(safeNextPath(next)).toBeNull()
  })
})
