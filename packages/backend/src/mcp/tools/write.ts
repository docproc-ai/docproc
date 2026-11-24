import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Ajv, type ValidateFunction } from 'ajv'
import Ajv2019 from 'ajv/dist/2019'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import { z } from 'zod'
import { getDocumentBySlugOrId } from '../../lib/db/document-operations'
import {
  createDocumentType,
  updateDocumentType,
} from '../../lib/db/document-type-operations'
import type { EnabledMcpConfig } from '../../lib/mcp-config'
import {
  startSingleDocumentProcessing,
  updateDocumentWithWebhooks,
  uploadDocuments,
} from '../../services/documents'
import { ServiceError } from '../../services/errors'
import {
  createUploadLink,
  getUploadLinkForUser,
  uploadLinkStatus,
} from '../../services/upload-links'
import type { McpCaller } from '../caller'
import {
  DOC_NOT_FOUND,
  DOC_TYPE_NOT_FOUND,
  guard,
  MAX_FILE_BYTES,
  requireDocument,
  requireDocumentType,
  toolError,
  toolJson,
} from './helpers'

const PROCESS_WAIT_MS = 45_000

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

const annotations = (a: {
  destructiveHint: boolean
  idempotentHint: boolean
}) => ({ readOnlyHint: false, openWorldHint: false, ...a })

/** Same picked fields as `get_document_type`; never `webhookConfig`. */
function projectDocumentType(t: {
  id: string
  slug: string
  name: string
  schema: unknown
  slugPattern: string | null
  modelName: string | null
  validationInstructions: string | null
}) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    schema: t.schema,
    slugPattern: t.slugPattern,
    modelName: t.modelName,
    validationInstructions: t.validationInstructions,
  }
}

/** Decoded size of an already-validated base64 string. */
function decodedLength(b64: string): number {
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return (b64.length / 4) * 3 - padding
}

/**
 * Picks the Ajv dialect from `$schema` so dialect keywords (prefixItems,
 * $defs, unevaluated*) keep working; the default class only knows draft-07.
 * An unknown `$schema` (e.g. draft-04) is retried with the key removed.
 */
function compileSchema(schema: object): ValidateFunction {
  const opts = { allErrors: true, strict: false }
  const uri = (schema as { $schema?: unknown }).$schema
  const dialect = typeof uri === 'string' ? uri : ''
  // `format` (e.g. "date" from the schema builder) is enforced, not ignored.
  const withFormats = <T extends Ajv>(ajv: T): T => {
    addFormats(ajv)
    return ajv
  }
  const make = () =>
    withFormats(
      dialect.includes('2020-12')
        ? new Ajv2020(opts)
        : dialect.includes('2019-09')
          ? new Ajv2019(opts)
          : new Ajv(opts),
    )
  try {
    return make().compile(schema)
  } catch (error) {
    if (!dialect) throw error
    const { $schema: _omit, ...rest } = schema as Record<string, unknown>
    return withFormats(new Ajv(opts)).compile(rest)
  }
}

function validateAgainst(schema: unknown, data: unknown): string[] {
  let validate: ValidateFunction
  try {
    validate = compileSchema(schema as object)
  } catch {
    throw new ServiceError(
      'invalid',
      "This document's schema is not a valid JSON Schema, so the data cannot be checked.",
    )
  }
  if (validate(data)) return []
  return (validate.errors ?? [])
    .slice(0, 5)
    .map((e) => `${e.instancePath || '/'}: ${e.message ?? 'is invalid'}`)
}

