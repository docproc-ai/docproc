/**
 * One-time browser upload links for MCP clients (see the MCP spec addendum
 * "upload links"). A link is bound to the user who created it, holds one
 * file, expires after 15 minutes and can be claimed once. Only a SHA-256
 * hash of the token is stored.
 */

import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '../db'
import { type McpUploadLinkSelect, mcpUploadLink } from '../db/schema/app'

export type UploadLink = McpUploadLinkSelect
export type UploadLinkStatus = 'pending' | 'completed' | 'expired'

export const UPLOAD_LINK_TTL_MS = 15 * 60_000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Hex SHA-256 of a token: the only form of it that is stored. */
export function hashUploadToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createUploadLink(input: {
  userId: string
  documentTypeId: string
  autoProcess: boolean
}): Promise<{ id: string; token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + UPLOAD_LINK_TTL_MS)
  const [row] = await db
    .insert(mcpUploadLink)
    .values({
      tokenHash: hashUploadToken(token),
      userId: input.userId,
      documentTypeId: input.documentTypeId,
      autoProcess: input.autoProcess,
      expiresAt,
    })
    .returning({ id: mcpUploadLink.id })
  return { id: row.id, token, expiresAt }
}

export async function findUploadLinkByToken(
  token: string,
): Promise<UploadLink | null> {
  const [row] = await db
    .select()
    .from(mcpUploadLink)
    .where(eq(mcpUploadLink.tokenHash, hashUploadToken(token)))
    .limit(1)
  return row ?? null
}

/**
 * Atomically marks an unused, unexpired link as used. Exactly one of any
 * number of concurrent callers gets true.
 */
export async function claimUploadLink(
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await db
    .update(mcpUploadLink)
    .set({ usedAt: now })
    .where(
      and(
        eq(mcpUploadLink.id, id),
        isNull(mcpUploadLink.usedAt),
        gt(mcpUploadLink.expiresAt, now),
      ),
    )
    .returning({ id: mcpUploadLink.id })
  return rows.length > 0
}

/** Undoes a claim after the upload itself failed, so the user can retry. */
export async function releaseUploadLink(id: string): Promise<void> {
  await db
    .update(mcpUploadLink)
    .set({ usedAt: null })
    .where(and(eq(mcpUploadLink.id, id), isNull(mcpUploadLink.documentId)))
}

export async function completeUploadLink(
  id: string,
  result: { documentId: string; jobId?: string },
): Promise<void> {
  await db
    .update(mcpUploadLink)
    .set({ documentId: result.documentId, jobId: result.jobId ?? null })
    .where(eq(mcpUploadLink.id, id))
}

/** The link if it exists and belongs to `userId`; null otherwise. */
export async function getUploadLinkForUser(
  id: string,
  userId: string,
): Promise<UploadLink | null> {
  // id is a uuid column: a non-uuid would make Postgres throw.
  if (!UUID.test(id)) return null
  const [row] = await db
    .select()
    .from(mcpUploadLink)
    .where(and(eq(mcpUploadLink.id, id), eq(mcpUploadLink.userId, userId)))
    .limit(1)
  return row ?? null
}

export function uploadLinkStatus(
  row: Pick<UploadLink, 'documentId' | 'expiresAt'>,
  now: Date = new Date(),
): UploadLinkStatus {
  if (row.documentId) return 'completed'
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired'
  return 'pending'
}
