import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

// Document Types
export function useDocumentTypes() {
  return useQuery({
    queryKey: ['documentTypes'],
    queryFn: async () => {
      const res = await api.api['document-types'].$get()
      if (!res.ok) throw new Error('Failed to fetch document types')
      return res.json()
    },
  })
}

export function useDocumentType(slugOrId: string) {
  return useQuery({
    queryKey: ['documentType', slugOrId],
    queryFn: async () => {
      const res = await api.api['document-types'][':slugOrId'].$get({
        param: { slugOrId },
      })
      if (!res.ok) throw new Error('Failed to fetch document type')
      return res.json()
    },
    enabled: !!slugOrId,
  })
}

export function useCreateDocumentType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name: string
      schema: Record<string, unknown>
      validationInstructions?: string | null
      modelName?: string | null
    }) => {
      const res = await api.api['document-types'].$post({ json: data })
      if (!res.ok) throw new Error('Failed to create document type')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentTypes'] })
    },
  })
}

export function useUpdateDocumentType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      slugOrId,
      data,
    }: {
      slugOrId: string
      data: {
        name?: string
        schema?: Record<string, unknown>
        validationInstructions?: string | null
        modelName?: string | null
      }
    }) => {
      const res = await api.api['document-types'][':slugOrId'].$put({
        param: { slugOrId },
        json: data,
      })
      if (!res.ok) throw new Error('Failed to update document type')
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documentType', variables.slugOrId] })
      queryClient.invalidateQueries({ queryKey: ['documentTypes'] })
    },
  })
}

export function useDeleteDocumentType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (slugOrId: string) => {
      const res = await api.api['document-types'][':slugOrId'].$delete({
        param: { slugOrId },
      })
      if (!res.ok) throw new Error('Failed to delete document type')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentTypes'] })
    },
  })
}

// Documents
export function useDocuments(documentTypeId: string, options?: { page?: number; status?: string }) {
  return useQuery({
    queryKey: ['documents', documentTypeId, options],
    queryFn: async () => {
      const res = await api.api.documents.$get({
        query: {
          documentTypeId,
          page: String(options?.page || 1),
          status: options?.status || 'all',
        },
      })
      if (!res.ok) throw new Error('Failed to fetch documents')
      return res.json()
    },
    enabled: !!documentTypeId,
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const res = await api.api.documents[':id'].$get({
        param: { id },
      })
      if (!res.ok) throw new Error('Failed to fetch document')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: {
        extractedData?: Record<string, unknown> | null
        status?: 'pending' | 'processed' | 'approved' | 'rejected'
        rejectionReason?: string | null
      }
    }) => {
      const res = await api.api.documents[':id'].$put({
        param: { id },
        json: data,
      })
      if (!res.ok) throw new Error('Failed to update document')
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['document', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.documents[':id'].$delete({
        param: { id },
      })
      if (!res.ok) throw new Error('Failed to delete document')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

// Processing
export function useProcessDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ documentId, model }: { documentId: string; model?: string }) => {
      const res = await api.api.process[':documentId'].$post({
        param: { documentId },
        json: model ? { model } : {},
      })
      if (!res.ok) throw new Error('Failed to process document')
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['document', variables.documentId] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

// Streaming Processing using AI SDK useObject hook
// The hook is exported for use in components

// Batch Processing
export function useCreateBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      documentTypeId,
      documentIds,
    }: {
      documentTypeId: string
      documentIds: string[]
    }) => {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentTypeId, documentIds }),
      })
      if (!res.ok) throw new Error('Failed to create batch')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export function useBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ['batch', batchId],
    queryFn: async () => {
      const res = await fetch(`/api/batches/${batchId}`)
      if (!res.ok) throw new Error('Failed to fetch batch')
      return res.json()
    },
    enabled: !!batchId,
    refetchInterval: (query) => {
      // Auto-refetch while batch is processing
      const data = query.state.data as { status?: string } | undefined
      if (data?.status === 'processing' || data?.status === 'pending') {
        return 2000
      }
      return false
    },
  })
}
