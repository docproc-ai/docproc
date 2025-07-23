import { drizzle } from 'drizzle-orm/libsql'

export const db = drizzle({
  schema: './src/db/schema.ts',
  sqlite: {
    uri: process.env.DATABASE_URL,
  },
})
