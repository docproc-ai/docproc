import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../caller', () => ({ checkPermission: vi.fn() }))
vi.mock('../../services/documents', () => ({
  uploadDocuments: vi.fn(),
  updateDocumentWithWebhooks: vi.fn(),
  startSingleDocumentProcessing: vi.fn(),
}))
vi.mock('../../lib/db/document-operations', () => ({
  getDocumentBySlugOrId: vi.fn(),
  getDocuments: vi.fn(),
}))
vi.mock('../../lib/db/document-type-operations', () => ({
  getDocumentTypeBySlugOrId: vi.fn(),
  getDocumentTypes: vi.fn(),
  createDocumentType: vi.fn(),
  updateDocumentType: vi.fn(),
}))
vi.mock('../../lib/db/job-operations', () => ({
  getJob: vi.fn(),
  getBatchWithJobs: vi.fn(),
}))
vi.mock('../../storage', () => ({ storage: { download: vi.fn() } }))

import { getDocumentBySlugOrId } from '../../lib/db/document-operations'
import {
  createDocumentType,
  getDocumentTypeBySlugOrId,
  updateDocumentType,
} from '../../lib/db/document-type-operations'
import {
  startSingleDocumentProcessing,
  updateDocumentWithWebhooks,
  uploadDocuments,
} from '../../services/documents'
import { ServiceError } from '../../services/errors'
import { checkPermission, type McpCaller } from '../caller'
import { createMcpServer } from '../server'

const check = vi.mocked(checkPermission)
const upload = vi.mocked(uploadDocuments)
const update = vi.mocked(updateDocumentWithWebhooks)
const startProc = vi.mocked(startSingleDocumentProcessing)
const getDoc = vi.mocked(getDocumentBySlugOrId)
const getType = vi.mocked(getDocumentTypeBySlugOrId)
const createType = vi.mocked(createDocumentType)
const updateType = vi.mocked(updateDocumentType)

const USER: McpCaller = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'u@example.com',
  name: 'U',
  role: 'user',
}

async function connect(caller: McpCaller = USER) {
  const server = createMcpServer(caller)
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: 'test', version: '1' })
  await client.connect(clientT)
  return {
    client,
    close: async () => {
      await client.close()
      await server.close()
    },
  }
}

const text = (res: unknown) =>
  ((res as { content: { text: string }[] }).content[0] as { text: string }).text

const TYPE = {
  id: 't1',
  slug: 'invoices',
  name: 'Invoices',
  schema: { type: 'object' },
  slugPattern: null,
  modelName: null,
  validationInstructions: null,
  webhookConfig: { url: 'https://secret' },
}
const DOC = {
  id: 'd1',
  slug: 'doc-1',
  status: 'pending',
  documentTypeId: 't1',
  schemaSnapshot: {
    type: 'object',
    properties: { total: { type: 'number' } },
  },
}

