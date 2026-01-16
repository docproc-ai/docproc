import { File, FileJson, FileCheck, FileX, Loader2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusConfig {
  icon: LucideIcon
  className: string
  title: string
}

const statusConfig: Record<string, StatusConfig> = {
  pending: { icon: File, className: 'text-muted-foreground', title: 'Pending' },
  processing: { icon: Loader2, className: 'text-blue-500 animate-spin', title: 'Processing' },
  processed: { icon: FileJson, className: 'text-blue-500', title: 'Processed' },
  approved: { icon: FileCheck, className: 'text-green-500', title: 'Approved' },
  rejected: { icon: FileX, className: 'text-red-500', title: 'Rejected' },
}

export function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  const config = statusConfig[status] || statusConfig.pending
  const Icon = config.icon

  return (
    <span className="shrink-0" title={config.title}>
      <Icon size={size} className={config.className} />
    </span>
  )
}
