import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createDocumentTypeRequest } from '../../shared/schemas'

const documentTypes = new Hono()
  .get('/', (c) => {
    // TODO: fetch from database
    return c.json({ documentTypes: [] }, 200)
  })
  .post('/',
    zValidator('json', createDocumentTypeRequest),
    (c) => {
      const data = c.req.valid('json')
      // TODO: create in database
      return c.json({ id: crypto.randomUUID(), ...data }, 201)
    }
  )
  .get('/:id', (c) => {
    const id = c.req.param('id')
    // TODO: fetch from database
    return c.json({ id, name: 'Example', schema: {} }, 200)
  })

export { documentTypes }
