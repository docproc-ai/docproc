import { useState } from 'react'
import { Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import { useUsers, useDeleteUser, useCreateUser, useUpdateUser } from '@/lib/queries'
import { useSession } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

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

function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('user')
  const createUser = useCreateUser()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createUser.mutate(
      { name, email, password, role },
      {
        onSuccess: () => {
          setOpen(false)
          setName('')
          setEmail('')
          setPassword('')
          setRole('user')
        },
      },
    )
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset form and error state when closing
      createUser.reset()
      setName('')
      setEmail('')
      setPassword('')
      setRole('user')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4 mr-2" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. They will receive an account with the specified role.
            </DialogDescription>
          </DialogHeader>
          {createUser.isError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md p-3 mt-4">
              {createUser.error.message}
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="none">No Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({
  user,
  isCurrentUser,
}: {
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  isCurrentUser: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState<Role>(user.role as Role)
  const updateUser = useUpdateUser()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const updates: { name?: string; email?: string; role?: Role } = {}
    if (name !== user.name) updates.name = name
    if (email !== user.email) updates.email = email
    if (role !== user.role && !isCurrentUser) updates.role = role

    if (Object.keys(updates).length === 0) {
      setOpen(false)
      return
    }

    updateUser.mutate(
      { userId: user.id, data: updates },
      {
        onSuccess: () => {
          setOpen(false)
        },
      },
    )
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      // Reset to current values when opening
      setName(user.name)
      setEmail(user.email)
      setRole(user.role as Role)
    }
    if (!newOpen) {
      updateUser.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user details for {user.name}.
            </DialogDescription>
          </DialogHeader>
          {updateUser.isError && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md p-3 mt-4">
              {updateUser.error.message}
            </div>
          )}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {!isCurrentUser && (
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="none">No Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
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
  const deleteUser = useDeleteUser()
  const isCurrentUser = user.id === currentUserId
  const role = user.role as Role

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
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${roleBadgeStyles[role]}`}>
          {roleLabels[role]}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {new Date(user.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <EditUserDialog user={user} isCurrentUser={isCurrentUser} />
          {!isCurrentUser && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="size-4" />
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
        </div>
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
        <div className="w-24 h-24 mb-6 flex items-center justify-center">
          <Users className="size-16 text-muted-foreground" />
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
  const { data: session, isPending: sessionPending } = useSession()
  const { data, isLoading, error } = useUsers({ page, search: search || undefined })

  const users = data?.users ?? []
  const pagination = data?.pagination
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'admin'

  // Show loading while checking session
  if (sessionPending) {
    return <LoadingSkeleton />
  }

  // Admin-only access
  if (!isAdmin) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="bg-card border border-destructive/30 rounded-xl shadow-sm shadow-black/5 p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <h3 className="font-sans text-xl font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              You don't have permission to view this page. Only administrators can manage users.
            </p>
          </div>
        </div>
      </div>
    )
  }

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
        <CreateUserDialog />
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
