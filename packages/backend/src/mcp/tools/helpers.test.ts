import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../caller', () => ({ checkPermission: vi.fn() }))
vi.mock('../../lib/db/document-operations', () => ({
  getDocumentBySlugOrId: vi.fn(),
}))
vi.mock('../../lib/db/document-type-operations', () => ({
  getDocumentTypeBySlugOrId: vi.fn(),
}))

import { ServiceError } from '../../services/errors'
import { checkPermission, type McpCaller } from '../caller'
import { guard, toolError, toolJson } from './helpers'

const check = vi.mocked(checkPermission)
const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
afterAll(() => errSpy.mockRestore())

const user: McpCaller = {
  id: 'u1',
  email: 'u@example.com',
  name: 'U',
  role: 'user',
}

describe('toolError / toolJson', () => {
  it('toolError is an isError text result', () => {
    expect(toolError('nope')).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'nope' }],
    })
  })

  it('toolJson pretty-prints and adds structuredContent for objects', () => {
    expect(toolJson({ a: 1 })).toEqual({
      content: [{ type: 'text', text: '{\n  "a": 1\n}' }],
      structuredContent: { a: 1 },
    })
  })

  it('toolJson omits structuredContent for arrays and primitives', () => {
    expect(toolJson([1])).toEqual({
      content: [{ type: 'text', text: '[\n  1\n]' }],
    })
    expect(toolJson('x')).toEqual({ content: [{ type: 'text', text: '"x"' }] })
    expect(toolJson(null)).toEqual({
      content: [{ type: 'text', text: 'null' }],
    })
  })
})

describe('guard', () => {
  beforeEach(() => {
    check.mockReset()
    errSpy.mockClear()
  })

  it('refuses with actionable text and does not run fn', async () => {
    check.mockResolvedValue(false)
    const fn = vi.fn()
    expect(await guard(user, 'documentType', 'create', fn)).toEqual(
      toolError(
        'Your DocProc role is `user`; this needs documentType:create. Ask an admin for access.',
      ),
    )
    expect(check).toHaveBeenCalledWith(user, 'documentType', 'create')
    expect(fn).not.toHaveBeenCalled()
  })

  it('runs fn when permitted', async () => {
    check.mockResolvedValue(true)
    expect(
      await guard(user, 'document', 'list', async () => toolJson(1)),
    ).toEqual(toolJson(1))
  })

  it('maps ServiceError not_found to its message', async () => {
    check.mockResolvedValue(true)
    const res = await guard(user, 'document', 'list', async () => {
      throw new ServiceError('not_found', 'Document not found')
    })
    expect(res).toEqual(toolError('Document not found'))
  })

  it('maps other ServiceErrors (user errors) to their message', async () => {
    check.mockResolvedValue(true)
    const res = await guard(user, 'document', 'update', async () => {
      throw new ServiceError('conflict', 'Document already processed')
    })
    expect(res).toEqual(toolError('Document already processed'))
  })

  it('hides unexpected errors and logs them', async () => {
    check.mockResolvedValue(true)
    const res = await guard(user, 'document', 'list', async () => {
      throw new Error('connection refused at 10.0.0.5')
    })
    expect(res).toEqual(
      toolError('Something went wrong; the error was logged.'),
    )
    expect(errSpy).toHaveBeenCalled()
  })
})
