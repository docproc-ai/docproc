import { AlertCircle } from 'lucide-react'

/** The single centred card used by the OAuth consent and upload-link pages. */
export function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6">
      <div className="relative w-full max-w-md">
        <div className="bg-card border rounded-2xl p-8 shadow-lg shadow-black/5">
          {children}
        </div>
      </div>
    </div>
  )
}

export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
      <AlertCircle className="size-[18px] flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}
