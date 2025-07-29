'use client'

import { useEffect } from 'react'
import { redirect } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { PageLoadingSkeleton } from '@/components/ui/loading-skeletons'

export default function HomePage() {
  const { data: session, isPending } = authClient.useSession()

  useEffect(() => {
    if (!isPending) {
      if (session?.user) {
        redirect('/document-types')
      } else {
        redirect('/login')
      }
    }
  }, [session, isPending])

  return <PageLoadingSkeleton />
}