describe('write tools', () => {
  let h: Awaited<ReturnType<typeof connect>>
  beforeEach(async () => {
    for (const m of [
      check,
      upload,
      update,
      startProc,
      getDoc,
      getType,
      createType,
      updateType,
    ]) {
      m.mockReset()
    }
    check.mockResolvedValue(true)
    getType.mockResolvedValue(TYPE as never)
    getDoc.mockResolvedValue(DOC as never)
    h = await connect()
  })
  afterEach(async () => {
    vi.useRealTimers()
    await h.close()
  })

  const call = (name: string, args: Record<string, unknown>) =>
    h.client.callTool({ name, arguments: args })

  it('registers the six tools with openWorldHint false', async () => {
    const { tools } = await h.client.listTools()
    const names = [
      'upload_document',
      'process_document',
      'update_document_data',
      'set_document_status',
      'create_document_type',
      'update_document_type',
    ]
    for (const n of names) {
      const t = tools.find((x) => x.name === n)
      expect(t, n).toBeDefined()
      expect(t?.annotations?.openWorldHint).toBe(false)
      expect(t?.annotations?.readOnlyHint).toBe(false)
    }
  })

  describe('upload_document', () => {
    const args = {
      documentType: 'invoices',
      filename: 'a.png',
      contentBase64: 'aGVsbG8=',
    }

    it('rejects invalid base64 without calling the service', async () => {
      const res = await call('upload_document', {
        ...args,
        contentBase64: '%%%',
      })
      expect(res.isError).toBe(true)
      expect(text(res)).toBe('contentBase64 is not valid base64.')
      expect(upload).not.toHaveBeenCalled()
    })

    it('rejects files over 5 MB decoded', async () => {
      const big = Buffer.alloc(6 * 1024 * 1024).toString('base64')
      const res = await call('upload_document', { ...args, contentBase64: big })
      expect(res.isError).toBe(true)
      expect(text(res)).toBe(
        'File is larger than 5 MB; upload it in DocProc instead.',
      )
      expect(upload).not.toHaveBeenCalled()
    })

    it('returns a failed service result as an error', async () => {
      upload.mockResolvedValue({
        documentTypeId: 't1',
        documentTypeSlug: 'invoices',
        results: [
          {
            filename: 'a.png',
            success: false,
            error: 'Unsupported file type: text/plain',
          },
        ],
        summary: { total: 1, uploaded: 0, failed: 1 },
      })
      const res = await call('upload_document', args)
      expect(res.isError).toBe(true)
      expect(text(res)).toContain('Unsupported file type: text/plain')
    })

    it('uploads and passes buffer, type, user and autoProcess', async () => {
      upload.mockResolvedValue({
        documentTypeId: 't1',
        documentTypeSlug: 'invoices',
        results: [{ filename: 'a.png', success: true, documentId: 'd9' }],
        jobIds: ['j1'],
        batchId: 'b1',
        summary: { total: 1, uploaded: 1, failed: 0 },
      })
      const res = await call('upload_document', {
        ...args,
        mimeType: 'image/png',
        process: true,
      })
      expect(res.isError).toBeFalsy()
      expect(check).toHaveBeenCalledWith(USER, 'document', 'create')
      const [t, files, opts] = upload.mock.calls[0]
      expect(t).toBe(TYPE)
      expect(files[0].name).toBe('a.png')
      expect(files[0].type).toBe('image/png')
      expect(files[0].buffer.toString()).toBe('hello')
      expect(opts).toEqual({ userId: USER.id, autoProcess: true })
      expect(text(res)).toContain('d9')
      expect(text(res)).toContain('b1')
    })

    it('says document type not found for an unknown type', async () => {
      getType.mockResolvedValue(null)
      const res = await call('upload_document', args)
      expect(res.isError).toBe(true)
      expect(text(res)).toBe('Document type not found')
    })
  })

  describe('process_document', () => {
    it('returns extracted data when done wins', async () => {
      startProc.mockResolvedValue({
        jobId: 'j1',
        done: Promise.resolve({
          extractedData: { total: 5 },
          status: 'processed',
        }),
      })
      const res = await call('process_document', {
        document: 'doc-1',
        model: 'm/x',
      })
      expect(startProc).toHaveBeenCalledWith('d1', {
        userId: USER.id,
        model: 'm/x',
      })
      expect(JSON.parse(text(res))).toEqual({
        status: 'processed',
        extractedData: { total: 5 },
      })
    })

    it('returns processing + jobId after 45 s', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      startProc.mockResolvedValue({
        jobId: 'j1',
        done: new Promise(() => {}),
      })
      const p = call('process_document', { document: 'doc-1' })
      await vi.advanceTimersByTimeAsync(45_000)
      const res = await p
      expect(JSON.parse(text(res))).toEqual({
        status: 'processing',
        jobId: 'j1',
        message: 'Still running; check with get_job.',
      })
    })

    it('does not leave the timer running when done wins', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      startProc.mockResolvedValue({
        jobId: 'j1',
        done: Promise.resolve({ extractedData: {} }),
      })
      await call('process_document', { document: 'doc-1' })
      expect(vi.getTimerCount()).toBe(0)
    })

    it('reports a conflict as Document already processed', async () => {
      startProc.mockRejectedValue(
        new ServiceError('conflict', 'Document already processed'),
      )
      const res = await call('process_document', { document: 'doc-1' })
      expect(res.isError).toBe(true)
      expect(text(res)).toBe('Document already processed')
    })

    it('surfaces a processing failure as an error', async () => {
      startProc.mockResolvedValue({
        jobId: 'j1',
        done: Promise.reject(new Error('model exploded')),
      })
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const res = await call('process_document', { document: 'doc-1' })
      errSpy.mockRestore()
      expect(res.isError).toBe(true)
      expect(text(res)).toBe('Extraction failed: model exploded (job j1).')
    })

    it('passes through the status the document ended in', async () => {
      startProc.mockResolvedValue({
        jobId: 'j1',
        done: Promise.resolve({ extractedData: { a: 1 }, status: 'approved' }),
      })
      const res = await call('process_document', { document: 'doc-1' })
      expect(JSON.parse(text(res))).toEqual({
        status: 'approved',
        extractedData: { a: 1 },
      })
    })
  })

  describe('update_document_data', () => {
    it('refuses invalid data and saves nothing', async () => {
      const res = await call('update_document_data', {
        document: 'doc-1',
        extractedData: { total: 'x' },
      })
      expect(res.isError).toBe(true)
      expect(text(res)).toContain('/total')
      expect(update).not.toHaveBeenCalled()
    })

    it('saves valid data with updatedBy', async () => {
      update.mockResolvedValue({ ...DOC, extractedData: { total: 3 } } as never)
      const res = await call('update_document_data', {
        document: 'doc-1',
        extractedData: { total: 3 },
      })
      expect(res.isError).toBeFalsy()
      expect(update).toHaveBeenCalledWith(DOC, {
        extractedData: { total: 3 },
        updatedBy: USER.id,
      })
    })

    for (const [label, uri] of [
      ['2020-12', 'https://json-schema.org/draft/2020-12/schema'],
      ['2019-09', 'https://json-schema.org/draft/2019-09/schema'],
      ['draft-07', 'http://json-schema.org/draft-07/schema#'],
    ]) {
      it(`validates against a ${label} $schema`, async () => {
        getDoc.mockResolvedValue({
          ...DOC,
          schemaSnapshot: {
            $schema: uri,
            type: 'object',
            properties: { total: { type: 'number' } },
          },
        } as never)
        update.mockResolvedValue({ ...DOC } as never)
        const bad = await call('update_document_data', {
          document: 'doc-1',
          extractedData: { total: 'x' },
        })
        expect(bad.isError).toBe(true)
        expect(text(bad)).toContain('/total')
        expect(update).not.toHaveBeenCalled()
        const good = await call('update_document_data', {
          document: 'doc-1',
          extractedData: { total: 3 },
        })
        expect(good.isError).toBeFalsy()
        expect(update).toHaveBeenCalledTimes(1)
      })
    }

    for (const [label, uri] of [
      ['2020-12', 'https://json-schema.org/draft/2020-12/schema'],
      ['2019-09', 'https://json-schema.org/draft/2019-09/schema'],
      ['no', undefined],
      ['an unknown (draft-04)', 'http://json-schema.org/draft-04/schema#'],
    ] as const) {
      it(`enforces format: date with ${label} $schema, without warnings`, async () => {
        getDoc.mockResolvedValue({
          ...DOC,
          schemaSnapshot: {
            ...(uri ? { $schema: uri } : {}),
            type: 'object',
            properties: { due: { type: 'string', format: 'date' } },
          },
        } as never)
        update.mockResolvedValue({ ...DOC } as never)
        const warn = vi.spyOn(console, 'warn')
        try {
          const bad = await call('update_document_data', {
            document: 'doc-1',
            extractedData: { due: 'March 3' },
          })
          expect(bad.isError).toBe(true)
          expect(text(bad)).toContain('/due')
          expect(update).not.toHaveBeenCalled()
          const good = await call('update_document_data', {
            document: 'doc-1',
            extractedData: { due: '2026-03-03' },
          })
          expect(good.isError).toBeFalsy()
          expect(update).toHaveBeenCalledTimes(1)
          expect(warn).not.toHaveBeenCalled()
        } finally {
          warn.mockRestore()
        }
      })
    }

    it('falls back to the document type schema', async () => {
      getDoc.mockResolvedValue({ ...DOC, schemaSnapshot: null } as never)
      getType.mockResolvedValue({
        ...TYPE,
        schema: { type: 'object', required: ['a'] },
      } as never)
      const res = await call('update_document_data', {
        document: 'doc-1',
        extractedData: {},
      })
      expect(res.isError).toBe(true)
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('set_document_status', () => {
    it('updates every document', async () => {
      getDoc.mockImplementation(
        async (r) => ({ ...DOC, id: String(r) }) as never,
      )
      update.mockImplementation(async (d) => d as never)
      const res = await call('set_document_status', {
        documents: ['a', 'b'],
        status: 'approved',
      })
      expect(update).toHaveBeenCalledTimes(2)
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a' }),
        { status: 'approved', updatedBy: USER.id },
      )
      expect(JSON.parse(text(res))).toEqual({
        updated: ['a', 'b'],
        notFound: [],
      })
    })

    it('passes the rejection reason', async () => {
      update.mockImplementation(async (d) => d as never)
      await call('set_document_status', {
        documents: ['a'],
        status: 'rejected',
        rejectionReason: 'blurry',
      })
      expect(update.mock.calls[0][1]).toMatchObject({
        status: 'rejected',
        rejectionReason: 'blurry',
      })
    })

    it('leaves rejectionReason untouched when omitted', async () => {
      update.mockImplementation(async (d) => d as never)
      await call('set_document_status', {
        documents: ['a'],
        status: 'rejected',
      })
      expect(update.mock.calls[0][1].rejectionReason).toBeUndefined()
    })

    it('is an error only when everything was not found', async () => {
      getDoc.mockResolvedValue(null)
      const res = await call('set_document_status', {
        documents: ['zzz'],
        status: 'approved',
      })
      expect(res.isError).toBe(true)
      expect(update).not.toHaveBeenCalled()
    })

    it('reports partial not-found without error', async () => {
      getDoc.mockImplementation(async (r) =>
        r === 'a' ? (DOC as never) : null,
      )
      update.mockImplementation(async (d) => d as never)
      const res = await call('set_document_status', {
        documents: ['a', 'zzz'],
        status: 'approved',
      })
      expect(res.isError).toBeFalsy()
      expect(JSON.parse(text(res))).toEqual({
        updated: ['d1'],
        notFound: ['zzz'],
      })
    })
  })

  describe('document type tools', () => {
    it('refuses create_document_type without permission', async () => {
      check.mockResolvedValue(false)
      const res = await call('create_document_type', { name: 'X', schema: {} })
      expect(res.isError).toBe(true)
      expect(text(res)).toContain('documentType:create')
      expect(createType).not.toHaveBeenCalled()
    })

    it('strips webhookConfig and never returns it', async () => {
      createType.mockResolvedValue(TYPE as never)
      const res = await call('create_document_type', {
        name: 'Invoices',
        schema: { type: 'object' },
        webhookConfig: { url: 'https://evil' },
      })
      expect(res.isError).toBeFalsy()
      expect(createType.mock.calls[0][0]).not.toHaveProperty('webhookConfig')
      expect(createType.mock.calls[0][0]).toMatchObject({
        name: 'Invoices',
        createdBy: USER.id,
      })
      expect(text(res)).not.toContain('secret')
      expect(text(res)).not.toContain('webhookConfig')
    })

    it('update_document_type passes updatedBy and no webhookConfig', async () => {
      updateType.mockResolvedValue(TYPE as never)
      const res = await call('update_document_type', {
        documentType: 'invoices',
        name: 'New',
        webhookConfig: { url: 'x' },
      })
      expect(res.isError).toBeFalsy()
      expect(check).toHaveBeenCalledWith(USER, 'documentType', 'update')
      expect(updateType).toHaveBeenCalledWith('t1', {
        name: 'New',
        updatedBy: USER.id,
      })
      expect(text(res)).not.toContain('secret')
    })
  })
})
