import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import type React from 'react'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  return <>{children}</>
}
