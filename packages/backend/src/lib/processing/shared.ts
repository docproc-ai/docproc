/**
 * Shared types and utilities for document processing
 */

export interface ValidationResult {
  isValid: boolean
  reason?: string
}

export interface ProcessingOptions {
  skipValidation?: boolean
  overrideModel?: string
}

export interface ProcessingResult {
  data: Record<string, unknown>
  validation?: ValidationResult
}

/**
 * Get system prompt with current date context
 */
export function getSystemPrompt(): string {
  const currentDate = new Date()
  const isoDate = currentDate.toISOString().split('T')[0]
  const readableDate = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `
You are an expert document processor. Your task is to analyze the provided document (which could be a PDF or an image) and extract information into a structured JSON object based on the user-provided schema.

**CURRENT DATE**: ${isoDate} (${readableDate})

**CRITICAL INSTRUCTIONS:**
1.  **Analyze the ENTIRE document provided.**
2.  **Date Formatting**: For any date field, you MUST format it as \`YYYY-MM-DD\`.
3.  **Do NOT Guess**: If you cannot find information for a field, OMIT it from your response. Do not hallucinate data. Even if a field is required in the schema, if the information is not present in the document, it should not be included.
4.  **Follow Schema**: Adhere strictly to the JSON schema for the output format. Pay close attention to field names, types, and nested structures. The exception is that you can omit fields that are not present in the document or that you are unsure of.
5.  **Date Context**: Use the current date above as reference when interpreting relative dates or incomplete dates in documents (e.g., "last month", "Q1", etc.).
6.  **JSON OUTPUT ONLY**: Your response must be ONLY valid JSON. Do not include any explanatory text, markdown formatting, or code blocks. Start with { and end with }.
`.trim()
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    webp: 'image/webp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
  }

  return mimeTypes[extension] || 'application/octet-stream'
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  return filename.toLowerCase().split('.').pop() || ''
}

/**
 * Close incomplete JSON by adding missing brackets/braces
 * Handles streaming JSON that may be cut off mid-generation
 */
export function closeBrackets(json: string): string {
  // Track open brackets/braces
  const stack: string[] = []
  let inString = false
  let escape = false

  for (const char of json) {
    if (escape) {
      escape = false
      continue
    }

    if (char === '\\' && inString) {
      escape = true
      continue
    }

    if (char === '"' && !escape) {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') stack.push('}')
    else if (char === '[') stack.push(']')
    else if (char === '}' || char === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === char) {
        stack.pop()
      }
    }
  }

  // If we're in a string, close it
  let result = json
  if (inString) {
    result += '"'
  }

  // Close any incomplete values (trailing commas, colons)
  result = result.replace(/,\s*$/, '')
  result = result.replace(/:\s*$/, ': null')

  // Close all open brackets
  while (stack.length > 0) {
    result += stack.pop()
  }

  return result
}

/**
 * Try to parse JSON, using bracket closer if needed
 */
export function safeParseJson(text: string): Record<string, unknown> | null {
  // First try direct parse
  try {
    return JSON.parse(text)
  } catch {
    // Try with bracket closing
    try {
      const closed = closeBrackets(text)
      return JSON.parse(closed)
    } catch {
      return null
    }
  }
}

/**
 * Recursively add additionalProperties: false to all object types in a schema
 * Required for Anthropic's structured output
 */
export function addAdditionalPropertiesFalse(schema: Record<string, unknown>): Record<string, unknown> {
  const result = { ...schema }

  if (result.type === 'object') {
    result.additionalProperties = false

    // Process nested properties
    if (result.properties && typeof result.properties === 'object') {
      const props = result.properties as Record<string, Record<string, unknown>>
      result.properties = Object.fromEntries(
        Object.entries(props).map(([key, value]) => [
          key,
          addAdditionalPropertiesFalse(value),
        ])
      )
    }
  }

  // Process array items
  if (result.type === 'array' && result.items && typeof result.items === 'object') {
    result.items = addAdditionalPropertiesFalse(result.items as Record<string, unknown>)
  }

  return result
}

/**
 * Default model to use when none is specified
 */
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'

/**
 * Get the model to use for processing
 * Priority: overrideModel > documentType.modelName > DEFAULT_MODEL
 */
export function getModelForProcessing(
  documentTypeModel: string | null | undefined,
  overrideModel?: string,
): string {
  return overrideModel || documentTypeModel || DEFAULT_MODEL
}
