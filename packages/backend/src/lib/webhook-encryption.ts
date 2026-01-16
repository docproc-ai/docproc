/**
 * Webhook encryption utilities
 * Uses AES-256-GCM for authenticated encryption of sensitive webhook headers
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const PLACEHOLDER_VALUE = '[ENCRYPTED]'

// Type definitions
export type DocumentWebhookEventName =
  | 'document.uploaded'
  | 'document.processed'
  | 'document.approved'
  | 'document.unapproved'

export interface DocumentWebhookHeader {
  name: string
  value: string
  sensitive: boolean
  isEditing?: boolean
}

export interface DocumentWebhookEventConfig {
  enabled: boolean
  url: string
  method: string
  headers: DocumentWebhookHeader[]
}

export interface DocumentWebhookConfig {
  events: Partial<Record<DocumentWebhookEventName, DocumentWebhookEventConfig>>
}

/**
 * Get the encryption key from environment
 * Returns null if not configured (encryption disabled)
 */
function getEncryptionKey(): Buffer | null {
  const key = process.env.WEBHOOK_ENCRYPTION_KEY
  if (!key) {
    return null
  }
  if (key.length !== 64) {
    console.warn('WEBHOOK_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Encryption disabled.')
    return null
  }
  return Buffer.from(key, 'hex')
}

/**
 * Check if encryption is enabled
 */
export function isEncryptionEnabled(): boolean {
  return getEncryptionKey() !== null
}

/**
 * Encrypt a single value
 * Returns original value if encryption is disabled
 */
export function encryptValue(value: string): string {
  if (!value) return value

  const key = getEncryptionKey()
  if (!key) {
    // Encryption disabled - return value as-is
    return value
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(value, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  // Combine iv + tag + encrypted data
  return iv.toString('hex') + tag.toString('hex') + encrypted
}

/**
 * Decrypt a single value
 * Returns original value if encryption is disabled or value doesn't look encrypted
 */
export function decryptValue(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue

  const key = getEncryptionKey()
  if (!key) {
    // Encryption disabled - return value as-is
    return encryptedValue
  }

  // Check if value looks like it was encrypted (should be hex and at least iv+tag length)
  const minLength = (IV_LENGTH + TAG_LENGTH) * 2
  if (encryptedValue.length < minLength || !/^[0-9a-f]+$/i.test(encryptedValue)) {
    // Doesn't look encrypted - return as-is (migration case)
    return encryptedValue
  }

  try {
    // Extract iv, tag, and encrypted data
    const iv = Buffer.from(encryptedValue.slice(0, IV_LENGTH * 2), 'hex')
    const tag = Buffer.from(encryptedValue.slice(IV_LENGTH * 2, (IV_LENGTH + TAG_LENGTH) * 2), 'hex')
    const encrypted = encryptedValue.slice((IV_LENGTH + TAG_LENGTH) * 2)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Failed to decrypt webhook value:', error)
    // Return empty string on decryption failure to avoid exposing encrypted data
    return ''
  }
}

/**
 * Encrypt all sensitive header values in a webhook config
 */
export function encryptWebhookConfig(config: DocumentWebhookConfig): DocumentWebhookConfig {
  if (!config || !config.events) return config

  const encryptedConfig: DocumentWebhookConfig = { events: {} }

  for (const [eventName, eventConfig] of Object.entries(config.events)) {
    if (!eventConfig) continue

    encryptedConfig.events[eventName as DocumentWebhookEventName] = {
      ...eventConfig,
      headers: eventConfig.headers.map((header) => ({
        name: header.name,
        value: header.sensitive ? encryptValue(header.value) : header.value,
        sensitive: header.sensitive,
        // Remove isEditing flag when storing
      })),
    }
  }

  return encryptedConfig
}

/**
 * Decrypt all sensitive header values in a webhook config
 */
export function decryptWebhookConfig(config: DocumentWebhookConfig): DocumentWebhookConfig {
  if (!config || !config.events) return config

  const decryptedConfig: DocumentWebhookConfig = { events: {} }

  for (const [eventName, eventConfig] of Object.entries(config.events)) {
    if (!eventConfig) continue

    decryptedConfig.events[eventName as DocumentWebhookEventName] = {
      ...eventConfig,
      headers: eventConfig.headers.map((header) => ({
        name: header.name,
        value: header.sensitive ? decryptValue(header.value) : header.value,
        sensitive: header.sensitive,
      })),
    }
  }

  return decryptedConfig
}

/**
 * Create a safe version of webhook config for API responses
 * Replaces sensitive header values with [ENCRYPTED] placeholder
 */
export function createSafeWebhookConfig(config: DocumentWebhookConfig): DocumentWebhookConfig {
  if (!config || !config.events) return config

  const safeConfig: DocumentWebhookConfig = { events: {} }

  for (const [eventName, eventConfig] of Object.entries(config.events)) {
    if (!eventConfig) continue

    safeConfig.events[eventName as DocumentWebhookEventName] = {
      ...eventConfig,
      headers: eventConfig.headers.map((header) => ({
        name: header.name,
        value: header.sensitive ? PLACEHOLDER_VALUE : header.value,
        sensitive: header.sensitive,
      })),
    }
  }

  return safeConfig
}

/**
 * Merge an updated config from the frontend with existing encrypted config
 * Preserves encrypted values for sensitive headers that weren't edited
 */
export function mergeWebhookConfigs(
  existingEncrypted: DocumentWebhookConfig | null,
  updatedFromFrontend: DocumentWebhookConfig,
): DocumentWebhookConfig {
  if (!updatedFromFrontend || !updatedFromFrontend.events) {
    return existingEncrypted || { events: {} }
  }

  if (!existingEncrypted || !existingEncrypted.events) {
    // No existing config - just encrypt the new one
    return encryptWebhookConfig(updatedFromFrontend)
  }

  const mergedConfig: DocumentWebhookConfig = { events: {} }

  for (const [eventName, eventConfig] of Object.entries(updatedFromFrontend.events)) {
    if (!eventConfig) continue

    const existingEventConfig = existingEncrypted.events[eventName as DocumentWebhookEventName]

    mergedConfig.events[eventName as DocumentWebhookEventName] = {
      ...eventConfig,
      headers: eventConfig.headers.map((header, index) => {
        // If this is a sensitive field with placeholder and not being edited,
        // preserve the existing encrypted value
        if (header.sensitive && header.value === PLACEHOLDER_VALUE && !header.isEditing) {
          const existingHeader = existingEventConfig?.headers[index]
          if (existingHeader?.sensitive && existingHeader.value) {
            return {
              name: header.name,
              value: existingHeader.value, // Keep existing encrypted value
              sensitive: header.sensitive,
            }
          }
        }

        // Otherwise encrypt the new value
        return {
          name: header.name,
          value: header.sensitive ? encryptValue(header.value) : header.value,
          sensitive: header.sensitive,
        }
      }),
    }
  }

  return mergedConfig
}
