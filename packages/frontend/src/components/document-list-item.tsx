import { Loader2, X, File, FileJson, FileCheck, FileX, type LucideIcon } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

const statusConfig: Record<string, { icon: LucideIcon; className: string }> = {
  pending: { icon: File, className: 'text-muted-foreground' },
  processing: { icon: Loader2, className: 'text-blue-500 animate-spin' },
  processed: { icon: FileJson, className: 'text-blue-500' },
  approved: { icon: FileCheck, className: 'text-green-500' },
  rejected: { icon: FileX, className: 'text-red-500' },
}

export interface DocumentListItemProps {
  doc: {
    id: string
    filename: string
    slug: string | null
    status: string | null
    createdAt: string | null
  }
  isSelected: boolean
  isChecked: boolean
  isProcessing: boolean
  onSelect: () => void
  onCheck: (checked: boolean) => void
  onCancelJob?: () => void
  registerRef: (id: string, el: HTMLDivElement | null) => void
}

export function DocumentListItem({
  doc,
  isSelected,
  isChecked,
  isProcessing,
  onSelect,
  onCheck,
  onCancelJob,
  registerRef,
}: DocumentListItemProps) {
  const config = statusConfig[doc.status || 'pending'] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <div
      ref={(el) => registerRef(doc.id, el)}
      className={`flex items-center w-full border-b transition-colors ${
        isSelected
          ? 'bg-primary/10 border-l-2 border-l-primary'
          : 'hover:bg-muted/50'
      }`}
    >
      <div className="pl-3 py-3 self-center">
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checked) => onCheck(checked === true)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {/* Status icon with cancel on hover when processing */}
      <div className="pl-2 self-center">
        {isProcessing ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCancelJob?.()
            }}
            className="group"
            title="Click to cancel"
          >
            <Loader2 className="h-4 w-4 text-blue-500 animate-spin group-hover:hidden" />
            <X className="h-4 w-4 text-red-500 hidden group-hover:block" />
          </button>
        ) : (
          <StatusIcon className={`h-4 w-4 ${config.className}`} />
        )}
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left py-3 pr-3 pl-2 min-w-0"
      >
        <p className="text-sm font-medium truncate">{doc.slug || doc.filename}</p>
        {doc.createdAt && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(doc.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}
      </button>
    </div>
  )
}
