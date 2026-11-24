import type { Context } from 'hono'
import { Hono } from 'hono'
import { getDocumentTypeBySlugOrId } from '../lib/db/document-type-operations'
import { requireAuth } from '../middleware/auth'
import { uploadDocuments } from '../services/documents'
import {
  claimUploadLink,
  completeUploadLink,
  findUploadLinkByToken,
  releaseUploadLink,
  type UploadLink,
  uploadLinkStatus,
} from '../services/upload-links'
import { checkPermission, loadActiveUser } from './caller'

export const UPLOAD_ERRORS = {
  notFound: 'This upload link is not valid.',
  otherUser: 'This upload link was created for a different DocProc account.',
  expired: 'This upload link has expired. Ask Claude for a new one.',
  used: 'This upload link has already been used.',
  forbidden: "Your DocProc account can't upload documents.",
  oneFile: 'Choose exactly one file to upload.',
} as const

/** A base64url token is 43 characters; anything far longer is not one. */
const MAX_TOKEN_LENGTH = 128

type Checked =
  | { ok: true; link: UploadLink }
  | { ok: false; status: 403 | 404 | 409 | 410; error: string }

/**
 * Looks the link up and checks it in a fixed order: exists, belongs to the
 * signed-in user, user still active (same live check as the MCP endpoint),
 * not used, not expired. Ownership comes first so another account learns only
 * that the token exists (the token is the secret); "used" comes before
 * "expired" so a completed link keeps saying so after it expires.
 */
async function checkLink(
  token: string,
  userId: string,
  now: Date,
): Promise<Checked> {
  const link =
    token.length <= MAX_TOKEN_LENGTH ? await findUploadLinkByToken(token) : null
  if (!link) return { ok: false, status: 404, error: UPLOAD_ERRORS.notFound }
  if (link.userId !== userId) {
    return { ok: false, status: 403, error: UPLOAD_ERRORS.otherUser }
  }
  // Banned or role `none` (e.g. demoted since the link was made).
  if (!(await loadActiveUser(userId))) {
    return { ok: false, status: 403, error: UPLOAD_ERRORS.forbidden }
  }
  if (link.usedAt) return { ok: false, status: 409, error: UPLOAD_ERRORS.used }
  if (link.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, status: 410, error: UPLOAD_ERRORS.expired }
  }
  return { ok: true, link }
}

function signedInUserId(c: Context): string {
  const user = c.get('user')
  if (!user) throw new Error('requireAuth did not set a user')
  return user.id
}

/**
 * `/api/mcp/uploads/:token`: the browser side of `create_upload_link`.
 * Session auth (the web app's cookie); mounted only when MCP is enabled.
 */
export function createUploadRoutes(): Hono {
  const app = new Hono()
  app.use('*', requireAuth)

  app.get('/:token', async (c) => {
    const now = new Date()
    const checked = await checkLink(
      c.req.param('token'),
      signedInUserId(c),
      now,
    )
    if (!checked.ok) return c.json({ error: checked.error }, checked.status)
    const { link } = checked
    const docType = await getDocumentTypeBySlugOrId(link.documentTypeId)
    if (!docType) return c.json({ error: UPLOAD_ERRORS.notFound }, 404)
    return c.json(
      {
        documentType: { name: docType.name, slug: docType.slug },
        expiresAt: link.expiresAt.toISOString(),
        status: uploadLinkStatus(link, now),
      },
      200,
    )
  })

  app.post('/:token', async (c) => {
    const userId = signedInUserId(c)
    const checked = await checkLink(c.req.param('token'), userId, new Date())
    if (!checked.ok) return c.json({ error: checked.error }, checked.status)
    const { link } = checked

    if (!(await checkPermission({ id: userId }, 'document', 'create'))) {
      return c.json({ error: UPLOAD_ERRORS.forbidden }, 403)
    }
    const docType = await getDocumentTypeBySlugOrId(link.documentTypeId)
    if (!docType) return c.json({ error: UPLOAD_ERRORS.notFound }, 404)

    // Validate the body before claiming, so a bad request doesn't burn the link.
    let file: File | null = null
    try {
      const entries = (await c.req.formData()).getAll('file')
      if (entries.length === 1 && entries[0] instanceof File) file = entries[0]
    } catch {
      // Not multipart: same answer as a missing file.
    }
    if (!file) return c.json({ error: UPLOAD_ERRORS.oneFile }, 400)

    // Atomic single use: of concurrent requests exactly one gets past here.
    if (!(await claimUploadLink(link.id))) {
      const again = await checkLink(c.req.param('token'), userId, new Date())
      return again.ok
        ? c.json({ error: UPLOAD_ERRORS.used }, 409)
        : c.json({ error: again.error }, again.status)
    }

    let documentId: string | undefined
    try {
      const result = await uploadDocuments(
        docType,
        [
          {
            name: file.name,
            type: file.type,
            buffer: Buffer.from(await file.arrayBuffer()),
          },
        ],
        { userId, autoProcess: link.autoProcess },
      )
      const first = result.results[0]
      documentId = first?.success ? first.documentId : undefined
      if (!first || !documentId) {
        await releaseUploadLink(link.id)
        return c.json({ error: first?.error ?? 'Upload failed' }, 400)
      }
      await completeUploadLink(link.id, {
        documentId,
        jobId: result.jobIds?.[0],
      })
      return c.json({ documentId, filename: first.filename }, 200)
    } catch (error) {
      console.error('[mcp] upload link upload failed:', error)
      // Release only if no document exists yet; otherwise a retry duplicates it.
      if (!documentId) await releaseUploadLink(link.id).catch(() => {})
      return c.json({ error: 'Upload failed' }, 500)
    }
  })

  return app
}
