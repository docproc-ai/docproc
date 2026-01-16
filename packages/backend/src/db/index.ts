import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Lazy initialization - only connect when db is first accessed
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null
let _client: ReturnType<typeof postgres> | null = null

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }
    _client = postgres(process.env.DATABASE_URL)
    _db = drizzle(_client, { schema })
  }
  return _db
}

// For backwards compatibility - getter that lazily initializes
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>]
  },
})

export { schema }
