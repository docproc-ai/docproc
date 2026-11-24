import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../caller', () => ({ checkPermission: vi.fn() }))
vi.mock('./write', () => ({ registerWriteTools: vi.fn() }))
vi.mock('../../lib/db/document-operations', () => ({
  getDocuments: vi.fn(),
  getDocumentBySlugOrId: vi.fn(),
}))
vi.mock('../../lib/db/document-type-operations', () => ({
  getDocumentTypes: vi.fn(),
  getDocumentTypeBySlugOrId: vi.fn(),
}))
vi.mock('../../lib/db/job-operations', () => ({
  getJob: vi.fn(),
  getBatchWithJobs: vi.fn(),
}))
vi.mock('../../storage', () => ({ storage: { download: vi.fn() } }))

import {
  getDocumentBySlugOrId,
  getDocuments,
} from '../../lib/db/document-operations'
import {
  getDocumentTypeBySlugOrId,
  getDocumentTypes,
} from '../../lib/db/document-type-operations'
import { getBatchWithJobs, getJob } from '../../lib/db/job-operations'
import { storage } from '../../storage'
import { checkPermission, type McpCaller } from '../caller'
import { createMcpServer } from '../server'

const check = vi.mocked(checkPermission)
const USER: McpCaller = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'u@example.com',
  name: 'U',
  role: 'user',
}
const ADMIN: McpCaller = { ...USER, role: 'admin' }

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

const TYPE_ROW = {
  id: 't1',
  slug: 'invoices',
  name: 'Invoices',
  schema: { type: 'object', properties: { vendor: {}, total: {} } },
  slugPattern: '{vendor}',
  modelName: 'm',
  validationInstructions: null,
  webhookConfig: { url: 'https://x', headers: { Authorization: 'secret' } },
  documentCount: 2,
  statusCounts: { pending: 1, processed: 1, approved: 0, rejected: 0 },
}

const DOC_ROW = {
  id: 'd1',
  slug: 'a',
  filename: 'a.png',
  status: 'pending',
  storagePath: 'k',
  documentTypeId: 't1',
  extractedData: { a: 1 },
  schemaSnapshot: { type: 'object' },
}

