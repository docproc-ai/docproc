export async function register() {
  console.log('Registering instrumentation for NEXT_RUNTIME:', process.env.NEXT_RUNTIME)

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { init } = await import('@/lib/instrumentation/node')
    await init()
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    const { init } = await import('@/lib/instrumentation/edge')
    await init()
  } else if (process.env.NEXT_RUNTIME === 'client') {
    const { init } = await import('@/lib/instrumentation/client')
    await init()
  }
}
