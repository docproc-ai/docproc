import { initDefaultUser } from '@/lib/init-default-user'
import { runMigrations } from '@/db/migrate'

export async function init() {
  await runMigrations()
  // Initialize the default admin user if it doesn't exist
  await initDefaultUser()

  // Additional server initialization logic can go here
  console.log('Server initialized successfully')
}
