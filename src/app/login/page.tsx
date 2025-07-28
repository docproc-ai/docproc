'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    )
  }

  if (session?.user) {
    return null // Will redirect
  }

  return <LoginForm />
}
