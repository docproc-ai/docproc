import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/db/document-operations', () => ({
  createDocument: vi.fn(),
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
}))
vi.mock('../lib/db/job-operations', () => ({
  createBatch: vi.fn(),
  createJob: vi.fn(),
  updateJobStatus: vi.fn(),
}))
vi.mock('../storage', () => ({
  storage: { upload: vi.fn() },
}))
vi.mock('../lib/webhooks', () => ({ triggerWebhookAsync: vi.fn() }))
vi.mock('../lib/websocket', () => ({
  emitJobStarted: vi.fn(),
  emitJobCompleted: vi.fn(),
  emitJobFailed: vi.fn(),
}))
vi.mock('../lib/processing', () => ({ processAndSaveDocument: vi.fn() }))
vi.mock('./batch', () => ({ processBatchInBackground: vi.fn() }))

import {
  createDocument,
  getDocument,
  updateDocument,
} from '../lib/db/document-operations'
import { createJob, updateJobStatus } from '../lib/db/job-operations'
import { processAndSaveDocument } from '../lib/processing'
import { triggerWebhookAsync } from '../lib/webhooks'
import { emitJobFailed } from '../lib/websocket'
import { storage } from '../storage'
import {
  startSingleDocumentProcessing,
  updateDocumentWithWebhooks,
  uploadDocuments,
} from './documents'
import { ServiceError } from './errors'

// biome-ignore lint/suspicious/noExplicitAny: test fixtures
const asAny = (v: unknown) => v as any

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateDocumentWithWebhooks', () => {
  const base = { id: 'd1', documentTypeId: 't1' }

  it('approving fires document.approved', async () => {
    const doc = asAny({ ...base, status: 'processed' })
    const updated = asAny({ ...base, status: 'approved' })
    vi.mocked(updateDocument).mockResolvedValue(updated)
    const res = await updateDocumentWithWebhooks(doc, { status: 'approved' })
    expect(res).toBe(updated)
    expect(triggerWebhookAsync).toHaveBeenCalledTimes(1)
    expect(triggerWebhookAsync).toHaveBeenCalledWith(
      't1',
      updated,
      'document.approved',
    )
  })

  it('unapproving fires document.unapproved', async () => {
    const doc = asAny({ ...base, status: 'approved' })
    const updated = asAny({ ...base, status: 'processed' })
    vi.mocked(updateDocument).mockResolvedValue(updated)
    await updateDocumentWithWebhooks(doc, { status: 'processed' })
    expect(triggerWebhookAsync).toHaveBeenCalledTimes(1)
    expect(triggerWebhookAsync).toHaveBeenCalledWith(
      't1',
      updated,
      'document.unapproved',
    )
  })

  it('same status fires nothing', async () => {
    const doc = asAny({ ...base, status: 'approved' })
    vi.mocked(updateDocument).mockResolvedValue(doc)
    await updateDocumentWithWebhooks(doc, { status: 'approved' })
    expect(triggerWebhookAsync).not.toHaveBeenCalled()
  })

  it('returns null when update finds nothing', async () => {
    vi.mocked(updateDocument).mockResolvedValue(null)
    const res = await updateDocumentWithWebhooks(
      asAny({ ...base, status: 'pending' }),
      { status: 'approved' },
    )
    expect(res).toBeNull()
    expect(triggerWebhookAsync).not.toHaveBeenCalled()
  })
})

describe('uploadDocuments', () => {
  const docType = asAny({ id: 't1', slug: 'invoices' })

  it('upload rejects unsupported type', async () => {
    const res = await uploadDocuments(
      docType,
      [{ name: 'a.txt', type: 'text/plain', buffer: Buffer.from('x') }],
      {},
    )
    expect(res.results[0]).toEqual({
      filename: 'a.txt',
      success: false,
      error: 'Unsupported file type: text/plain',
    })
    expect(storage.upload).not.toHaveBeenCalled()
    expect(res.summary).toEqual({ total: 1, uploaded: 0, failed: 1 })
  })

  it('upload fires document.uploaded once per stored file', async () => {
    vi.mocked(storage.upload).mockResolvedValue('key')
    vi.mocked(createDocument).mockImplementation(async () =>
      asAny({ id: 'doc-1', documentTypeId: 't1' }),
    )
    const res = await uploadDocuments(
      docType,
      [
        { name: 'a.png', type: 'image/png', buffer: Buffer.from('x') },
        { name: 'b.pdf', type: '', buffer: Buffer.from('y') },
        { name: 'c.txt', type: 'text/plain', buffer: Buffer.from('z') },
      ],
      { userId: 'u1' },
    )
    expect(triggerWebhookAsync).toHaveBeenCalledTimes(2)
    expect(triggerWebhookAsync).toHaveBeenCalledWith(
      't1',
      expect.anything(),
      'document.uploaded',
    )
    expect(res.summary).toEqual({ total: 3, uploaded: 2, failed: 1 })
    expect(res.jobIds).toBeUndefined()
  })
})

describe('startSingleDocumentProcessing', () => {
  it('throws not_found for missing doc', async () => {
    vi.mocked(getDocument).mockResolvedValue(undefined as never)
    await expect(startSingleDocumentProcessing('x', {})).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  it('processing refuses processed documents', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      asAny({ id: 'd1', documentTypeId: 't1', status: 'processed' }),
    )
    const p = startSingleDocumentProcessing('d1', {})
    await expect(p).rejects.toBeInstanceOf(ServiceError)
    await expect(p).rejects.toMatchObject({ code: 'conflict' })
    expect(createJob).not.toHaveBeenCalled()
  })

  it('processing failure marks job failed', async () => {
    vi.mocked(getDocument).mockResolvedValue(
      asAny({ id: 'd1', documentTypeId: 't1', status: 'pending' }),
    )
    vi.mocked(createJob).mockResolvedValue(asAny({ id: 'j1' }))
    vi.mocked(processAndSaveDocument).mockRejectedValue(new Error('boom'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { jobId, done } = await startSingleDocumentProcessing('d1', {})
    expect(jobId).toBe('j1')
    await expect(done).rejects.toThrow('boom')
    expect(updateJobStatus).toHaveBeenCalledWith(
      'j1',
      'failed',
      expect.objectContaining({ error: 'boom' }),
    )
    expect(emitJobFailed).toHaveBeenCalledWith('j1', 'd1', 't1', 'boom')
    errSpy.mockRestore()
  })
})
