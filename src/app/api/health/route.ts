import { NextResponse } from 'next/server'
import { db } from '@/db'

const DB_CHECK_TIMEOUT_MS = 2000 // 2 seconds

async function checkDb(): Promise<boolean> {
  // Run a true no-op query SELECT 1
  const dbPromise = (async () => {
    try {
      // Use raw SQL if the adapter supports it, otherwise fall back to a safe select
      if (typeof (db as any).execute === 'function') {
        await (db as any).execute('SELECT 1')
      } else {
        // Some adapters don't expose execute; use a minimal select instead
        await db.select().from(db.raw('SELECT 1').as('t')).limit(1)
      }
      return true
    } catch (err) {
      console.error('DB health check failed', err)
      return false
    }
  })()

  // Timeout wrapper
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), DB_CHECK_TIMEOUT_MS))

  return Promise.race([dbPromise, timeout])
}

export async function GET() {
  const dbOk = await checkDb()

  const status = dbOk ? 'ok' : 'unhealthy'

  const payload = {
    status,
    checks: { db: dbOk },
    uptime: typeof (globalThis as any).process !== 'undefined' && typeof (globalThis as any).process.uptime === 'function' ? (globalThis as any).process.uptime() : 0,
    time: new Date().toISOString(),
  }

  const res = NextResponse.json(payload, { status: dbOk ? 200 : 503 })
  // Mark uncacheable
  res.headers.set('Cache-Control', 'no-store')
  return res
}
