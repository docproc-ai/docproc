import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createDocumentRequest } from '../../shared/schemas'

const documents = new Hono()
  .get('/', (c) => {
    // TODO: fetch from database
    return c.json({ documents: [] }, 200)
  })
  .post('/',
    zValidator('json', createDocumentRequest),
    (c) => {
      const { documentTypeId } = c.req.valid('json')
      // TODO: create document
      return c.json({ id: crypto.randomUUID(), documentTypeId }, 201)
    }
  )
  .get('/:id', (c) => {
    const id = c.req.param('id')
    // TODO: fetch from database
    return c.json({ id, status: 'pending' }, 200)
  })

export { documents }
