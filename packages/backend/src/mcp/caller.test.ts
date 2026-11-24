import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db/user-operations', () => ({ getUserAccessRow: vi.fn() }))
vi.mock('../lib/auth', () => ({
  auth: { api: { userHasPermission: vi.fn() } },
}))

import { auth } from '../lib/auth'
import { getUserAccessRow, type UserAccessRow } from '../lib/db/user-operations'
import { checkPermission, loadActiveUser, type McpCaller } from './caller'

const getRow = vi.mocked(getUserAccessRow)
const userHasPermission = vi.mocked(auth.api.userHasPermission)

const ID = '11111111-1111-4111-8111-111111111111'
const now = new Date('2026-11-24T12:00:00Z')
const HOUR = 60 * 60 * 1000

const row = (over: Partial<UserAccessRow>): UserAccessRow => ({
  id: ID,
  email: 'u@example.com',
  name: 'U',
  role: 'user',
  banned: false,
  banExpires: null,
  ...over,
})

describe('loadActiveUser', () => {
  beforeEach(() => {
    getRow.mockReset()
  })

  it('returns null for a missing user', async () => {
    getRow.mockResolvedValue(null)
    expect(await loadActiveUser(ID, now)).toBeNull()
  })

  it('returns null for role none', async () => {
    getRow.mockResolvedValue(row({ role: 'none' }))
    expect(await loadActiveUser(ID, now)).toBeNull()
  })

  it('returns null for an unknown role (fails closed)', async () => {
    getRow.mockResolvedValue(row({ role: 'superuser' }))
    expect(await loadActiveUser(ID, now)).toBeNull()
  })

  it('returns null for a permanent ban', async () => {
    getRow.mockResolvedValue(row({ banned: true, banExpires: null }))
    expect(await loadActiveUser(ID, now)).toBeNull()
  })

  it('returns the caller when the ban expired an hour ago', async () => {
    getRow.mockResolvedValue(
      row({ banned: true, banExpires: new Date(now.getTime() - HOUR) }),
    )
    expect(await loadActiveUser(ID, now)).toEqual({
      id: ID,
      email: 'u@example.com',
      name: 'U',
      role: 'user',
    })
  })

  it('returns null while the ban is still running', async () => {
    getRow.mockResolvedValue(
      row({ banned: true, banExpires: new Date(now.getTime() + HOUR) }),
    )
    expect(await loadActiveUser(ID, now)).toBeNull()
  })

  it('returns {id, email, name, role} for an active user', async () => {
    getRow.mockResolvedValue(row({ role: 'user' }))
    expect(await loadActiveUser(ID, now)).toEqual({
      id: ID,
      email: 'u@example.com',
      name: 'U',
      role: 'user',
    })
    expect(getRow).toHaveBeenCalledWith(ID)
  })

  it('returns an admin caller', async () => {
    getRow.mockResolvedValue(row({ role: 'admin' }))
    expect((await loadActiveUser(ID, now))?.role).toBe('admin')
  })

  it('reads the database on every call (no caching)', async () => {
    getRow.mockResolvedValueOnce(row({ role: 'user' }))
    getRow.mockResolvedValueOnce(row({ role: 'none' }))
    expect(await loadActiveUser(ID, now)).not.toBeNull()
    expect(await loadActiveUser(ID, now)).toBeNull()
    expect(getRow).toHaveBeenCalledTimes(2)
  })

  it('returns null for a non-uuid id without querying', async () => {
    expect(await loadActiveUser('not-a-uuid', now)).toBeNull()
    expect(getRow).not.toHaveBeenCalled()
  })
})

describe('checkPermission', () => {
  const caller: McpCaller = {
    id: ID,
    email: 'u@example.com',
    name: 'U',
    role: 'user',
  }
  beforeEach(() => {
    userHasPermission.mockReset()
  })

  it('asks better-auth for the exact permission', async () => {
    userHasPermission.mockResolvedValue({ success: true, error: null } as never)
    expect(await checkPermission(caller, 'documentType', 'create')).toBe(true)
    expect(userHasPermission).toHaveBeenCalledWith({
      body: { userId: ID, permissions: { documentType: ['create'] } },
    })
  })

  it('returns false when better-auth says no', async () => {
    userHasPermission.mockResolvedValue({
      success: false,
      error: null,
    } as never)
    expect(await checkPermission(caller, 'document', 'delete')).toBe(false)
  })

  it('returns false when the check throws', async () => {
    userHasPermission.mockRejectedValue(new Error('db down'))
    expect(await checkPermission(caller, 'document', 'list')).toBe(false)
  })
})
