import { beforeEach, describe, expect, it, vi } from 'vitest'

// Session auth stand-in: the signed-in user id comes from a test header.
vi.mock('../middleware/auth', async () => {
  const { createMiddleware } = await import('hono/factory')
  return {
    requireAuth: createMiddleware(async (c, next) => {
      const id = c.req.header('x-test-user')
      if (!id) return c.json({ error: 'Unauthorized' }, 401)
      c.set('user', { id } as never)
      await next()
    }),
  }
})
vi.mock('../services/upload-links', async (importActual) => ({
  ...(await importActual<typeof import('../services/upload-links')>()),
  findUploadLinkByToken: vi.fn(),
  claimUploadLink: vi.fn(),
  releaseUploadLink: vi.fn(),
  completeUploadLink: vi.fn(),
}))
vi.mock('../db', () => ({ db: {} }))
// Real loadActiveUser (banned / role checks) over a mocked user row.
vi.mock('./caller', async (importActual) => ({
  ...(await importActual<typeof import('./caller')>()),
  checkPermission: vi.fn(),
}))
vi.mock('../lib/db/user-operations', () => ({ getUserAccessRow: vi.fn() }))
vi.mock('../services/documents', () => ({ uploadDocuments: vi.fn() }))
vi.mock('../lib/db/document-type-operations', () => ({
  getDocumentTypeBySlugOrId: vi.fn(),
}))
// For mounting through createMcpRoutes (discovery + endpoint come along).
vi.mock('../lib/auth', () => ({
  auth: {
    options: { plugins: [] },
    $context: Promise.resolve({ baseURL: 'https://d.example/api/auth' }),
    api: {},
  },
}))
vi.mock('./endpoint', () => ({ handleMcp: vi.fn() }))

import { getDocumentTypeBySlugOrId } from '../lib/db/document-type-operations'
import { getUserAccessRow } from '../lib/db/user-operations'
import { uploadDocuments } from '../services/documents'
import {
  claimUploadLink,
  completeUploadLink,
  findUploadLinkByToken,
  releaseUploadLink,
  type UploadLink,
} from '../services/upload-links'
import { checkPermission } from './caller'
import { createMcpRoutes } from './index'
import { createUploadRoutes, UPLOAD_ERRORS } from './upload-routes'

const find = vi.mocked(findUploadLinkByToken)
const claim = vi.mocked(claimUploadLink)
const release = vi.mocked(releaseUploadLink)
const complete = vi.mocked(completeUploadLink)
const check = vi.mocked(checkPermission)
const upload = vi.mocked(uploadDocuments)
const getType = vi.mocked(getDocumentTypeBySlugOrId)
const getUserRow = vi.mocked(getUserAccessRow)

const OWNER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const TOKEN = 'tok_abc-123'
const TYPE = { id: 't1', name: 'Invoices', slug: 'invoices' }

let link: UploadLink

function freshLink(over: Partial<UploadLink> = {}): UploadLink {
  return {
    id: 'link-1',
    tokenHash: 'h',
    userId: OWNER,
    documentTypeId: 't1',
    autoProcess: true,
    expiresAt: new Date(Date.now() + 10 * 60_000),
    usedAt: null,
    documentId: null,
    jobId: null,
    createdAt: new Date(),
    ...over,
  }
}

const app = createUploadRoutes()

function get(user: string | null = OWNER, token = TOKEN) {
  return app.request(`/${token}`, {
    headers: user ? { 'x-test-user': user } : {},
  })
}

function post(
  user: string | null = OWNER,
  files: File[] = [
    new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' }),
  ],
) {
  const body = new FormData()
  for (const f of files) body.append('file', f)
  return app.request(`/${TOKEN}`, {
    method: 'POST',
    body,
    headers: user ? { 'x-test-user': user } : {},
  })
}

const ok = (documentId = 'd1') => ({
  documentTypeId: 't1',
  documentTypeSlug: 'invoices',
  results: [{ filename: 'a.pdf', success: true, documentId }],
  jobIds: ['j1'],
  batchId: 'b1',
  summary: { total: 1, uploaded: 1, failed: 0 },
})

