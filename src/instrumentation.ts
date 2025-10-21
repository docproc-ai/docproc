export async function register() {
  console.log('🔍 [INSTRUMENTATION] register() called')
  console.log('🔍 [INSTRUMENTATION] NEXT_RUNTIME:', process.env.NEXT_RUNTIME)

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔧 [INSTRUMENTATION] Loading Node.js instrumentation...')
    try {
      const { init } = await import('@/lib/instrumentation/node')
      console.log('🔧 [INSTRUMENTATION] Calling init()...')
      await init()
      console.log('✅ [INSTRUMENTATION] Node.js instrumentation completed')
    } catch (error) {
      console.error('❌ [INSTRUMENTATION] Failed to initialize:', error)
      throw error
    }
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    const { init } = await import('@/lib/instrumentation/edge')
    await init()
  } else if (process.env.NEXT_RUNTIME === 'client') {
    const { init } = await import('@/lib/instrumentation/client')
    await init()
  } else {
    console.log('⚠️ [INSTRUMENTATION] Unknown or missing NEXT_RUNTIME')
  }
}
