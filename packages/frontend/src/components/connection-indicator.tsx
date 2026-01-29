// WebSocket connection status indicator
export function ConnectionIndicator({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; title: string }> = {
    connected: { color: 'bg-green-500', title: 'Live updates connected' },
    connecting: { color: 'bg-amber-500 animate-pulse', title: 'Connecting...' },
    disconnected: { color: 'bg-gray-400', title: 'Disconnected' },
    error: { color: 'bg-red-500', title: 'Connection error' },
  }
  const config = statusConfig[status] || statusConfig.disconnected

  return (
    <span
      className={`w-2 h-2 rounded-full ${config.color}`}
      title={config.title}
    />
  )
}
