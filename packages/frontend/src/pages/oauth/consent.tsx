import { Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ErrorMessage, CenteredCard as Shell } from '@/components/centered-card'
import { Button } from '@/components/ui/button'
import { authClient, useSession } from '@/lib/auth'
import { describeAccess, describeDestination } from './consent-text'

interface PublicClient {
  client_name?: string
  name?: string
}

type ClientState =
  | { status: 'loading' }
  | { status: 'ready'; name: string }
  | { status: 'error' }

export default function ConsentPage() {
  const { data: session, isPending } = useSession()
  const params = new URLSearchParams(window.location.search)
  const clientId = params.get('client_id')
  const redirectUri = params.get('redirect_uri') ?? ''

  const [mcpEnabled, setMcpEnabled] = useState<boolean | null>(null)
  const [client, setClient] = useState<ClientState>({ status: 'loading' })
  const [submitting, setSubmitting] = useState<'allow' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const signedIn = Boolean(session?.user)

  // No session: continue via the login page, which resumes the flow.
  useEffect(() => {
    if (!isPending && !signedIn && mcpEnabled === true) {
      window.location.href = `/login${window.location.search}`
    }
  }, [isPending, signedIn, mcpEnabled])

  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((config) => setMcpEnabled(config?.mcpEnabled !== false))
      .catch(() => setMcpEnabled(true))
  }, [])

  useEffect(() => {
    if (!clientId) {
      setClient({ status: 'error' })
      return
    }
    authClient
      .$fetch<PublicClient>('/oauth2/public-client', {
        method: 'GET',
        query: { client_id: clientId },
      })
      .then(({ data }) => {
        const name = data?.client_name ?? data?.name
        setClient(name ? { status: 'ready', name } : { status: 'error' })
      })
      .catch(() => setClient({ status: 'error' }))
  }, [clientId])

  const respond = async (accept: boolean) => {
    setError(null)
    setSubmitting(accept ? 'allow' : 'deny')
    try {
      // The oauth-provider client plugin attaches the signed oauth_query.
      const { data, error: fetchError } = await authClient.$fetch<{
        url?: string
      }>('/oauth2/consent', { method: 'POST', body: { accept } })
      if (fetchError || !data?.url) {
        setError(fetchError?.message || 'Something went wrong. Try again.')
        setSubmitting(null)
        return
      }
      window.location.href = data.url
    } catch {
      setError('An unexpected error occurred')
      setSubmitting(null)
    }
  }

  if (mcpEnabled === false) {
    return (
      <Shell>
        <ErrorMessage>
          Connecting apps isn't enabled on this DocProc server.
        </ErrorMessage>
      </Shell>
    )
  }

  if (isPending || !signedIn || mcpEnabled === null) {
    return (
      <Shell>
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin size-6 text-muted-foreground" />
        </div>
      </Shell>
    )
  }

  const role = (session?.user as { role?: string } | undefined)?.role
  const hasAccess = role === 'user' || role === 'admin'

  return (
    <Shell>
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
        <ShieldCheck className="size-6 text-primary" />
      </div>
      <h1 className="text-xl font-semibold mb-2">
        Allow access to your DocProc account from{' '}
        {describeDestination(redirectUri)}?
      </h1>
      {client.status === 'ready' && (
        <p className="text-sm text-muted-foreground mb-4">
          The app calls itself "{client.name}".
        </p>
      )}

      {hasAccess ? (
        <>
          <p className="text-sm mb-2">This app will be able to:</p>
          <ul className="list-disc pl-5 text-sm space-y-1 mb-6">
            {describeAccess(role as 'user' | 'admin').map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {error && (
            <div className="mb-4">
              <ErrorMessage>{error}</ErrorMessage>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              className="flex-1 h-11"
              onClick={() => respond(true)}
              disabled={submitting !== null}
            >
              {submitting === 'allow' && (
                <Loader2 className="animate-spin size-4" />
              )}
              Allow
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={() => respond(false)}
              disabled={submitting !== null}
            >
              {submitting === 'deny' && (
                <Loader2 className="animate-spin size-4" />
              )}
              Deny
            </Button>
          </div>
        </>
      ) : (
        <>
          <ErrorMessage>
            Your account doesn't have access to DocProc yet — ask an admin.
          </ErrorMessage>
          {error && (
            <div className="mt-4">
              <ErrorMessage>{error}</ErrorMessage>
            </div>
          )}
          {/* Deny tells the waiting app now instead of letting it time out. */}
          <Button
            variant="outline"
            className="w-full h-11 mt-6"
            onClick={() => respond(false)}
            disabled={submitting !== null}
          >
            {submitting === 'deny' && (
              <Loader2 className="animate-spin size-4" />
            )}
            Deny
          </Button>
        </>
      )}
    </Shell>
  )
}
