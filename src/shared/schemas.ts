import { z } from 'zod'

// Document type schema - defines extraction structure
export const documentTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  schema: z.record(z.unknown()), // JSON Schema for extraction
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type DocumentType = z.infer<typeof documentTypeSchema>

// Document schema
export const documentStatusSchema = z.enum(['pending', 'processing', 'processed', 'approved', 'failed'])
export type DocumentStatus = z.infer<typeof documentStatusSchema>

export const documentSchema = z.object({
  id: z.string().uuid(),
  documentTypeId: z.string().uuid(),
  filename: z.string(),
  status: documentStatusSchema,
  extractedData: z.record(z.unknown()).nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Document = z.infer<typeof documentSchema>

// Job schema for processing queue
export const jobStatusSchema = z.enum(['pending', 'running', 'completed', 'failed'])
export type JobStatus = z.infer<typeof jobStatusSchema>

export const jobSchema = z.object({
  id: z.string(),
  documentId: z.string().uuid(),
  status: jobStatusSchema,
  progress: z.object({
    percent: z.number(),
    partialData: z.unknown().optional(),
  }).nullable(),
  error: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Job = z.infer<typeof jobSchema>

// API request/response schemas
export const createDocumentTypeRequest = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  schema: z.record(z.unknown()),
})

export const uploadDocumentRequest = z.object({
  documentTypeId: z.string().uuid(),
})

export const processDocumentRequest = z.object({
  documentId: z.string().uuid(),
  model: z.string().optional(), // Override default model
})