describe('read tools', () => {
  let h: Awaited<ReturnType<typeof connect>>
  beforeEach(async () => {
    for (const f of [
      check,
      vi.mocked(getDocumentTypes),
      vi.mocked(getDocumentTypeBySlugOrId),
      vi.mocked(getDocuments),
      vi.mocked(getDocumentBySlugOrId),
      vi.mocked(getJob),
      vi.mocked(getBatchWithJobs),
      vi.mocked(storage.download),
    ]) {
      f.mockReset()
    }
    check.mockResolvedValue(true)
    h = await connect()
  })
  afterEach(async () => {
    await h.close()
  })

  it('tools/list returns the six names for user and admin', async () => {
    const names = (await h.client.listTools()).tools.map((t) => t.name).sort()
    const a = await connect(ADMIN)
    const adminNames = (await a.client.listTools()).tools
      .map((t) => t.name)
      .sort()
    await a.close()
    expect(names).toEqual(
      [
        'get_document',
        'get_document_file',
        'get_document_type',
        'get_job',
        'list_document_types',
        'list_documents',
      ].sort(),
    )
    expect(adminNames).toEqual(names)
  })

  it('refuses without permission', async () => {
    check.mockResolvedValue(false)
    const res = await h.client.callTool({
      name: 'list_document_types',
      arguments: {},
    })
    expect(res.isError).toBe(true)
    expect(text(res)).toMatch(/^Your DocProc role is/)
    expect(check).toHaveBeenCalledWith(USER, 'documentType', 'list')
    expect(getDocumentTypes).not.toHaveBeenCalled()
  })

  it('list_document_types omits webhookConfig and lists fields', async () => {
    vi.mocked(getDocumentTypes).mockResolvedValue([TYPE_ROW] as never)
    const res = await h.client.callTool({
      name: 'list_document_types',
      arguments: {},
    })
    expect(JSON.stringify(res)).not.toContain('webhookConfig')
    expect(JSON.stringify(res)).not.toContain('secret')
    expect(JSON.parse(text(res))[0].fields).toEqual(['vendor', 'total'])
  })

  it('get_document_type by slug omits webhookConfig', async () => {
    vi.mocked(getDocumentTypeBySlugOrId).mockResolvedValue(TYPE_ROW as never)
    const res = await h.client.callTool({
      name: 'get_document_type',
      arguments: { documentType: 'invoices' },
    })
    expect(getDocumentTypeBySlugOrId).toHaveBeenCalledWith('invoices')
    expect(JSON.stringify(res)).not.toContain('webhookConfig')
    expect(JSON.parse(text(res)).slug).toBe('invoices')
  })

  it('get_document_type unknown -> not found', async () => {
    vi.mocked(getDocumentTypeBySlugOrId).mockResolvedValue(null)
    const res = await h.client.callTool({
      name: 'get_document_type',
      arguments: { documentType: 'nope' },
    })
    expect(res.isError).toBe(true)
    expect(text(res)).toBe('Document type not found')
  })

  it('get_document unknown -> not found', async () => {
    vi.mocked(getDocumentBySlugOrId).mockResolvedValue(null)
    const res = await h.client.callTool({
      name: 'get_document',
      arguments: { document: 'nope' },
    })
    expect(res.isError).toBe(true)
    expect(text(res)).toBe('Document not found')
  })

  it('get_document picks fields explicitly', async () => {
    vi.mocked(getDocumentBySlugOrId).mockResolvedValue(DOC_ROW as never)
    const res = await h.client.callTool({
      name: 'get_document',
      arguments: { document: 'a' },
    })
    expect(text(res)).not.toContain('storagePath')
    expect(JSON.parse(text(res)).id).toBe('d1')
    expect(JSON.parse(text(res))).toHaveProperty('extractedData')
    expect(JSON.parse(text(res))).toHaveProperty('schemaSnapshot')
  })

  it('list_documents rejects pageSize 500 without a db call', async () => {
    let failed = false
    try {
      const res = await h.client.callTool({
        name: 'list_documents',
        arguments: { documentType: 'invoices', pageSize: 500 },
      })
      failed = res.isError === true
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
    expect(getDocumentTypeBySlugOrId).not.toHaveBeenCalled()
    expect(getDocuments).not.toHaveBeenCalled()
  })

  it('list_documents resolves the type and defaults pageSize 25', async () => {
    vi.mocked(getDocumentTypeBySlugOrId).mockResolvedValue(TYPE_ROW as never)
    vi.mocked(getDocuments).mockResolvedValue({
      documents: [DOC_ROW],
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    } as never)
    const res = await h.client.callTool({
      name: 'list_documents',
      arguments: { documentType: 'invoices' },
    })
    expect(getDocuments).toHaveBeenCalledWith('t1', {
      status: 'all',
      search: undefined,
      page: 1,
      pageSize: 25,
    })
    expect(JSON.parse(text(res)).documents[0].filename).toBe('a.png')
  })

  it('get_document_file returns an image for a PNG', async () => {
    vi.mocked(getDocumentBySlugOrId).mockResolvedValue(DOC_ROW as never)
    vi.mocked(storage.download).mockResolvedValue({
      buffer: Buffer.from('png'),
      mimeType: 'image/png',
    })
    const res = await h.client.callTool({
      name: 'get_document_file',
      arguments: { document: 'a' },
    })
    expect(res.content).toEqual([
      {
        type: 'image',
        data: Buffer.from('png').toString('base64'),
        mimeType: 'image/png',
      },
    ])
  })

  it('get_document_file returns a resource plus note for a PDF', async () => {
    vi.mocked(getDocumentBySlugOrId).mockResolvedValue(DOC_ROW as never)
    vi.mocked(storage.download).mockResolvedValue({
      buffer: Buffer.from('pdf'),
      mimeType: 'application/pdf',
    })
    const res = await h.client.callTool({
      name: 'get_document_file',
      arguments: { document: 'a' },
    })
    const c = res.content as { type: string; resource?: { uri: string } }[]
    expect(c[0].type).toBe('resource')
    expect(c[0].resource?.uri).toBe('docproc://documents/d1/file')
    expect(c[1].type).toBe('text')
  })

  it('get_document_file rejects files over 5 MB', async () => {
    vi.mocked(getDocumentBySlugOrId).mockResolvedValue(DOC_ROW as never)
    vi.mocked(storage.download).mockResolvedValue({
      buffer: Buffer.alloc(6 * 1024 * 1024),
      mimeType: 'image/png',
    })
    const res = await h.client.callTool({
      name: 'get_document_file',
      arguments: { document: 'a' },
    })
    expect(res.isError).toBe(true)
    expect(text(res)).toBe(
      'File is larger than 5 MB; open it in DocProc instead.',
    )
  })

  it('get_job requires exactly one of jobId/batchId', async () => {
    for (const args of [{}, { jobId: 'j', batchId: 'b' }]) {
      let failed = false
      try {
        const res = await h.client.callTool({
          name: 'get_job',
          arguments: args,
        })
        failed = res.isError === true
      } catch {
        failed = true
      }
      expect(failed).toBe(true)
    }
    expect(getJob).not.toHaveBeenCalled()
    expect(getBatchWithJobs).not.toHaveBeenCalled()
  })

  it('get_job by jobId and by batchId', async () => {
    vi.mocked(getJob).mockResolvedValue({ id: 'j', status: 'pending' } as never)
    vi.mocked(getBatchWithJobs).mockResolvedValue({
      batch: {
        id: 'b',
        status: 'pending',
        webhookUrl: 'https://hook.example/?token=SECRETTOKEN',
        createdBy: 'user-xyz',
      },
      jobs: [{ id: 'j', createdBy: 'user-xyz' }],
    } as never)
    const a = await h.client.callTool({
      name: 'get_job',
      arguments: { jobId: 'j' },
    })
    expect(JSON.parse(text(a)).id).toBe('j')
    const b = await h.client.callTool({
      name: 'get_job',
      arguments: { batchId: 'b' },
    })
    expect(JSON.parse(text(b)).jobs).toHaveLength(1)
    const all = JSON.stringify(b)
    expect(all).not.toContain('webhookUrl')
    expect(all).not.toContain('SECRETTOKEN')
    expect(all).not.toContain('createdBy')
    expect(all).not.toContain('user-xyz')
  })
})
