import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { db } from '../db'
import { user } from '../db/schema/auth'
import { eq, desc, ilike, or, sql } from 'drizzle-orm'
import { requireAuth, requirePermission } from '../middleware/auth'

const updateUserRoleSchema = z.object({
  role: z.enum(['admin', 'user', 'none']),
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
