import {
  pgTable,
  text,
  json,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const documentType = pgTable(
  'document_type',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    schema: json('schema').notNull(),
    webhookUrl: text('webhook_url'),
    webhookMethod: text('webhook_method').default('POST'),
    modelName: text('model_name'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => user.id),
    updatedBy: uuid('updated_by').references(() => user.id),
  },
  (table) => [uniqueIndex('idx_document_type_name').on(table.name)],
)

export const approvalStatus = pgEnum('approval_status', ['pending', 'approved', 'rejected'])
export const processingStatus = pgEnum('processing_status', ['pending', 'processed', 'failed'])

export const document = pgTable(
  'document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentTypeId: uuid('document_type_id')
      .notNull()
      .references(() => documentType.id),
    approvalStatus: approvalStatus('approval_status').default('pending'),
    processingStatus: processingStatus('processing_status').default('pending'),
    filename: text('filename').notNull(),
    storagePath: text('storage_path').notNull(),
    extractedData: json('extracted_data'),
    schemaSnapshot: json('schema_snapshot'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => user.id),
    updatedBy: uuid('updated_by').references(() => user.id),
  },
  (table) => [index('idx_document_document_type_id').on(table.documentTypeId)],
)

export type DocumentTypeSelect = typeof documentType.$inferSelect
export type DocumentTypeInsert = typeof documentType.$inferInsert
export type DocumentSelect = typeof document.$inferSelect
export type DocumentInsert = typeof document.$inferInsert
