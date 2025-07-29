import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { getDocumentTypes } from '@/lib/actions/document-type'
import { authClient } from '@/lib/auth-client'
import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import DocumentTypeList from './document-type-list'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export default async function DocumentTypesPage() {
  // const { data: session } = authClient.useSession()

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  const canCreateDocumentTypes = authClient.admin.checkRolePermission({
    permissions: { documentType: ['create'] },
    role: (session?.user?.role as any) || 'none',
  })

  const canManageUsers = authClient.admin.checkRolePermission({
    permissions: { user: ['list'] },
    role: (session?.user?.role as any) || 'none',
  })

  return (
    <div className="bg-background text-foreground flex h-screen flex-col">
      <header className="border-border flex flex-shrink-0 items-center justify-between border-b px-6 py-3">
        <h1 className="text-xl font-semibold">Document Types</h1>
        <div className="flex items-center gap-2">
          {canCreateDocumentTypes && (
            <Button variant="outline" asChild>
              <Link href="/document-types/new">New Document Type</Link>
            </Button>
          )}
          {canManageUsers && (
            <Button variant="outline" asChild>
              <Link href="/users">
                <Users className="h-4 w-4" />
                Manage Users
              </Link>
            </Button>
          )}
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>
      <main className="flex-grow overflow-auto p-6">
        <div className="space-y-6">
          <DocumentTypeList />
        </div>
      </main>
    </div>
  )
}
