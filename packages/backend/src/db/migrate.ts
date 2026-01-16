import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './index'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// Get the project root (3 levels up from this file: db -> src -> shared -> packages -> root)
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '../../../../')

export async function runMigrations() {
  console.log('Running database migrations...')
  await migrate(db, {
    migrationsFolder: resolve(projectRoot, 'drizzle'),
  })
  console.log('Database migrations completed successfully')
}
