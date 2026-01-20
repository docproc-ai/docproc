import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './index'
import { resolve } from 'node:path'

// Use MIGRATIONS_DIR env var, or default to ./drizzle relative to cwd
// This works both in development and with compiled binaries
const migrationsFolder =
  process.env.MIGRATIONS_DIR || resolve(process.cwd(), 'drizzle')

export async function runMigrations() {
  console.log(`Running database migrations from ${migrationsFolder}...`)
  await migrate(db, { migrationsFolder })
  console.log('Database migrations completed successfully')
}
