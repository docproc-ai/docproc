import { drizzle } from 'drizzle-orm/node-postgres'

if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is not set in the environment variables')

export const db = drizzle(process.env.DATABASE_URL)