/** Tools that create or change data. Every handler re-checks via `guard`. */
export function registerWriteTools(
  server: McpServer,
  caller: McpCaller,
  config: EnabledMcpConfig,
): void {
  server.registerTool(
    'upload_document',
    {
      title: 'Upload document',
      description:
        'Upload one small file (PDF or image) as base64 to a document type, optionally starting extraction. Only for tiny files you already have as base64 (a few KB); for a file the user attached or anything larger, use create_upload_link instead (hard limit here 5 MB). Requires role: user or admin.',
      inputSchema: {
        documentType: z.string().describe('Document type slug or id'),
        filename: z.string().min(1),
        contentBase64: z.string().describe('File content, base64 encoded'),
        mimeType: z
          .string()
          .optional()
          .describe('MIME type; inferred from the filename if omitted'),
        process: z
          .boolean()
          .optional()
          .describe('Start AI extraction right after upload'),
      },
      annotations: annotations({
        destructiveHint: false,
        idempotentHint: false,
      }),
    },
    async ({
      documentType,
      filename,
      contentBase64,
      mimeType,
      process: autoProcess,
    }) =>
      guard(caller, 'document', 'create', async () => {
        if (
          contentBase64.length === 0 ||
          contentBase64.length % 4 !== 0 ||
          !BASE64.test(contentBase64)
        ) {
          return toolError('contentBase64 is not valid base64.')
        }
        if (decodedLength(contentBase64) > MAX_FILE_BYTES) {
          return toolError(
            'File is larger than 5 MB; upload it in DocProc instead.',
          )
        }
        const docType = await requireDocumentType(documentType)
        const result = await uploadDocuments(
          docType,
          [
            {
              name: filename,
              type: mimeType ?? '',
              buffer: Buffer.from(contentBase64, 'base64'),
            },
          ],
          { userId: caller.id, autoProcess },
        )
        const first = result.results[0]
        if (!first?.success) {
          return toolError(first?.error ?? 'Upload failed')
        }
        return toolJson({
          documentId: first.documentId,
          filename: first.filename,
          documentType: result.documentTypeSlug,
          ...(result.jobIds ? { jobIds: result.jobIds } : {}),
          ...(result.batchId ? { batchId: result.batchId } : {}),
        })
      }),
  )

  server.registerTool(
    'create_upload_link',
    {
      title: 'Create upload link',
      description:
        "Create a one-time link (valid 15 minutes) for the user to upload a file, such as a PDF, in their browser. Use this instead of upload_document for any file the user has attached or that is larger than a few KB. Give the user the URL, ask them to say when they've uploaded, then call get_upload. Requires role: user or admin.",
      inputSchema: {
        documentType: z.string().describe('Document type slug or id'),
        process: z
          .boolean()
          .optional()
          .describe('Start AI extraction right after the upload'),
      },
      annotations: annotations({
        destructiveHint: false,
        idempotentHint: false,
      }),
    },
    async ({ documentType, process: autoProcess }) =>
      guard(caller, 'document', 'create', async () => {
        const docType = await requireDocumentType(documentType)
        const link = await createUploadLink({
          userId: caller.id,
          documentTypeId: docType.id,
          autoProcess: autoProcess ?? false,
        })
        return toolJson({
          uploadId: link.id,
          uploadUrl: `${config.baseUrl}/upload/${link.token}`,
          expiresAt: link.expiresAt.toISOString(),
        })
      }),
  )

  server.registerTool(
    'get_upload',
    {
      title: 'Get upload',
      description:
        'Check an upload link from create_upload_link: pending, completed (with documentId, and jobId if processing was requested) or expired. Requires role: user or admin.',
      inputSchema: {
        uploadId: z.string().describe('uploadId from create_upload_link'),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ uploadId }) =>
      guard(caller, 'document', 'create', async () => {
        const link = await getUploadLinkForUser(uploadId, caller.id)
        if (!link) return toolError('Upload not found.')
        const docType = await requireDocumentType(link.documentTypeId)
        const status = uploadLinkStatus(link)
        return toolJson({
          status,
          expiresAt: link.expiresAt.toISOString(),
          ...(link.documentId ? { documentId: link.documentId } : {}),
          ...(link.jobId ? { jobId: link.jobId } : {}),
          documentType: { slug: docType.slug },
          ...(status === 'pending'
            ? { message: 'Not uploaded yet; ask the user to finish uploading.' }
            : {}),
        })
      }),
  )

  server.registerTool(
    'process_document',
    {
      title: 'Process document',
      description:
        'Run AI extraction on a pending document. Waits up to 45 seconds for the result; if it is still running, returns a jobId to check with get_job. Requires role: user or admin.',
      inputSchema: {
        document: z.string().describe('Document slug or id'),
        model: z.string().optional().describe('Override the model'),
      },
      annotations: annotations({
        destructiveHint: false,
        idempotentHint: false,
      }),
    },
    async ({ document, model }) =>
      guard(caller, 'document', 'update', async () => {
        const doc = await requireDocument(document)
        const { jobId, done } = await startSingleDocumentProcessing(doc.id, {
          userId: caller.id,
          model,
        })
        // No catch needed here: the service already attaches one and logs
        // failures, so a failure after we stop waiting is neither unhandled
        // nor silent (an earlier one is also returned to the caller below).

        let timer: ReturnType<typeof setTimeout> | undefined
        const timeout = new Promise<'timeout'>((resolve) => {
          timer = setTimeout(() => resolve('timeout'), PROCESS_WAIT_MS)
        })
        try {
          let outcome: Awaited<typeof done> | 'timeout'
          try {
            outcome = await Promise.race([done, timeout])
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error)
            return toolError(`Extraction failed: ${msg} (job ${jobId}).`)
          }
          if (outcome === 'timeout') {
            return toolJson({
              status: 'processing',
              jobId,
              message: 'Still running; check with get_job.',
            })
          }
          return toolJson({
            status: outcome.status ?? 'processed',
            extractedData: outcome.extractedData,
          })
        } finally {
          clearTimeout(timer)
        }
      }),
  )

  server.registerTool(
    'update_document_data',
    {
      title: 'Update extracted data',
      description:
        "Replace a document's extracted data. The data is validated against the document's schema first; nothing is saved if it does not match. Requires role: user or admin.",
      inputSchema: {
        document: z.string().describe('Document slug or id'),
        extractedData: z.record(z.string(), z.unknown()),
      },
      annotations: annotations({ destructiveHint: true, idempotentHint: true }),
    },
    async ({ document, extractedData }) =>
      guard(caller, 'document', 'update', async () => {
        const doc = await requireDocument(document)
        const schema =
          doc.schemaSnapshot ??
          (await requireDocumentType(doc.documentTypeId)).schema
        const errors = validateAgainst(schema, extractedData)
        if (errors.length > 0) {
          return toolError(
            `extractedData does not match the schema; nothing was saved:\n${errors.join('\n')}`,
          )
        }
        const updated = await updateDocumentWithWebhooks(doc, {
          extractedData,
          updatedBy: caller.id,
        })
        if (!updated) return toolError(DOC_NOT_FOUND)
        return toolJson({
          id: updated.id,
          slug: updated.slug,
          status: updated.status,
          extractedData: updated.extractedData,
        })
      }),
  )

  server.registerTool(
    'set_document_status',
    {
      title: 'Set document status',
      description:
        "Approve, reject, or reset to processed one or more documents (up to 100). Approving triggers the type's webhook, per document. rejectionReason applies when rejecting. Requires role: user or admin.",
      inputSchema: {
        documents: z
          .array(z.string().min(1))
          .min(1)
          .max(100)
          .describe('Document slugs or ids'),
        status: z.enum(['approved', 'rejected', 'processed']),
        rejectionReason: z.string().optional(),
      },
      annotations: annotations({
        destructiveHint: false,
        idempotentHint: true,
      }),
    },
    async ({ documents, status, rejectionReason }) =>
      guard(caller, 'document', 'update', async () => {
        const updated: string[] = []
        const notFound: string[] = []
        for (const ref of documents) {
          const doc = await getDocumentBySlugOrId(ref)
          const saved = doc
            ? await updateDocumentWithWebhooks(doc, {
                status,
                rejectionReason,
                updatedBy: caller.id,
              })
            : null
          if (saved) updated.push(saved.id)
          else notFound.push(ref)
        }
        if (updated.length === 0) {
          return toolError(`${DOC_NOT_FOUND}: ${notFound.join(', ')}`)
        }
        return toolJson({ updated, notFound })
      }),
  )

  server.registerTool(
    'create_document_type',
    {
      title: 'Create document type',
      description:
        'Create a document type from a JSON Schema describing the fields to extract. Requires role: admin.',
      inputSchema: {
        name: z.string().min(1),
        schema: z.record(z.string(), z.unknown()),
        slugPattern: z
          .string()
          .optional()
          .describe('Slug template, e.g. {vendor}-{invoice_number}'),
        modelName: z.string().optional(),
        validationInstructions: z.string().optional(),
      },
      annotations: annotations({
        destructiveHint: false,
        idempotentHint: false,
      }),
    },
    async ({ name, schema, slugPattern, modelName, validationInstructions }) =>
      guard(caller, 'documentType', 'create', async () => {
        const created = await createDocumentType({
          name,
          schema,
          slugPattern,
          modelName,
          validationInstructions,
          createdBy: caller.id,
        })
        return toolJson(projectDocumentType(created))
      }),
  )

  server.registerTool(
    'update_document_type',
    {
      title: 'Update document type',
      description:
        "Change a document type's name, schema, slug pattern, model or validation instructions. Only the fields you pass are changed. Requires role: admin.",
      inputSchema: {
        documentType: z.string().describe('Document type slug or id'),
        name: z.string().min(1).optional(),
        schema: z.record(z.string(), z.unknown()).optional(),
        slugPattern: z.string().optional(),
        modelName: z.string().optional(),
        validationInstructions: z.string().optional(),
      },
      annotations: annotations({ destructiveHint: true, idempotentHint: true }),
    },
    async ({
      documentType,
      name,
      schema,
      slugPattern,
      modelName,
      validationInstructions,
    }) =>
      guard(caller, 'documentType', 'update', async () => {
        const existing = await requireDocumentType(documentType)
        const updated = await updateDocumentType(existing.id, {
          name,
          schema,
          slugPattern,
          modelName,
          validationInstructions,
          updatedBy: caller.id,
        })
        if (!updated) return toolError(DOC_TYPE_NOT_FOUND)
        return toolJson(projectDocumentType(updated))
      }),
  )
}
