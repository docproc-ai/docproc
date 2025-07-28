import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db } from '@/db'

export async function runMigrations() {
  await migrate(db, {
    migrationsFolder: 'drizzle',
  })
  console.log('Database migrations completed successfully')
}
