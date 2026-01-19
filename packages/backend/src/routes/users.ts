import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { user } from '../db/schema/auth'
import { eq, desc, ilike, or, sql } from 'drizzle-orm'
import { requireAuth, requirePermission } from '../middleware/auth'
import { auth } from '../lib/auth'

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'user', 'none']).optional().default('user'),
})

const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'user', 'none']),
})

const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email address').optional(),
  role: z.enum(['admin', 'user', 'none']).optional(),
})

const getUsersQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
})

export const usersRoutes = new Hono()
  .basePath('/api/users')

  // GET /api/users - List all users
  .get(
    '/',
    requireAuth,
    requirePermission('user', 'list'),
    zValidator('query', getUsersQuerySchema),
    async (c) => {
      try {
        const { search, page, pageSize } = c.req.valid('query')
        const offset = (page - 1) * pageSize

        // Build search condition
        const searchCondition = search
          ? or(
              ilike(user.name, `%${search}%`),
              ilike(user.email, `%${search}%`),
            )
          : undefined

        // Get total count
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(user)
          .where(searchCondition)

        // Get paginated users
        const users = await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            createdAt: user.createdAt,
          })
          .from(user)
          .where(searchCondition)
          .orderBy(desc(user.createdAt))
          .limit(pageSize)
          .offset(offset)

        return c.json({
          users,
          pagination: {
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize),
          },
        }, 200)
      } catch (error) {
        console.error('Failed to get users:', error)
        return c.json({ error: 'Failed to get users' }, 500)
      }
    },
  )

  // POST /api/users - Create a new user
  .post(
    '/',
    requireAuth,
    requirePermission('user', 'create'),
    zValidator('json', createUserSchema),
    async (c) => {
      try {
        const { name, email, password, role } = c.req.valid('json')

        // Check if user already exists
        const [existingUser] = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, email))
          .limit(1)

        if (existingUser) {
          return c.json({ error: 'A user with this email already exists' }, 400)
        }

        // Create user via better-auth signUpEmail
        const result = await auth.api.signUpEmail({
          body: { email, password, name },
        })

        if (!result) {
          return c.json({ error: 'Failed to create user' }, 500)
        }

        // Update role if not default 'user'
        if (role && role !== 'user') {
          await db
            .update(user)
            .set({ role, updatedAt: new Date() })
            .where(eq(user.email, email))
        }

        // Fetch the created user to return
        const [createdUser] = await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            createdAt: user.createdAt,
          })
          .from(user)
          .where(eq(user.email, email))
          .limit(1)

        return c.json(createdUser, 201)
      } catch (error) {
        console.error('Failed to create user:', error)
        return c.json({ error: 'Failed to create user' }, 500)
      }
    },
  )

  // GET /api/users/:id - Get a single user
  .get(
    '/:id',
    requireAuth,
    requirePermission('user', 'list'),
    zValidator('param', z.object({ id: z.string().uuid() })),
    async (c) => {
      try {
        const { id } = c.req.valid('param')

        const [foundUser] = await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            createdAt: user.createdAt,
          })
          .from(user)
          .where(eq(user.id, id))
          .limit(1)

        if (!foundUser) {
          return c.json({ error: 'User not found' }, 404)
        }

        return c.json(foundUser, 200)
      } catch (error) {
        console.error('Failed to get user:', error)
        return c.json({ error: 'Failed to get user' }, 500)
      }
    },
  )

  // PATCH /api/users/:id/role - Update user role
  .patch(
    '/:id/role',
    requireAuth,
    requirePermission('user', 'update'),
    zValidator('param', z.object({ id: z.string().uuid() })),
    zValidator('json', updateUserRoleSchema),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        const { role: newRole } = c.req.valid('json')
        const currentUser = c.get('user')

        // Prevent users from changing their own role
        if (currentUser?.id === id) {
          return c.json({ error: 'Cannot change your own role' }, 400)
        }

        const [updated] = await db
          .update(user)
          .set({ role: newRole, updatedAt: new Date() })
          .where(eq(user.id, id))
          .returning({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            createdAt: user.createdAt,
          })

        if (!updated) {
          return c.json({ error: 'User not found' }, 404)
        }

        return c.json(updated, 200)
      } catch (error) {
        console.error('Failed to update user role:', error)
        return c.json({ error: 'Failed to update user role' }, 500)
      }
    },
  )

  // PATCH /api/users/:id - Update user details
  .patch(
    '/:id',
    requireAuth,
    requirePermission('user', 'update'),
    zValidator('param', z.object({ id: z.string().uuid() })),
    zValidator('json', updateUserSchema),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        const updates = c.req.valid('json')
        const currentUser = c.get('user')

        // Prevent users from changing their own role
        if (currentUser?.id === id && updates.role) {
          return c.json({ error: 'Cannot change your own role' }, 400)
        }

        // Check for email uniqueness if changing email
        if (updates.email) {
          const [existingUser] = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, updates.email))
            .limit(1)

          if (existingUser && existingUser.id !== id) {
            return c.json({ error: 'A user with this email already exists' }, 400)
          }
        }

        const [updated] = await db
          .update(user)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(user.id, id))
          .returning({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            createdAt: user.createdAt,
          })

        if (!updated) {
          return c.json({ error: 'User not found' }, 404)
        }

        return c.json(updated, 200)
      } catch (error) {
        console.error('Failed to update user:', error)
        return c.json({ error: 'Failed to update user' }, 500)
      }
    },
  )

  // DELETE /api/users/:id - Delete a user
  .delete(
    '/:id',
    requireAuth,
    requirePermission('user', 'delete'),
    zValidator('param', z.object({ id: z.string().uuid() })),
    async (c) => {
      try {
        const { id } = c.req.valid('param')
        const currentUser = c.get('user')

        // Prevent users from deleting themselves
        if (currentUser?.id === id) {
          return c.json({ error: 'Cannot delete your own account' }, 400)
        }

        const [deleted] = await db
          .delete(user)
          .where(eq(user.id, id))
          .returning({ id: user.id })

        if (!deleted) {
          return c.json({ error: 'User not found' }, 404)
        }

        return c.json({ success: true }, 200)
      } catch (error) {
        console.error('Failed to delete user:', error)
        return c.json({ error: 'Failed to delete user' }, 500)
      }
    },
  )
