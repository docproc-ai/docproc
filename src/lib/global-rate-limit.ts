// lib/global-rate-limit.ts
interface GlobalRateLimit {
  count: number
  resetTime: number
}

const globalStore = new Map<string, GlobalRateLimit>()

export function withGlobalRateLimit<T extends any[], R>(
  fn: (...args: T) => R | Promise<R>,
  functionName: string,
  limit: number,
  windowMs: number,
) {
  return async (...args: T): Promise<R> => {
    const now = Date.now()
    const entry = globalStore.get(functionName)

    if (!entry || now > entry.resetTime) {
      // First call or expired window
      globalStore.set(functionName, { count: 1, resetTime: now + windowMs })
      return await fn(...args)
    }

    if (entry.count >= limit) {
      throw new Error(`Global rate limit exceeded for ${functionName}`)
    }

    entry.count++
    return await fn(...args)
  }
}
