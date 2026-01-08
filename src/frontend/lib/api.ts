import { hc } from 'hono/client'
// Type-only import - no server code in frontend bundle
import type { AppType } from '../../server'

// Create typed API client
// In dev: requests go to Vite proxy → localhost:3001
// In prod: requests go to same origin (Hono serves everything)
export const api = hc<AppType>('/')

// Usage examples:
// const res = await api.health.$get()
// const data = await res.json() // { status: 'ok' } - fully typed!
//
// const res = await api.api.$get()
// const data = await res.json() // { message: 'DocProc API', version: '1.0.0' }
