import { useParams } from '@tanstack/react-router'
import { CheckCircle2, FileUp, Loader2, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CenteredCard, ErrorMessage } from '@/components/centered-card'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/auth'

interface LinkInfo {
  documentType: { name: string; slug: string }
  expiresAt: string
}

type LinkState =
  | { status: 'loading' }
  | { status: 'ready'; info: LinkInfo }
  | { status: 'error'; message: string }
  | { status: 'done'; filename: string }

const GENERIC_ERROR = 'Something went wrong. Try again.'

function loginUrl(token: string): string {
  return `/login?next=${encodeURIComponent(`/upload/${token}`)}`
}

async function errorText(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: unknown
  } | null
  return typeof body?.error === 'string' ? body.error : GENERIC_ERROR
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** `/upload/$token`: the browser side of the MCP `create_upload_link` tool. */
export default function UploadPage() {
  const { token } = useParams({ from: '/upload/$token' })
  const { data: session, isPending } = useSession()
  const signedIn = Boolean(session?.user)

  const [mcpEnabled, setMcpEnabled] = useState<boolean | null>(null)
  const [link, setLink] = useState<LinkState>({ status: 'loading' })
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((config) => setMcpEnabled(config?.mcpEnabled !== false))
      .catch(() => setMcpEnabled(true))
  }, [])

  // No session: sign in first, then come straight back here.
  useEffect(() => {
    if (!isPending && !signedIn && mcpEnabled === true) {
      window.location.href = loginUrl(token)
    }
  }, [isPending, signedIn, mcpEnabled, token])

  useEffect(() => {
    if (!signedIn || mcpEnabled !== true) return
    let cancelled = false
    fetch(`/api/mcp/uploads/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 401) {
          window.location.href = loginUrl(token)
          return
        }
        if (!res.ok) {
          setLink({ status: 'error', message: await errorText(res) })
          return
        }
        setLink({ status: 'ready', info: (await res.json()) as LinkInfo })
      })
      .catch(() => {
        if (!cancelled) setLink({ status: 'error', message: GENERIC_ERROR })
      })
    return () => {
      cancelled = true
    }
  }, [signedIn, mcpEnabled, token])

  const pick = (files: FileList | null) => {
    setUploadError(null)
    setFile(files?.[0] ?? null)
  }

  const upload = async () => {
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`/api/mcp/uploads/${encodeURIComponent(token)}`, {
        method: 'POST',
        body,
      })
      if (res.ok) {
        const data = (await res.json()) as { filename?: string }
        setLink({ status: 'done', filename: data.filename ?? file.name })
      } else if (res.status === 401) {
        window.location.href = loginUrl(token)
      } else if (res.status === 400 || res.status >= 500) {
        // The link was not used up; the user can pick another file.
        setUploadError(await errorText(res))
      } else {
        setLink({ status: 'error', message: await errorText(res) })
      }
    } catch {
      setUploadError(GENERIC_ERROR)
    } finally {
      setUploading(false)
    }
  }

  if (mcpEnabled === false) {
    return (
      <CenteredCard>
        <ErrorMessage>
          Connecting apps isn't enabled on this DocProc server.
        </ErrorMessage>
      </CenteredCard>
    )
  }

  if (
    isPending ||
    !signedIn ||
    mcpEnabled === null ||
    link.status === 'loading'
  ) {
    return (
      <CenteredCard>
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin size-6 text-muted-foreground" />
        </div>
      </CenteredCard>
    )
  }

  if (link.status === 'error') {
    return (
      <CenteredCard>
        <ErrorMessage>{link.message}</ErrorMessage>
      </CenteredCard>
    )
  }

  if (link.status === 'done') {
    return (
      <CenteredCard>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
          <CheckCircle2 className="size-6 text-primary" />
        </div>
        <h1 className="text-xl font-semibold mb-2">Upload complete</h1>
        <p className="text-sm text-muted-foreground" role="status">
          Uploaded {link.filename}. You can go back to Claude.
        </p>
      </CenteredCard>
    )
  }

  const { info } = link
  const expires = new Date(info.expiresAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <CenteredCard>
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
        <FileUp className="size-6 text-primary" />
      </div>
      <h1 className="text-xl font-semibold mb-2">
        Upload a file to {info.documentType.name}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Claude asked for this file. The link works once and expires at {expires}
        .
      </p>

      <label
        htmlFor="upload-file"
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 text-center text-sm cursor-pointer transition-colors mb-4 ${
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:bg-muted/50'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          pick(e.dataTransfer.files)
        }}
      >
        <Upload className="size-5 text-muted-foreground" />
        {file ? (
          <span>
            <span className="font-medium">{file.name}</span>{' '}
            <span className="text-muted-foreground">
              ({formatSize(file.size)})
            </span>
          </span>
        ) : (
          <span>
            <span className="font-medium">Choose a file</span> or drop it here
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          PDF or image, one file
        </span>
        <input
          id="upload-file"
          type="file"
          accept="application/pdf,image/*"
          className="sr-only"
          onChange={(e) => pick(e.target.files)}
          disabled={uploading}
        />
      </label>

      {uploadError && (
        <div className="mb-4">
          <ErrorMessage>{uploadError}</ErrorMessage>
        </div>
      )}

      <Button
        className="w-full h-11"
        onClick={upload}
        disabled={!file || uploading}
      >
        {uploading && <Loader2 className="animate-spin size-4" />}
        Upload
      </Button>
    </CenteredCard>
  )
}
