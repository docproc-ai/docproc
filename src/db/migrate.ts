import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './index'

export async function runMigrations() {
  console.log('Running database migrations...')
  await migrate(db, {
    migrationsFolder: 'drizzle',
  })
  console.log('Database migrations completed successfully')
}
