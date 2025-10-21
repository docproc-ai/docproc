import PgBoss from 'pg-boss'

let bossInstance: PgBoss | null = null
let isStarting = false

/**
 * Get or create the pg-boss singleton instance
 * pg-boss uses the same database connection as the app
 */
export async function getBoss(): Promise<PgBoss> {
  // If instance exists and has been started, return it
  if (bossInstance) {
    return bossInstance
  }

  // Prevent multiple simultaneous start attempts
  if (isStarting) {
    // Wait for the instance to be ready
    while (isStarting) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (bossInstance) {
      return bossInstance
    }
  }

  isStarting = true

  try {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }

    bossInstance = new PgBoss({
      connectionString,
      // Use a specific schema for pg-boss tables to keep them separate
      schema: 'pgboss',
      // Automatically create tables on first start
      migrate: true,
      // Archive completed jobs after 7 days
      archiveCompletedAfterSeconds: 60 * 60 * 24 * 7,
      // Delete archived jobs after 30 days
      deleteAfterDays: 30,
      // Monitor jobs and handle failures
      monitorStateIntervalSeconds: 60,
      // Maintenance runs every hour
      maintenanceIntervalSeconds: 3600,
    })

    bossInstance.on('error', (error) => {
      console.error('pg-boss error:', error)
    })

    bossInstance.on('monitor-states', (stats) => {
      if (stats.active > 0 || stats.created > 0) {
        console.log('pg-boss stats:', stats)
      }
    })

    await bossInstance.start()
    console.log('✅ pg-boss started successfully')

    // Register workers immediately after pg-boss starts
    console.log('🔧 Registering workers...')
    const { registerBatchProcessor } = await import('./workers/batch-processor')
    const { registerSingleDocumentProcessor } = await import('./workers/single-document-processor')
    await registerBatchProcessor(bossInstance)
    await registerSingleDocumentProcessor(bossInstance)
    console.log('✅ All workers registered')

    return bossInstance
  } finally {
    isStarting = false
  }
}

/**
 * Stop pg-boss gracefully
 * Should be called when the application is shutting down
 */
export async function stopBoss(): Promise<void> {
  if (bossInstance) {
    console.log('Stopping pg-boss...')
    await bossInstance.stop({ graceful: true, timeout: 30000 })
    bossInstance = null
    console.log('pg-boss stopped')
  }
}

/**
 * Setup graceful shutdown handlers for pg-boss
 */
export function setupBossShutdown(): void {
  const shutdown = async () => {
    await stopBoss()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  process.on('beforeExit', shutdown)
}
