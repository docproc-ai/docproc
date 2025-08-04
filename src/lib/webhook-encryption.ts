import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16
const PLACEHOLDER_VALUE = '[ENCRYPTED]'

function getEncryptionKey(): string {
  const key = process.env.WEBHOOK_ENCRYPTION_KEY
  if (!key) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY environment variable is required')
  }
  if (key.length !== 64) {
    throw new Error('WEBHOOK_ENCRYPTION_KEY must be 64 characters (32 bytes hex)')
  }
  return key
}

export function encryptValue(value: string): string {
  if (!value) return value
  
  const key = Buffer.from(getEncryptionKey(), 'hex')
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(value, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const tag = cipher.getAuthTag()
  
  // Combine iv + tag + encrypted data
  return iv.toString('hex') + tag.toString('hex') + encrypted
}

export function decryptValue(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue
  
  try {
    const key = Buffer.from(getEncryptionKey(), 'hex')
    
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
    throw new Error('Failed to decrypt webhook value')
  }
}

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

export function encryptWebhookConfig(config: DocumentWebhookConfig): DocumentWebhookConfig {
  if (!config || !config.events) return config
  
  const encryptedConfig = { ...config }
  
  for (const [eventName, eventConfig] of Object.entries(config.events)) {
    if (!eventConfig) continue
    
    encryptedConfig.events[eventName as keyof DocumentWebhookConfig['events']] = {
      ...eventConfig,
      headers: eventConfig.headers.map(header => ({
        ...header,
        value: header.sensitive ? encryptValue(header.value) : header.value,
        isEditing: undefined // Remove editing state when storing
      }))
    }
  }
  
  return encryptedConfig
}

export function decryptWebhookConfig(config: DocumentWebhookConfig): DocumentWebhookConfig {
  if (!config || !config.events) return config
  
  const decryptedConfig = { ...config }
  
  for (const [eventName, eventConfig] of Object.entries(config.events)) {
    if (!eventConfig) continue
    
    decryptedConfig.events[eventName as keyof DocumentWebhookConfig['events']] = {
      ...eventConfig,
      headers: eventConfig.headers.map(header => ({
        ...header,
        value: header.sensitive ? decryptValue(header.value) : header.value
      }))
    }
  }
  
  return decryptedConfig
}

export function createSafeWebhookConfig(config: DocumentWebhookConfig): DocumentWebhookConfig {
  if (!config || !config.events) return config
  
  const safeConfig = { ...config }
  
  for (const [eventName, eventConfig] of Object.entries(config.events)) {
    if (!eventConfig) continue
    
    safeConfig.events[eventName as keyof DocumentWebhookConfig['events']] = {
      ...eventConfig,
      headers: eventConfig.headers.map(header => ({
        ...header,
        value: header.sensitive ? PLACEHOLDER_VALUE : header.value,
        isEditing: false
      }))
    }
  }
  
  return safeConfig
}

export function mergeWebhookConfigs(existingEncrypted: DocumentWebhookConfig, updatedSafe: DocumentWebhookConfig): DocumentWebhookConfig {
  if (!updatedSafe || !updatedSafe.events) return existingEncrypted
  if (!existingEncrypted || !existingEncrypted.events) return encryptWebhookConfig(updatedSafe)
  
  // Decrypt existing config to get current values
  const existingDecrypted = decryptWebhookConfig(existingEncrypted)
  const mergedConfig = { ...updatedSafe }
  
  for (const [eventName, eventConfig] of Object.entries(updatedSafe.events)) {
    if (!eventConfig) continue
    
    const existingEventConfig = existingDecrypted.events[eventName as keyof DocumentWebhookConfig['events']]
    
    mergedConfig.events[eventName as keyof DocumentWebhookConfig['events']] = {
      ...eventConfig,
      headers: eventConfig.headers.map((header, index) => {
        // If this is a sensitive field that wasn't explicitly edited, keep the existing value
        if (header.sensitive && header.value === PLACEHOLDER_VALUE && !header.isEditing) {
          const existingHeader = existingEventConfig?.headers[index]
          return {
            ...header,
            value: existingHeader?.value || '',
            isEditing: undefined
          }
        }
        
        return {
          ...header,
          isEditing: undefined
        }
      })
    }
  }
  
  return encryptWebhookConfig(mergedConfig)
}
