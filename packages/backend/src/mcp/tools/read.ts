import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import {
  getDocumentBySlugOrId,
  getDocuments,
} from '../../lib/db/document-operations'
import {
  getDocumentTypeBySlugOrId,
  getDocumentTypes,
} from '../../lib/db/document-type-operations'
import { getBatchWithJobs, getJob } from '../../lib/db/job-operations'
import { ServiceError } from '../../services/errors'
import { storage } from '../../storage'
import type { McpCaller } from '../caller'
import { guard, toolError, toolJson } from './helpers'

const MAX_FILE_BYTES = 5 * 1024 * 1024

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

const DOC_TYPE_NOT_FOUND = 'Document type not found'
const DOC_NOT_FOUND = 'Document not found'

function topLevelFields(schema: unknown): string[] {
  if (schema && typeof schema === 'object') {
    const props = (schema as { properties?: unknown }).properties
    if (props && typeof props === 'object') return Object.keys(props)
  }
  return []
}

type JobRow = NonNullable<Awaited<ReturnType<typeof getJob>>>

function projectJob(j: JobRow) {
  return {
    id: j.id,
    documentId: j.documentId,
    documentTypeId: j.documentTypeId,
    batchId: j.batchId,
    status: j.status,
    progress: j.progress,
    error: j.error,
    createdAt: j.createdAt,
    startedAt: j.startedAt,
    completedAt: j.completedAt,
  }
}

async function requireDocument(ref: string) {
  const doc = await getDocumentBySlugOrId(ref)
  if (!doc) throw new ServiceError('not_found', DOC_NOT_FOUND)
  return doc
}

async function requireDocumentType(ref: string) {
  const t = await getDocumentTypeBySlugOrId(ref)
  if (!t) throw new ServiceError('not_found', DOC_TYPE_NOT_FOUND)
  return t
}

/** Read-only tools. Every handler re-checks permission via `guard`. */
export function registerReadTools(server: McpServer, caller: McpCaller): void {
  server.registerTool(
    'list_document_types',
    {
      title: 'List document types',
      description:
        'List all document types with their slug, document counts by status, and top-level field names. Requires role: user or admin.',
      inputSchema: {},
      annotations,
    },
    async () =>
      guard(caller, 'documentType', 'list', async () => {
        const types = await getDocumentTypes()
        return toolJson(
          types.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
            documentCount: t.documentCount,
            statusCounts: t.statusCounts,
            fields: topLevelFields(t.schema),
          })),
        )
      }),
  )

  server.registerTool(
    'get_document_type',
    {
      title: 'Get document type',
      description:
        'Get one document type with its full JSON schema, slug pattern, model and validation instructions. Requires role: user or admin.',
      inputSchema: {
        documentType: z.string().describe('Document type slug or id'),
      },
      annotations,
    },
    async ({ documentType }) =>
      guard(caller, 'documentType', 'list', async () => {
        const t = await requireDocumentType(documentType)
        return toolJson({
          id: t.id,
          slug: t.slug,
          name: t.name,
          schema: t.schema,
          slugPattern: t.slugPattern,
          modelName: t.modelName,
          validationInstructions: t.validationInstructions,
        })
      }),
  )

  server.registerTool(
    'list_documents',
    {
      title: 'List documents',
      description:
        'List documents of one document type, newest first, with optional status filter and filename/slug search. Requires role: user or admin.',
      inputSchema: {
        documentType: z.string().describe('Document type slug or id'),
        status: z
          .enum(['pending', 'processed', 'approved', 'rejected', 'all'])
          .optional(),
        search: z.string().optional().describe('Match filename or slug'),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      },
      annotations,
    },
    async ({ documentType, status, search, page, pageSize }) =>
      guard(caller, 'document', 'list', async () => {
        const t = await requireDocumentType(documentType)
        const result = await getDocuments(t.id, {
          status: status ?? 'all',
          search,
          page: page ?? 1,
          pageSize: pageSize ?? 25,
        })
        return toolJson({
          documents: result.documents.map((d) => ({
            id: d.id,
            slug: d.slug,
            filename: d.filename,
            status: d.status,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          })),
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          },
        })
      }),
  )

  server.registerTool(
    'get_document',
    {
      title: 'Get document',
      description:
        'Get one document with its status, extracted data and the schema snapshot used for extraction. Requires role: user or admin.',
      inputSchema: {
        document: z.string().describe('Document slug or id'),
      },
      annotations,
    },
    async ({ document }) =>
      guard(caller, 'document', 'list', async () => {
        const d = await requireDocument(document)
        return toolJson({
          id: d.id,
          slug: d.slug,
          filename: d.filename,
          status: d.status,
          rejectionReason: d.rejectionReason,
          documentTypeId: d.documentTypeId,
          extractedData: d.extractedData,
          schemaSnapshot: d.schemaSnapshot,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })
      }),
  )

  server.registerTool(
    'get_document_file',
    {
      title: 'Get document file',
      description:
        'Fetch the original uploaded file (image or PDF, up to 5 MB) so you can look at it. Requires role: user or admin.',
      inputSchema: {
        document: z.string().describe('Document slug or id'),
      },
      annotations,
    },
    async ({ document }) =>
      guard(caller, 'document', 'list', async (): Promise<CallToolResult> => {
        const d = await requireDocument(document)
        const { buffer, mimeType } = await storage.download(d.storagePath)
        if (buffer.length > MAX_FILE_BYTES) {
          return toolError(
            'File is larger than 5 MB; open it in DocProc instead.',
          )
        }
        const data = buffer.toString('base64')
        if (mimeType.startsWith('image/')) {
          return { content: [{ type: 'image', data, mimeType }] }
        }
        return {
          content: [
            {
              type: 'resource',
              resource: {
                uri: `docproc://documents/${d.id}/file`,
                mimeType,
                blob: data,
              },
            },
            {
              type: 'text',
              text: 'You may not be able to read this PDF directly; use get_document to see the extracted data instead.',
            },
          ],
        }
      }),
  )

  server.registerTool(
    'get_job',
    {
      title: 'Get processing job',
      description:
        'Get the status of a processing job, or of a batch together with its jobs. Provide exactly one of jobId or batchId. Requires role: user or admin.',
      inputSchema: z
        .object({
          jobId: z.string().min(1).optional(),
          batchId: z.string().min(1).optional(),
        })
        .refine((v) => (v.jobId === undefined) !== (v.batchId === undefined), {
          message: 'Provide exactly one of jobId or batchId.',
        }),
      annotations,
    },
    async ({ jobId, batchId }) =>
      guard(caller, 'document', 'list', async () => {
        if (jobId) {
          const job = await getJob(jobId)
          if (!job) throw new ServiceError('not_found', 'Job not found')
          return toolJson(projectJob(job))
        }
        const found = await getBatchWithJobs(batchId as string)
        if (!found) throw new ServiceError('not_found', 'Batch not found')
        const b = found.batch
        return toolJson({
          batch: {
            id: b.id,
            documentTypeId: b.documentTypeId,
            total: b.total,
            completed: b.completed,
            failed: b.failed,
            status: b.status,
            createdAt: b.createdAt,
            completedAt: b.completedAt,
          },
          jobs: found.jobs.map(projectJob),
        })
      }),
  )
}
