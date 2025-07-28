'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Loader2 } from 'lucide-react'
import { PageLoadingSkeleton } from '@/components/ui/loading-skeletons'

export default function HomePage() {
  const { data: session, isPending } = authClient.useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending) {
      if (session?.user) {
        router.push('/document-types')
      } else {
        router.push('/login')
      }
    }
  }, [session, isPending, router])

  return <PageLoadingSkeleton />
}
