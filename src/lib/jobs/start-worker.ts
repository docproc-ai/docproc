import { getDocumentWorker, setupQueueShutdown } from './queue'

/**
 * Start all BullMQ workers
 * This should be called when the application starts
 */
export async function startWorkers(): Promise<void> {
  try {
    console.log('🚀 Starting BullMQ workers...')

    // Start the document processing worker
    await getDocumentWorker()

    // Setup graceful shutdown
    setupQueueShutdown()

    console.log('✅ All workers started successfully')
  } catch (error) {
    console.error('❌ Failed to start workers:', error)
    throw error
  }
}

/**
 * Initialize workers if this file is run directly
 */
if (require.main === module) {
  startWorkers()
    .then(() => {
      console.log('Workers running. Press Ctrl+C to stop.')
    })
    .catch((error) => {
      console.error('Failed to start workers:', error)
      process.exit(1)
    })
}
