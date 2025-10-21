import { Queue, Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'

let connection: Redis | null = null
let documentQueue: Queue | null = null
let documentWorker: Worker | null = null

/**
 * Get or create the Redis connection
 * Shared connection for both Queue and Worker
 */
function getConnection(): Redis {
  if (!connection) {
    const redisUrl = process.env.VALKEY_URL || process.env.REDIS_URL

    if (!redisUrl) {
      throw new Error('VALKEY_URL or REDIS_URL environment variable is not set')
    }

    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    })

    connection.on('error', (error) => {
      console.error('Redis connection error:', error)
    })

    connection.on('connect', () => {
      console.log('✅ Connected to Redis/Valkey')
    })
  }

  return connection
}

/**
 * Get or create the document processing queue
 */
export function getDocumentQueue(): Queue {
  if (!documentQueue) {
    documentQueue = new Queue('document-processing', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3, // Retry failed jobs up to 3 times
        backoff: {
          type: 'exponential',
          delay: 5000, // Start with 5s, doubles each retry
        },
        removeOnComplete: {
          age: 60 * 60 * 24, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: {
          age: 60 * 60 * 24 * 7, // Keep failed jobs for 7 days
        },
      },
    })

    console.log('✅ Document processing queue created')
  }

  return documentQueue
}

/**
 * Get or create the document processing worker
 * Worker will be started automatically when first accessed
 */
export async function getDocumentWorker(): Promise<Worker> {
  if (!documentWorker) {
    // Import the worker processor function
    const { processDocument } = await import('./workers/document-processor')

    documentWorker = new Worker('document-processing', processDocument, {
      connection: getConnection(),
      concurrency: 5, // Process 5 documents concurrently
      limiter: {
        max: 5, // Max 5 jobs
        duration: 1000, // Per second
      },
    })

    documentWorker.on('failed', (job: Job | undefined, error: Error) => {
      console.error(`❌ Job ${job?.id} failed:`, error.message)
    })

    documentWorker.on('error', (error: Error) => {
      console.error('Worker error:', error)
    })

    console.log('✅ Document processing worker started (concurrency: 5)')
  }

  return documentWorker
}

/**
 * Gracefully close all BullMQ connections
 */
export async function closeQueue(): Promise<void> {
  const promises: Promise<void>[] = []

  if (documentWorker) {
    console.log('Closing document worker...')
    promises.push(documentWorker.close())
    documentWorker = null
  }

  if (documentQueue) {
    console.log('Closing document queue...')
    promises.push(documentQueue.close())
    documentQueue = null
  }

  if (connection) {
    console.log('Closing Redis connection...')
    promises.push(connection.quit())
    connection = null
  }

  await Promise.all(promises)
  console.log('✅ All BullMQ connections closed')
}

/**
 * Setup graceful shutdown handlers
 */
export function setupQueueShutdown(): void {
  const shutdown = async () => {
    await closeQueue()
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  process.on('beforeExit', shutdown)
}