beforeEach(() => {
  vi.clearAllMocks()
  link = freshLink()
  find.mockImplementation(async (t) => (t === TOKEN ? link : null))
  // Same contract as the SQL claim: first caller on an unused, unexpired link.
  claim.mockImplementation(async () => {
    if (link.usedAt || link.expiresAt.getTime() <= Date.now()) return false
    link.usedAt = new Date()
    return true
  })
  release.mockImplementation(async () => {
    if (!link.documentId) link.usedAt = null
  })
  complete.mockImplementation(async (_id, r) => {
    link.documentId = r.documentId
    link.jobId = r.jobId ?? null
  })
  check.mockResolvedValue(true)
  getType.mockResolvedValue(TYPE as never)
  getUserRow.mockImplementation(async (id) => ({
    id,
    email: 'u@example.com',
    name: 'U',
    role: 'user',
    banned: false,
    banExpires: null,
  }))
})

const INACTIVE = [
  ['banned', { banned: true, banExpires: null }],
  ['role none', { role: 'none' }],
] as const

function makeInactive(over: (typeof INACTIVE)[number][1]) {
  getUserRow.mockImplementation(async (id) => ({
    id,
    email: 'u@example.com',
    name: 'U',
    role: 'user',
    banned: false,
    banExpires: null,
    ...over,
  }))
}

describe('GET /api/mcp/uploads/:token', () => {
  it('needs a session', async () => {
    const res = await get(null)
    expect(res.status).toBe(401)
    expect(find).not.toHaveBeenCalled()
  })

  it('describes a pending link to its owner', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      documentType: { name: 'Invoices', slug: 'invoices' },
      expiresAt: link.expiresAt.toISOString(),
      status: 'pending',
    })
  })

  it('404s an unknown token', async () => {
    const res = await get(OWNER, 'nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({
      error: 'This upload link is not valid.',
    })
  })

  it('403s another user, before revealing expiry or use', async () => {
    link = freshLink({ usedAt: new Date(), expiresAt: new Date(0) })
    const res = await get(OTHER)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: 'This upload link was created for a different DocProc account.',
    })
  })

  it('410s an expired link', async () => {
    link = freshLink({ expiresAt: new Date(Date.now() - 1) })
    const res = await get()
    expect(res.status).toBe(410)
    expect(await res.json()).toEqual({
      error: 'This upload link has expired. Ask Claude for a new one.',
    })
  })

  it.each(INACTIVE)('403s a %s owner', async (_label, over) => {
    makeInactive(over)
    const res = await get()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: "Your DocProc account can't upload documents.",
    })
  })

  it('409s a link that was used and has since expired', async () => {
    link = freshLink({ usedAt: new Date(), expiresAt: new Date(0) })
    const res = await get()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(UPLOAD_ERRORS.used)
  })

  it('409s a used link', async () => {
    link = freshLink({ usedAt: new Date() })
    const res = await get()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'This upload link has already been used.',
    })
  })
})

