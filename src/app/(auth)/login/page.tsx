'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { PageLoadingSkeleton } from '@/components/ui/loading-skeletons'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending && session?.user) {
      router.push('/document-types')
    }
  }, [session, isPending, router])

  if (isPending) {
    return <PageLoadingSkeleton />
  }

  if (session?.user) {
    return null // Will redirect
  }

  return <LoginForm />
}
