/**
 * Template-based slug generation for documents
 *
 * Patterns support:
 * - {fieldName} - value from extractedData
 * - {fieldName.nested} - nested field access
 * - {id()} - short unique ID (6 chars from UUID)
 * - {id} - document's actual ID
 *
 * Example: "{vendor}-{invoice_number}-{id()}"
 */

const FIELD_PATTERN = /\{([^}]+)\}/g

/**
 * Slugify a single value - make it URL-safe
 */
function slugifyValue(value: unknown): string {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '') // Trim hyphens
}

/**
 * Get a nested value from an object using dot notation
 * e.g., getNestedValue({ a: { b: 1 } }, 'a.b') => 1
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Generate a document slug from a pattern template and extracted data
 *
 * @param pattern - Template pattern like "{vendor}-{invoice_number}-{id()}"
 * @param extractedData - The document's extracted data
 * @param documentId - The document's UUID (used for {id} placeholder)
 * @returns Generated slug, or null if pattern fails (missing fields, etc.)
 */
export function generateSlugFromPattern(
  pattern: string,
  extractedData: Record<string, unknown>,
  documentId: string,
): string | null {
  try {
    const result = pattern.replace(FIELD_PATTERN, (match, field: string) => {
      // Handle special functions
      if (field === 'id()') {
        // Generate short unique ID (same pattern as existing generateSlug)
        return crypto.randomUUID().slice(0, 6)
      }
      if (field === 'id') {
        return documentId
      }

      // Handle field references (including nested)
      const value = getNestedValue(extractedData, field)
      if (value === undefined || value === null) {
        throw new Error(`Missing field: ${field}`)
      }

      return slugifyValue(value)
    })

    // Ensure we have a valid result
    if (!result || result.trim() === '') {
      return null
    }

    return result
  } catch {
    // Pattern failed - return null to signal fallback to ID
    return null
  }
}

/**
 * Validate a slug pattern for syntax errors
 * Returns validation result with any errors
 */
export function validateSlugPattern(pattern: string): {
  valid: boolean
  error?: string
  fields: string[]
} {
  const fields: string[] = []
  const matches = pattern.matchAll(FIELD_PATTERN)

  for (const match of matches) {
    const field = match[1]
    // Special functions are always valid
    if (field === 'id()' || field === 'id') {
      fields.push(field)
      continue
    }

    // Check for invalid field names (empty, starts with number, etc.)
    if (!field || /^\d/.test(field)) {
      return {
        valid: false,
        error: `Invalid field name: "${field}"`,
        fields,
      }
    }

    fields.push(field)
  }

  // Check pattern has at least one placeholder
  if (fields.length === 0) {
    return {
      valid: false,
      error:
        'Pattern must contain at least one field placeholder like {fieldName}',
      fields,
    }
  }

  return { valid: true, fields }
}
