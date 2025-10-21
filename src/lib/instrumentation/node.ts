import { initDefaultUser } from '@/lib/init-default-user'
import { runMigrations } from '@/db/migrate'
import { startWorkers } from '@/lib/jobs/start-worker'

export async function init() {
  console.log('🔧 Running migrations...')
  await runMigrations()

  // Initialize the default admin user if it doesn't exist
  if (
    process.env.AUTH_EMAIL_PASSWORD_ENABLED !== 'false' &&
    process.env.AUTH_ADMIN_EMAIL &&
    process.env.AUTH_ADMIN_PASSWORD
  ) {
    console.log('🔧 Initializing default user...')
    await initDefaultUser()
  }

  // Start background workers for job processing
  console.log('🔧 Starting workers...')
  try {
    await startWorkers()
  } catch (error) {
    console.error('❌ Failed to start workers, but continuing server startup:', error)
    console.error('Error details:', error)
  }

  // Additional server initialization logic can go here
  console.log('✅ Server initialized successfully')
}
