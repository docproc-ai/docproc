import { createAccessControl } from 'better-auth/plugins/access'
import { adminAc, defaultStatements } from 'better-auth/plugins/admin/access'

export const ac = createAccessControl({
  ...defaultStatements,
  documentType: ['create', 'list', 'update', 'delete'],
  document: ['create', 'list', 'update', 'delete'],
})

const none = ac.newRole({
  documentType: [],
  document: [],
})

const user = ac.newRole({
  documentType: ['list'],
  document: ['create', 'list', 'update', 'delete'],
})

const admin = ac.newRole({
  documentType: ['create', 'list', 'update', 'delete'],
  document: ['create', 'list', 'update', 'delete'],
  ...adminAc.statements,
})

export const roles = {
  user,
  admin,
  none,
}
