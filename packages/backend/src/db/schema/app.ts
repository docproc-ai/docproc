import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { user } from './auth'
// Custom json() to avoid double-encoding with Bun SQL driver (see custom-types.ts)
import { json } from './custom-types'

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
  // Pattern for generating document slugs, e.g. "{vendor}-{invoice_number}-{id()}"
  slugPattern: text('slug_pattern'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid('created_by').references(() => user.id, {
    onDelete: 'set null',
  }),
  updatedBy: uuid('updated_by').references(() => user.id, {
    onDelete: 'set null',
  }),
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
    // Friendly slug/alias for the document (nullable for legacy docs, falls back to id)
    slug: text('slug'),
    extractedData: json('extracted_data'),
    schemaSnapshot: json('schema_snapshot'),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: uuid('created_by').references(() => user.id, {
      onDelete: 'set null',
    }),
    updatedBy: uuid('updated_by').references(() => user.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('idx_document_document_type_id').on(table.documentTypeId),
    index('idx_document_status').on(table.status),
    index('idx_document_slug').on(table.slug),
  ],
)

/**
 * One-time browser upload links created by the MCP `create_upload_link` tool.
 * Only a SHA-256 hash of the token is stored; the link is bound to its user.
 */
export const mcpUploadLink = pgTable('mcp_upload_link', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  documentTypeId: uuid('document_type_id')
    .notNull()
    .references(() => documentType.id, { onDelete: 'cascade' }),
  autoProcess: boolean('auto_process').notNull().default(false),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  // No FK on purpose: if the document is deleted later, the link still
  // records that the upload completed (get_document then says not found).
  documentId: uuid('document_id'),
  // Processing jobs are in-memory with nanoid ids, hence text.
  jobId: text('job_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Type exports
export type DocumentTypeSelect = typeof documentType.$inferSelect
export type DocumentTypeInsert = typeof documentType.$inferInsert
export type DocumentSelect = typeof document.$inferSelect
export type DocumentInsert = typeof document.$inferInsert
export type McpUploadLinkSelect = typeof mcpUploadLink.$inferSelect
