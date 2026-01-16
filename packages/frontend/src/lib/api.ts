import { hc } from 'hono/client'
import type { AppType } from '@docproc/backend'

// Create typed API client
export const api = hc<AppType>('/')

// Usage with TanStack Query:
//
// const { data } = useQuery({
//   queryKey: ['documents'],
//   queryFn: async () => {
//     const res = await api.api.documents.$get()
//     if (!res.ok) throw new Error('Failed to fetch')
//     return res.json() // Typed as { documents: [] }
//   }
// })
//
// const mutation = useMutation({
//   mutationFn: async (data: { documentTypeId: string }) => {
//     const res = await api.api.documents.$post({ json: data })
//     if (!res.ok) throw new Error('Failed to create')
//     return res.json() // Typed as { id: string, documentTypeId: string }
//   }
// })
//
// Path params:
// const res = await api.api.documents[':id'].$get({ param: { id: '123' } })
