import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { z } from 'zod'

import { batch, document, documentType, job } from '../db/schema/app'

// Derive Zod schemas from Drizzle tables - single source of truth
export const documentTypeSelectSchema = createSelectSchema(documentType)
export const documentTypeInsertSchema = createInsertSchema(documentType)

export const documentSelectSchema = createSelectSchema(document)
export const documentInsertSchema = createInsertSchema(document)

export const jobSelectSchema = createSelectSchema(job)
export const jobInsertSchema = createInsertSchema(job)

export const batchSelectSchema = createSelectSchema(batch)
export const batchInsertSchema = createInsertSchema(batch)

// Re-export types from Drizzle
export type {
  BatchInsert,
  BatchSelect,
  DocumentInsert,
  DocumentSelect,
  DocumentTypeInsert,
  DocumentTypeSelect,
  JobInsert,
  JobSelect,
} from '../db/schema/app'

// API-specific schemas (DTOs that differ from DB shape)
export const createDocumentTypeRequest = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  schema: z.record(z.unknown()),
})

export const createDocumentRequest = z.object({
  documentTypeId: z.string().uuid(),
})

export const processDocumentRequest = z.object({
  documentId: z.string().uuid(),
  model: z.string().optional(),
})
