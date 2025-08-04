import { pgTable, text, json, timestamp, index, pgEnum, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const documentType = pgTable('document_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  schema: json('schema').notNull(),
  webhookConfig: json('webhook_config'),
  modelName: text('model_name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid('created_by').references(() => user.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references(() => user.id, { onDelete: 'set null' }),
})

export const documentStatus = pgEnum('document_status', [
  'pending', // Document needs to be processed AND approved (user must click process + approve)
  'processed', // Document is processed and needs approval/editing (user just needs to approve/edit)
  'approved', // Document is finalized and approved
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
    storagePath: text('storage_path').notNull(),
    extractedData: json('extracted_data'),
    schemaSnapshot: json('schema_snapshot'),
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

export type DocumentTypeSelect = typeof documentType.$inferSelect
export type DocumentTypeInsert = typeof documentType.$inferInsert
export type DocumentSelect = typeof document.$inferSelect
export type DocumentInsert = typeof document.$inferInsert