describe('POST /api/mcp/uploads/:token', () => {
  it('uploads with the link user and autoProcess, and records the result', async () => {
    upload.mockResolvedValue(ok('d9'))
    const res = await post()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ documentId: 'd9', filename: 'a.pdf' })
    expect(check).toHaveBeenCalledWith({ id: OWNER }, 'document', 'create')
    const [type, files, opts] = upload.mock.calls[0]
    expect(type).toBe(TYPE)
    expect(files).toHaveLength(1)
    expect(files[0].name).toBe('a.pdf')
    expect(files[0].type).toBe('application/pdf')
    expect(files[0].buffer.toString()).toBe('%PDF-1.4')
    expect(opts).toEqual({ userId: OWNER, autoProcess: true })
    expect(complete).toHaveBeenCalledWith('link-1', {
      documentId: 'd9',
      jobId: 'j1',
    })
  })

  it('passes autoProcess false from the link', async () => {
    link = freshLink({ autoProcess: false })
    upload.mockResolvedValue({ ...ok(), jobIds: undefined, batchId: undefined })
    const res = await post()
    expect(res.status).toBe(200)
    expect(upload.mock.calls[0][2]).toEqual({
      userId: OWNER,
      autoProcess: false,
    })
    expect(complete).toHaveBeenCalledWith('link-1', {
      documentId: 'd1',
      jobId: undefined,
    })
  })

  it('refuses another user with the 403 text and uploads nothing', async () => {
    const res = await post(OTHER)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe(UPLOAD_ERRORS.otherUser)
    expect(upload).not.toHaveBeenCalled()
    expect(claim).not.toHaveBeenCalled()
  })

  it('410s an expired link', async () => {
    link = freshLink({ expiresAt: new Date(Date.now() - 1) })
    const res = await post()
    expect(res.status).toBe(410)
    expect((await res.json()).error).toBe(UPLOAD_ERRORS.expired)
    expect(upload).not.toHaveBeenCalled()
  })

  it('409s a reused link', async () => {
    upload.mockResolvedValue(ok())
    expect((await post()).status).toBe(200)
    const res = await post()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(UPLOAD_ERRORS.used)
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('404s an unknown token', async () => {
    find.mockResolvedValue(null)
    const res = await post()
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe(UPLOAD_ERRORS.notFound)
  })

  it.each(
    INACTIVE,
  )('403s a %s owner and uploads nothing', async (_label, over) => {
    makeInactive(over)
    const res = await post()
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe(UPLOAD_ERRORS.forbidden)
    expect(claim).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('409s a used-then-expired link', async () => {
    link = freshLink({ usedAt: new Date(), expiresAt: new Date(0) })
    const res = await post()
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(UPLOAD_ERRORS.used)
  })

  it('403s when document:create was revoked after the link was made', async () => {
    check.mockResolvedValue(false)
    const res = await post()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: "Your DocProc account can't upload documents.",
    })
    expect(claim).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
    expect(link.usedAt).toBeNull()
  })

  it('releases the link when the upload fails, so a retry works', async () => {
    upload.mockResolvedValueOnce({
      documentTypeId: 't1',
      documentTypeSlug: 'invoices',
      results: [
        {
          filename: 'a.txt',
          success: false,
          error: 'Unsupported file type: text/plain',
        },
      ],
      summary: { total: 1, uploaded: 0, failed: 1 },
    })
    const bad = await post()
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({
      error: 'Unsupported file type: text/plain',
    })
    expect(release).toHaveBeenCalledWith('link-1')
    expect(complete).not.toHaveBeenCalled()

    upload.mockResolvedValueOnce(ok('d2'))
    const good = await post()
    expect(good.status).toBe(200)
    expect(link.documentId).toBe('d2')
  })

  it('releases the link when the upload throws', async () => {
    upload.mockRejectedValueOnce(new Error('disk full'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post()
    errSpy.mockRestore()
    expect(res.status).toBe(500)
    expect(release).toHaveBeenCalledWith('link-1')
    expect(link.usedAt).toBeNull()
  })

  it('lets exactly one of two concurrent uploads succeed', async () => {
    upload.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10))
      return ok()
    })
    const statuses = (await Promise.all([post(), post()])).map((r) => r.status)
    expect(statuses.sort()).toEqual([200, 409])
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['no file', []],
    ['two files', [new File(['a'], 'a.pdf'), new File(['b'], 'b.pdf')]],
  ])('400s %s without using the link', async (_label, files) => {
    const res = await post(OWNER, files as File[])
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe(UPLOAD_ERRORS.oneFile)
    expect(claim).not.toHaveBeenCalled()
  })
})

describe('mounting', () => {
  const enabled = {
    enabled: true as const,
    baseUrl: 'https://d.example',
    path: '/mcp',
    resource: 'https://d.example/mcp',
  }

  it('serves /api/mcp/uploads/* when MCP is enabled', async () => {
    const routes = createMcpRoutes(enabled)
    const res = await routes?.request(`/api/mcp/uploads/${TOKEN}`, {
      headers: { 'x-test-user': OWNER },
    })
    expect(res?.status).toBe(200)
    const anon = await routes?.request(`/api/mcp/uploads/${TOKEN}`)
    expect(anon?.status).toBe(401)
  })

  it('mounts nothing when MCP is disabled', () => {
    expect(createMcpRoutes({ enabled: false })).toBeNull()
  })
})
