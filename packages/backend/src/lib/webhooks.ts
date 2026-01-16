/**
 * Webhook triggering utilities
 * Context-free - can be called from API routes or background jobs
 */

import { getDocumentType } from './db/document-type-operations'
import {
  type DocumentWebhookConfig,
  type DocumentWebhookEventName,
} from './webhook-encryption'

export type { DocumentWebhookEventName }

interface WebhookDocument {
  id: string
  filename: string
  slug?: string | null
  status?: string | null
  extractedData?: unknown
  createdAt?: Date | null
  updatedAt?: Date | null
}

interface WebhookPayload {
  event: DocumentWebhookEventName
  documentType: {
    id: string
    name: string
    slug: string
  }
  document: WebhookDocument
  timestamp: string
}

/**
 * Trigger a webhook for a document event
 * Automatically decrypts sensitive header values before sending
 */
export async function triggerWebhook(
  documentTypeId: string,
  document: WebhookDocument,
  event: DocumentWebhookEventName,
): Promise<void> {
  // Get document type with decrypted webhook config
  const docType = await getDocumentType(documentTypeId, { includeDecryptedWebhook: true })
  if (!docType?.webhookConfig) return

  const webhookConfig = docType.webhookConfig as DocumentWebhookConfig
  const eventConfig = webhookConfig.events?.[event]

  if (!eventConfig || !eventConfig.enabled || !eventConfig.url) return

  const payload: WebhookPayload = {
    event,
    documentType: {
      id: docType.id,
      name: docType.name,
      slug: docType.slug,
    },
    document: {
      id: document.id,
      filename: document.filename,
      slug: document.slug,
      status: document.status,
      extractedData: document.extractedData,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    },
    timestamp: new Date().toISOString(),
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Docproc/1.0',
  }

  // Add custom headers (values are already decrypted)
  if (eventConfig.headers) {
    for (const header of eventConfig.headers) {
      if (header.name && header.value) {
        headers[header.name] = header.value
      }
    }
  }

  try {
    const response = await fetch(eventConfig.url, {
      method: eventConfig.method || 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      console.error(
        `Webhook failed for ${event}: ${response.status} ${response.statusText}`,
        { documentId: document.id, url: eventConfig.url },
      )
    }
  } catch (error) {
    console.error(`Webhook error for ${event}:`, error, {
      documentId: document.id,
      url: eventConfig.url,
    })
  }
}

/**
 * Trigger webhook in the background (fire and forget)
 * Use this when you don't need to wait for the webhook to complete
 */
export function triggerWebhookAsync(
  documentTypeId: string,
  document: WebhookDocument,
  event: DocumentWebhookEventName,
): void {
  triggerWebhook(documentTypeId, document, event).catch((error) => {
    console.error('Async webhook error:', error)
  })
}
