import { File, FileJson, FileCheck, FileX } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentSelect as Document } from '@/db/schema/app'

interface StatusIconProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5'
}

// Individual status icon components with customizable styling
export const PendingStatusIcon = ({ className, size = 'md' }: StatusIconProps) => (
  <File className={cn('text-muted-foreground', sizeClasses[size], className)} />
)

export const ProcessedStatusIcon = ({ className, size = 'md' }: StatusIconProps) => (
  <FileJson className={cn('text-blue-500', sizeClasses[size], className)} />
)

export const ApprovedStatusIcon = ({ className, size = 'md' }: StatusIconProps) => (
  <FileCheck className={cn('text-green-500', sizeClasses[size], className)} />
)

export const RejectedStatusIcon = ({ className, size = 'md' }: StatusIconProps) => (
  <FileX className={cn('text-red-500', sizeClasses[size], className)} />
)

// Main component that selects the appropriate icon based on status
interface DocumentStatusIconProps extends StatusIconProps {
  status: Document['status']
}

export const DocumentStatusIcon = ({ status, className, size = 'md' }: DocumentStatusIconProps) => {
  switch (status) {
    case 'approved':
      return <ApprovedStatusIcon className={className} size={size} />
    case 'processed':
      return <ProcessedStatusIcon className={className} size={size} />
    case 'rejected':
      return <RejectedStatusIcon className={className} size={size} />
    case 'pending':
    default:
      return <PendingStatusIcon className={className} size={size} />
  }
}
