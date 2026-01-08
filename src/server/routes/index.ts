import { Hono } from 'hono'

// Route modules will be imported here
// import auth from './auth'
// import documents from './documents'
// import documentTypes from './document-types'
// import batches from './batches'

const api = new Hono()

// Mount routes
// api.route('/auth', auth)
// api.route('/documents', documents)
// api.route('/document-types', documentTypes)
// api.route('/batches', batches)

export default api
