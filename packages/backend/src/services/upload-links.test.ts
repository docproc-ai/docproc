import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Captures what would be written; the claim/expiry semantics against a real
// Postgres are covered by upload-links.db.test.ts.
const inserted: Record<string, unknown>[] = []
vi.mock('../db', () => ({
  db: {
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        inserted.push(v)
        return { returning: async () => [{ id: 'link-1' }] }
      },
    }),
    select: vi.fn(),
  },
}))

import { db } from '../db'
import {
  createUploadLink,
  getUploadLinkForUser,
  hashUploadToken,
  UPLOAD_LINK_TTL_MS,
  uploadLinkStatus,
} from './upload-links'

beforeEach(() => {
  inserted.length = 0
})

describe('createUploadLink', () => {
  it('stores only the SHA-256 hash of a 32-byte base64url token', async () => {
    const before = Date.now()
    const link = await createUploadLink({
      userId: 'u1',
      documentTypeId: 't1',
      autoProcess: true,
    })
    expect(link.id).toBe('link-1')
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(Buffer.from(link.token, 'base64url')).toHaveLength(32)

    expect(inserted).toHaveLength(1)
    const row = inserted[0]
    expect(row.tokenHash).toBe(
      createHash('sha256').update(link.token).digest('hex'),
    )
    expect(JSON.stringify(row)).not.toContain(link.token)
    expect(row).toMatchObject({
      userId: 'u1',
      documentTypeId: 't1',
      autoProcess: true,
    })

    const ttl = link.expiresAt.getTime() - before
    expect(ttl).toBeGreaterThanOrEqual(UPLOAD_LINK_TTL_MS)
    expect(ttl).toBeLessThan(UPLOAD_LINK_TTL_MS + 5_000)
    expect(UPLOAD_LINK_TTL_MS).toBe(15 * 60_000)
  })

  it('makes a different token every time', async () => {
    const a = await createUploadLink({
      userId: 'u1',
      documentTypeId: 't1',
      autoProcess: false,
    })
    const b = await createUploadLink({
      userId: 'u1',
      documentTypeId: 't1',
      autoProcess: false,
    })
    expect(a.token).not.toBe(b.token)
  })
})

describe('hashUploadToken', () => {
  it('is hex sha256', () => {
    expect(hashUploadToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('uploadLinkStatus', () => {
  const expiresAt = new Date('2026-11-24T12:15:00Z')

  it('is pending before expires_at', () => {
    expect(
      uploadLinkStatus(
        { documentId: null, expiresAt },
        new Date('2026-11-24T12:14:59Z'),
      ),
    ).toBe('pending')
  })

  it('is expired at expires_at', () => {
    expect(uploadLinkStatus({ documentId: null, expiresAt }, expiresAt)).toBe(
      'expired',
    )
  })

  it('is completed once a document is recorded, even after expiry', () => {
    expect(
      uploadLinkStatus(
        { documentId: 'd1', expiresAt },
        new Date('2026-11-24T13:00:00Z'),
      ),
    ).toBe('completed')
  })
})

describe('getUploadLinkForUser', () => {
  it('returns null for a non-uuid id without querying', async () => {
    expect(await getUploadLinkForUser('nope', 'u1')).toBeNull()
    expect(vi.mocked(db.select)).not.toHaveBeenCalled()
  })
})
