import { describe, expect, it } from 'vitest'
import { roles } from './permissions'

// The real role mapping that MCP tool guards (and REST routes) rely on.
const can = (
  role: keyof typeof roles,
  permissions: Parameters<(typeof roles)['user']['authorize']>[0],
) => roles[role].authorize(permissions).success

describe('roles', () => {
  it('user can work with documents but not manage types', () => {
    expect(can('user', { document: ['update'] })).toBe(true)
    expect(can('user', { document: ['create', 'list'] })).toBe(true)
    expect(can('user', { documentType: ['list'] })).toBe(true)
    expect(can('user', { documentType: ['create'] })).toBe(false)
    expect(can('user', { documentType: ['update'] })).toBe(false)
  })

  it('admin can manage document types', () => {
    expect(can('admin', { documentType: ['create', 'update'] })).toBe(true)
    expect(can('admin', { document: ['update'] })).toBe(true)
  })

  it('none can do nothing', () => {
    expect(can('none', { document: ['list'] })).toBe(false)
    expect(can('none', { documentType: ['list'] })).toBe(false)
  })
})
