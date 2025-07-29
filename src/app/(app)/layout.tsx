import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type React from 'react'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Ensure the user is authenticated
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !session.user) redirect('/login')

  return <>{children}</>
}
