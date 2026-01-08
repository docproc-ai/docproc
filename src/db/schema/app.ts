import { pgTable, text, json, timestamp, index, pgEnum, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const documentType = pgTable('document_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  schema: json('schema').notNull(),
  webhookConfig: json('webhook_config'),
  validationInstructions: text('validation_instructions'),
  // Changed: modelName now stores OpenRouter format (e.g., 'anthropic/claude-3.5-sonnet')
  // providerName is deprecated but kept for migration compatibility
  providerName: text('provider_name'),
  modelName: text('model_name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
})

export const documentStatus = pgEnum('document_status', [
  'pending',
  'processed',
  'approved',
  'rejected',
])

export const document = pgTable(
  'document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentTypeId: uuid('document_type_id')
      .notNull()
      .references(() => documentType.id),
    status: documentStatus('status').default('pending'),
    filename: text('filename').notNull(),
    storagePath: text('storage_path').notNull(), // Will be renamed to storageKey in future migration
    extractedData: json('extracted_data'),
    schemaSnapshot: json('schema_snapshot'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('idx_document_document_type_id').on(table.documentTypeId),
    index('idx_document_status').on(table.status),
  ],
)

// Job tracking for processing queue
export const job = pgTable(
  'job',
  {
    id: text('id').primaryKey(),
    documentId: uuid('document_id').references(() => document.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').references(() => batch.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'), // pending, processing, completed, failed
    progress: json('progress').$type<{ percent: number; partialData?: unknown }>(),
    error: text('error'),
    createdAt: timestamp('created_at').defaultNow(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  },
  (table) => [
    index('idx_job_status').on(table.status),
    index('idx_job_batch_id').on(table.batchId),
    index('idx_job_document_id').on(table.documentId),
  ],
)

export const batch = pgTable('batch', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentTypeId: uuid('document_type_id').references(() => documentType.id),
  total: text('total').notNull(),
  completed: text('completed').default('0'),
  failed: text('failed').default('0'),
  status: text('status').notNull().default('pending'), // pending, processing, completed, failed, cancelled
  webhookUrl: text('webhook_url'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
})

// Type exports
export type DocumentTypeSelect = typeof documentType.$inferSelect
export type DocumentTypeInsert = typeof documentType.$inferInsert
export type DocumentSelect = typeof document.$inferSelect
export type DocumentInsert = typeof document.$inferInsert
export type JobSelect = typeof job.$inferSelect
export type JobInsert = typeof job.$inferInsert
export type BatchSelect = typeof batch.$inferSelect
export type BatchInsert = typeof batch.$inferInsert
