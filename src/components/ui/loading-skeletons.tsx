import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Page-level loading skeleton for full page loads
export function PageLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-screen items-center justify-center", className)}>
      <div className="text-center space-y-4">
        <Skeleton className="h-8 w-8 rounded-full mx-auto" />
        <Skeleton className="h-4 w-24 mx-auto" />
      </div>
    </div>
  )
}

// Card content loading skeleton
export function CardContentSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <div className="text-center space-y-3">
        <Skeleton className="h-6 w-6 rounded-full mx-auto" />
        <Skeleton className="h-3 w-20 mx-auto" />
      </div>
    </div>
  )
}

// Table loading skeleton
export function TableLoadingSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

// Button loading skeleton (inline)
export function ButtonLoadingSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-4 w-4 rounded-sm", className)} />
}

// List item loading skeleton
export function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center space-x-3 p-4", className)}>
      <Skeleton className="h-4 w-4 rounded-sm" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  )
}

// Grid card loading skeleton
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-lg p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <div className="flex justify-end space-x-2 pt-4">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Document type card skeleton (specific to this app)
export function DocumentTypeCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-lg">
          <div className="p-6 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="p-6 pt-0">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex justify-end gap-2 p-6 pt-0">
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Form loading skeleton
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex justify-end space-x-2 pt-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  )
}

// User table skeleton (specific to users page)
export function UserTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4 items-center">
          <Skeleton className="h-4 flex-1" /> {/* Name */}
          <Skeleton className="h-4 flex-1" /> {/* Email */}
          <Skeleton className="h-6 w-16" />   {/* Role select */}
          <Skeleton className="h-5 w-20" />   {/* Status badge */}
          <Skeleton className="h-4 w-24" />   {/* Created date */}
          <Skeleton className="h-8 w-8" />    {/* Actions */}
        </div>
      ))}
    </div>
  )
}
