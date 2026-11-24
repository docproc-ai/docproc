/**
 * Upload-link storage against a real Postgres (single-use claim, expiry,
 * hashing). Opt-in: set TEST_DATABASE_URL to a database with the migrations
 * applied. Rows are created per run and removed afterwards.
 */
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const TEST_DB = process.env.TEST_DATABASE_URL

// The app's db module uses Bun's SQL driver; under vitest (Node) the same
// schema runs on postgres-js instead.
vi.mock('../db', async () => {
  const { drizzle } = await import('drizzle-orm/postgres-js')
  const postgres = (await import('postgres')).default
  const schema = await import('../db/schema')
  const url = process.env.TEST_DATABASE_URL
  const client = postgres(url ?? 'postgres://unused@127.0.0.1:1/x', {
    max: 10,
    onnotice: () => {},
  })
  return { db: drizzle({ client, schema }), schema, client }
})

import * as dbModule from '../db'
import { document, documentType, mcpUploadLink } from '../db/schema/app'
import { user } from '../db/schema/auth'
import {
  claimUploadLink,
  completeUploadLink,
  createUploadLink,
  findUploadLinkByToken,
  getUploadLinkForUser,
  hashUploadToken,
  releaseUploadLink,
  uploadLinkStatus,
} from './upload-links'

const { db } = dbModule
const client = (
  dbModule as unknown as {
    client: {
      end: () => Promise<void>
      unsafe: (q: string, args: unknown[]) => Promise<{ id: string }[]>
    }
  }
).client

describe.skipIf(!TEST_DB)('upload links (Postgres)', () => {
  const suffix = randomUUID().slice(0, 8)
  let userId = ''
  let otherUserId = ''
  let typeId = ''
  let documentId = ''

  beforeAll(async () => {
    const [u1, u2] = await db
      .insert(user)
      .values([
        { name: 'A', email: `ul-a-${suffix}@test.invalid`, role: 'user' },
        { name: 'B', email: `ul-b-${suffix}@test.invalid`, role: 'user' },
      ])
      .returning({ id: user.id })
    userId = u1.id
    otherUserId = u2.id
    // Raw insert: the app's json() column type is tuned for Bun's driver.
    const [t] = await client.unsafe(
      `insert into document_type (name, slug, schema)
       values ($1, $2, '{"type":"object"}'::json) returning id`,
      [`UL ${suffix}`, `ul-${suffix}`],
    )
    typeId = t.id
    const [d] = await db
      .insert(document)
      .values({
        documentTypeId: typeId,
        filename: 'a.pdf',
        storagePath: `test/${suffix}`,
      })
      .returning({ id: document.id })
    documentId = d.id
  })

  afterAll(async () => {
    if (typeId) {
      await db
        .delete(mcpUploadLink)
        .where(eq(mcpUploadLink.documentTypeId, typeId))
      await db.delete(document).where(eq(document.documentTypeId, typeId))
      await db.delete(documentType).where(eq(documentType.id, typeId))
    }
    for (const id of [userId, otherUserId]) {
      if (id) await db.delete(user).where(eq(user.id, id))
    }
    await client.end()
  })

  const newLink = () =>
    createUploadLink({ userId, documentTypeId: typeId, autoProcess: true })

  it('stores the hash, never the token, and finds the row by token', async () => {
    const link = await newLink()
    const [row] = await db
      .select()
      .from(mcpUploadLink)
      .where(eq(mcpUploadLink.id, link.id))
    expect(row.tokenHash).toBe(hashUploadToken(link.token))
    expect(JSON.stringify(row)).not.toContain(link.token)
    expect(row.autoProcess).toBe(true)
    expect(row.expiresAt.getTime()).toBe(link.expiresAt.getTime())

    expect((await findUploadLinkByToken(link.token))?.id).toBe(link.id)
    expect(await findUploadLinkByToken(`${link.token}x`)).toBeNull()
  })

  it('claims once; a second claim is refused', async () => {
    const link = await newLink()
    expect(await claimUploadLink(link.id)).toBe(true)
    expect(await claimUploadLink(link.id)).toBe(false)
  })

  it('refuses a claim at or after expires_at', async () => {
    const link = await newLink()
    expect(await claimUploadLink(link.id, link.expiresAt)).toBe(false)
    expect(
      await claimUploadLink(link.id, new Date(link.expiresAt.getTime() + 1)),
    ).toBe(false)
    expect(
      await claimUploadLink(link.id, new Date(link.expiresAt.getTime() - 1)),
    ).toBe(true)
  })

  it('lets exactly one of many concurrent claims win', async () => {
    const link = await newLink()
    const results = await Promise.all(
      Array.from({ length: 10 }, () => claimUploadLink(link.id)),
    )
    expect(results.filter(Boolean)).toHaveLength(1)
  })

  it('release makes a failed claim claimable again', async () => {
    const link = await newLink()
    expect(await claimUploadLink(link.id)).toBe(true)
    await releaseUploadLink(link.id)
    expect(await claimUploadLink(link.id)).toBe(true)
  })

  it('goes pending -> completed, visible only to its user', async () => {
    const link = await newLink()
    const before = await getUploadLinkForUser(link.id, userId)
    expect(before && uploadLinkStatus(before)).toBe('pending')

    expect(await claimUploadLink(link.id)).toBe(true)
    await completeUploadLink(link.id, { documentId, jobId: 'job-1' })
    // A completed link stays used even if release is called.
    await releaseUploadLink(link.id)
    expect(await claimUploadLink(link.id)).toBe(false)

    const after = await getUploadLinkForUser(link.id, userId)
    expect(after && uploadLinkStatus(after)).toBe('completed')
    expect(after?.documentId).toBe(documentId)
    expect(after?.jobId).toBe('job-1')
    expect(await getUploadLinkForUser(link.id, otherUserId)).toBeNull()
  })

  it('stays completed after the uploaded document is deleted', async () => {
    const [doc] = await db
      .insert(document)
      .values({
        documentTypeId: typeId,
        filename: 'gone.pdf',
        storagePath: `test/${suffix}-gone`,
      })
      .returning({ id: document.id })
    const link = await newLink()
    expect(await claimUploadLink(link.id)).toBe(true)
    await completeUploadLink(link.id, { documentId: doc.id })
    await db.delete(document).where(eq(document.id, doc.id))

    const row = await getUploadLinkForUser(link.id, userId)
    expect(row?.documentId).toBe(doc.id)
    expect(row && uploadLinkStatus(row)).toBe('completed')
    expect(
      row && uploadLinkStatus(row, new Date(link.expiresAt.getTime() + 1)),
    ).toBe('completed')
  })

  it('goes pending -> expired at expires_at', async () => {
    const link = await newLink()
    const row = await getUploadLinkForUser(link.id, userId)
    if (!row) throw new Error('missing row')
    expect(uploadLinkStatus(row, new Date(link.expiresAt.getTime() - 1))).toBe(
      'pending',
    )
    expect(uploadLinkStatus(row, link.expiresAt)).toBe('expired')
  })
})
