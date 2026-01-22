import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { db } from '../db'
import { user } from '../db/schema/auth'
import { eq, desc, ilike, or, sql } from 'drizzle-orm'
import { requireAuth, requirePermission } from '../middleware/auth'
import { auth } from '../lib/auth'

// Shared schemas
const idParam = z.object({
  id: z.string().uuid().openapi({ description: 'User ID' }),
})

const errorResponse = z.object({ error: z.string() })
const successResponse = z.object({ success: z.boolean() })

const userResponse = z.object({
  id: z.string().uuid(),
  name: z.string().nullish(),
  email: z.string().email(),
  image: z.string().nullish(),
  role: z.string().nullish(),
  createdAt: z.any(),
})

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

// Route definitions
const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Users'],
  summary: 'List all users with pagination',
  middleware: [requireAuth, requirePermission('user', 'list')] as const,
  request: {
    query: getUsersQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of users',
      content: {
        'application/json': {
          schema: z.object({
            users: z.array(userResponse),
            pagination: z.object({
              page: z.number(),
              pageSize: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const createRoute_ = createRoute({
  method: 'post',
  path: '/',
  tags: ['Users'],
  summary: 'Create a new user',
  middleware: [requireAuth, requirePermission('user', 'create')] as const,
  request: {
    body: { content: { 'application/json': { schema: createUserSchema } } },
  },
  responses: {
    201: { description: 'Created user', content: { 'application/json': { schema: userResponse } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const getRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Get a user by ID',
  middleware: [requireAuth, requirePermission('user', 'list')] as const,
  request: { params: idParam },
  responses: {
    200: { description: 'User details', content: { 'application/json': { schema: userResponse } } },
    404: { description: 'Not found', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const updateRoleRoute = createRoute({
  method: 'patch',
  path: '/{id}/role',
  tags: ['Users'],
  summary: 'Update user role',
  middleware: [requireAuth, requirePermission('user', 'update')] as const,
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: updateUserRoleSchema } } },
  },
  responses: {
    200: { description: 'Updated user', content: { 'application/json': { schema: userResponse } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Not found', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const updateRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Update user details',
  middleware: [requireAuth, requirePermission('user', 'update')] as const,
  request: {
    params: idParam,
    body: { content: { 'application/json': { schema: updateUserSchema } } },
  },
  responses: {
    200: { description: 'Updated user', content: { 'application/json': { schema: userResponse } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Not found', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

const deleteRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Delete a user',
  middleware: [requireAuth, requirePermission('user', 'delete')] as const,
  request: { params: idParam },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: successResponse } } },
    400: { description: 'Bad request', content: { 'application/json': { schema: errorResponse } } },
    404: { description: 'Not found', content: { 'application/json': { schema: errorResponse } } },
    500: { description: 'Server error', content: { 'application/json': { schema: errorResponse } } },
  },
})

// Create router and register routes
export const usersRoutes = new OpenAPIHono()

  .openapi(listRoute, async (c) => {
    try {
      const { search, page, pageSize } = c.req.valid('query')
      const offset = (page - 1) * pageSize

      const searchCondition = search
        ? or(
            ilike(user.name, `%${search}%`),
            ilike(user.email, `%${search}%`),
          )
        : undefined

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(searchCondition)

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

      return c.json(
        {
          users,
          pagination: {
            page,
            pageSize,
            total: count,
            totalPages: Math.ceil(count / pageSize),
          },
        },
        200,
      )
    } catch (error) {
      console.error('Failed to get users:', error)
      return c.json({ error: 'Failed to get users' }, 500)
    }
  })

  .openapi(createRoute_, async (c) => {
    try {
      const { name, email, password, role } = c.req.valid('json')

      const [existingUser] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1)

      if (existingUser) {
        return c.json({ error: 'A user with this email already exists' }, 400)
      }

      const result = await auth.api.signUpEmail({
        body: { email, password, name },
      })

      if (!result) {
        return c.json({ error: 'Failed to create user' }, 500)
      }

      if (role && role !== 'user') {
        await db
          .update(user)
          .set({ role, updatedAt: new Date() })
          .where(eq(user.email, email))
      }

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
  })

  .openapi(getRoute, async (c) => {
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
  })

  .openapi(updateRoleRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const { role: newRole } = c.req.valid('json')
      const currentUser = c.get('user')

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
  })

  .openapi(updateRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const updates = c.req.valid('json')
      const currentUser = c.get('user')

      if (currentUser?.id === id && updates.role) {
        return c.json({ error: 'Cannot change your own role' }, 400)
      }

      if (updates.email) {
        const [existingUser] = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.email, updates.email))
          .limit(1)

        if (existingUser && existingUser.id !== id) {
          return c.json(
            { error: 'A user with this email already exists' },
            400,
          )
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
  })

  .openapi(deleteRoute, async (c) => {
    try {
      const { id } = c.req.valid('param')
      const currentUser = c.get('user')

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
  })
