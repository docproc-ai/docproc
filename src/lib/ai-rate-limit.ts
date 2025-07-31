// Get rate limiting configuration from environment variables
const AI_RATE_LIMIT_ENABLED = process.env.AI_RATE_LIMIT_ENABLED !== 'false'
const AI_RATE_LIMIT_REQUESTS = parseInt(process.env.AI_RATE_LIMIT_REQUESTS || '100', 10)
const AI_RATE_LIMIT_WINDOW_MS = parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '3600000', 10) // 1 hour default

// In-memory store for rate limiting
interface AIRateLimit {
  count: number
  resetTime: number
}

const aiRateLimitStore = new Map<string, AIRateLimit>()

/**
 * Check AI rate limit and throw error if exceeded
 * This should be called as a guard after authentication in API routes that use AI models
 * @param operationName Unique identifier for this operation (for rate limiting)
 * @throws Error if rate limit is exceeded
 */
export async function checkAIRateLimit(operationName: string): Promise<void> {
  // If rate limiting is disabled, allow all requests
  if (!AI_RATE_LIMIT_ENABLED) {
    return
  }

  const now = Date.now()
  const key = `ai-${operationName}`
  const entry = aiRateLimitStore.get(key)

  if (!entry || now > entry.resetTime) {
    // First call or expired window - reset counter
    aiRateLimitStore.set(key, { count: 1, resetTime: now + AI_RATE_LIMIT_WINDOW_MS })
    return
  }

  if (entry.count >= AI_RATE_LIMIT_REQUESTS) {
    const resetInMs = entry.resetTime - now
    const resetInMinutes = Math.ceil(resetInMs / 60000)
    throw new Error(`AI rate limit exceeded. Try again in ${resetInMinutes} minute(s).`)
  }

  // Increment counter
  entry.count++
}

/**
 * Check if AI rate limiting is enabled
 */
export function isAIRateLimitEnabled(): boolean {
  return AI_RATE_LIMIT_ENABLED
}

/**
 * Get current AI rate limit configuration
 */
export function getAIRateLimitConfig() {
  return {
    enabled: AI_RATE_LIMIT_ENABLED,
    requests: AI_RATE_LIMIT_REQUESTS,
    windowMs: AI_RATE_LIMIT_WINDOW_MS,
  }
}
