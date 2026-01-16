import { useState } from 'react'
import { useUsers, useUpdateUserRole, useDeleteUser } from '@/lib/queries'
import { useSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type Role = 'admin' | 'user' | 'none'

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  user: 'User',
  none: 'No Access',
}

const roleBadgeStyles: Record<Role, string> = {
  admin: 'bg-primary/10 text-primary',
  user: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  none: 'bg-muted text-muted-foreground',
}

function UserRow({
  user,
  currentUserId,
}: {
  user: {
    id: string
    name: string
    email: string
    image: string | null
    role: string
    createdAt: string
  }
  currentUserId: string | undefined
}) {
  const updateRole = useUpdateUserRole()
  const deleteUser = useDeleteUser()
  const isCurrentUser = user.id === currentUserId
  const role = user.role as Role

  const handleRoleChange = (newRole: string) => {
    updateRole.mutate({ userId: user.id, role: newRole as Role })
  }

  const handleDelete = () => {
    deleteUser.mutate(user.id)
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {isCurrentUser ? (
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${roleBadgeStyles[role]}`}>
            {roleLabels[role]}
          </span>
        ) : (
          <Select
            value={role}
            onValueChange={handleRoleChange}
            disabled={updateRole.isPending}
          >
            <SelectTrigger className="w-32" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="none">No Access</SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </TableCell>
      <TableCell>
        {!isCurrentUser && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete User</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {user.name}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </TableCell>
    </TableRow>
  )
}

function LoadingSkeleton() {
  return (
    <div className="bg-card border rounded-xl shadow-sm shadow-black/5 overflow-hidden">
      <div className="space-y-0 divide-y">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-4 p-4">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
            <div className="w-24 h-8 bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="bg-card border rounded-xl shadow-sm shadow-black/5 p-8">
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-24 h-24 mb-6 relative">
          <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="48" cy="36" r="16" className="fill-muted stroke-border" strokeWidth="2" />
            <path
              d="M24 72C24 58.7452 34.7452 48 48 48C61.2548 48 72 58.7452 72 72V80H24V72Z"
              className="fill-muted stroke-border"
              strokeWidth="2"
            />
          </svg>
        </div>
        <h3 className="font-sans text-xl font-semibold mb-2">
          {search ? 'No users found' : 'No users yet'}
        </h3>
        <p className="text-muted-foreground text-center max-w-sm">
          {search
            ? `No users match "${search}". Try a different search term.`
            : 'Users will appear here once they sign up.'}
        </p>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data: session } = useSession()
  const { data, isLoading, error } = useUsers({ page, search: search || undefined })

  const users = data?.users ?? []
  const pagination = data?.pagination

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-sans font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage user accounts and permissions
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search users by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-sm"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : error ? (
        <div className="bg-card border border-destructive/30 rounded-xl shadow-sm shadow-black/5 p-6">
          <h3 className="font-medium mb-1 text-destructive">Failed to load users</h3>
          <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
        </div>
      ) : users.length === 0 ? (
        <EmptyState search={search} />
      ) : (
        <>
          <div className="bg-card border rounded-xl shadow-sm shadow-black/5 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    currentUserId={session?.user?.id}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
