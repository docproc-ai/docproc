/**
 * Webhook utilities
 * Context-free - can be called from anywhere
 */

import { db } from '@/db'
import { documentType } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  decryptWebhookConfig,
  type DocumentWebhookConfig,
} from '@/lib/webhook-encryption'

export type DocumentWebhookEventName =
  | 'document.uploaded'
  | 'document.processed'
  | 'document.approved'
  | 'document.unapproved'

export async function triggerWebhook(
  docType: any,
  document: any,
  event: DocumentWebhookEventName,
) {
  if (!docType.webhookConfig) return

  const webhookConfig = decryptWebhookConfig(docType.webhookConfig as DocumentWebhookConfig)
  const eventConfig = webhookConfig.events?.[event]

  if (!eventConfig || !eventConfig.enabled || !eventConfig.url) return

  const payload = {
    event,
    documentType: {
      id: docType.id,
      name: docType.name,
    },
    document,
    timestamp: new Date().toISOString(),
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Docproc/1.0',
  }

  // Add custom headers
  if (eventConfig.headers) {
    for (const header of eventConfig.headers) {
      headers[header.name] = header.value
    }
  }

  const response = await fetch(eventConfig.url, {
    method: eventConfig.method || 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}: ${response.statusText}`)
  }
}
