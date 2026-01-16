import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

import { document, documentType } from './db/schema/app'

// Derive Zod schemas from Drizzle tables - single source of truth
export const documentTypeSelectSchema = createSelectSchema(documentType)
export const documentTypeInsertSchema = createInsertSchema(documentType)

export const documentSelectSchema = createSelectSchema(document)
export const documentInsertSchema = createInsertSchema(document)

// Re-export types from Drizzle
export type {
  DocumentInsert,
  DocumentSelect,
  DocumentTypeInsert,
  DocumentTypeSelect,
} from './db/schema/app'

// Job and Batch types are in-memory in the backend package
// Import them directly from @docproc/backend when needed

// ============================================
// Document Type API Schemas
// ============================================

export const createDocumentTypeRequest = z.object({
  name: z.string().min(1, 'Name is required'),
  schema: z.record(z.string(), z.unknown()),
  validationInstructions: z.string().nullable().optional(),
  modelName: z.string().nullable().optional(),
  webhookConfig: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const updateDocumentTypeRequest = z.object({
  name: z.string().min(1).optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
  validationInstructions: z.string().nullable().optional(),
  modelName: z.string().nullable().optional(),
  webhookConfig: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type CreateDocumentTypeRequest = z.infer<typeof createDocumentTypeRequest>
export type UpdateDocumentTypeRequest = z.infer<typeof updateDocumentTypeRequest>

// ============================================
// Document API Schemas
// ============================================

export const documentStatusEnum = z.enum(['pending', 'processed', 'approved', 'rejected'])
export type DocumentStatus = z.infer<typeof documentStatusEnum>

export const getDocumentsQuery = z.object({
  documentTypeId: z.uuid(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  status: z.string().default('all'),
  search: z.string().optional(),
})

export const updateDocumentRequest = z.object({
  extractedData: z.record(z.string(), z.unknown()).nullable().optional(),
  schemaSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),
  status: documentStatusEnum.optional(),
  rejectionReason: z.string().nullable().optional(),
})

export const bulkStatusUpdateRequest = z.object({
  documentIds: z.array(z.uuid()).min(1),
  status: documentStatusEnum,
})

export const bulkDeleteRequest = z.object({
  documentIds: z.array(z.uuid()).min(1),
})

export type GetDocumentsQuery = z.infer<typeof getDocumentsQuery>
export type UpdateDocumentRequest = z.infer<typeof updateDocumentRequest>
export type BulkStatusUpdateRequest = z.infer<typeof bulkStatusUpdateRequest>
export type BulkDeleteRequest = z.infer<typeof bulkDeleteRequest>

// ============================================
// Processing API Schemas
// ============================================

export const processDocumentRequest = z.object({
  model: z.string().optional(),
})

export const createBatchRequest = z.object({
  documentIds: z.array(z.uuid()).min(1),
  webhookUrl: z.string().url().optional(),
})

export type ProcessDocumentRequest = z.infer<typeof processDocumentRequest>
export type CreateBatchRequest = z.infer<typeof createBatchRequest>

// ============================================
// Common Response Schemas
// ============================================

export const paginationSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  totalPages: z.number(),
})

export const errorResponseSchema = z.object({
  error: z.string(),
})

export type PaginationResponse = z.infer<typeof paginationSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
