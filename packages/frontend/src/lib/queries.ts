import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

// Custom error class for permission errors
export class PermissionError extends Error {
  constructor(message = 'You do not have permission to perform this action') {
    super(message)
    this.name = 'PermissionError'
  }
}

// Helper to handle API errors - returns never to help TypeScript narrow types
async function handleApiError(res: Response, defaultMessage: string): Promise<never> {
  if (res.status === 403) {
    throw new PermissionError()
  }
  if (res.status === 401) {
    throw new Error('Please sign in to continue')
  }
  throw new Error(defaultMessage)
}

// Type guard to check if response is an error
function isErrorResponse(data: unknown): data is { error: string } {
  return typeof data === 'object' && data !== null && 'error' in data
}

// Helper to extract success data from API response
function extractData<T>(data: T | { error: string }, defaultMessage: string): T {
  if (isErrorResponse(data)) {
    throw new Error(data.error || defaultMessage)
  }
  return data
}

// Document Types
export function useDocumentTypes() {
  return useQuery({
    queryKey: ['documentTypes'],
    queryFn: async () => {
      const res = await api.api['document-types'].$get()
      if (!res.ok) await handleApiError(res, 'Failed to fetch document types')
      const data = await res.json()
      return extractData(data, 'Failed to fetch document types')
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
      if (!res.ok) await handleApiError(res, 'Failed to fetch document type')
      const data = await res.json()
      return extractData(data, 'Failed to fetch document type')
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
        slugPattern?: string | null
        webhookConfig?: Record<string, unknown> | null
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
      queryClient.invalidateQueries({
        queryKey: ['documentType', variables.slugOrId],
      })
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
export function useDocuments(
  documentTypeId: string,
  options?: { page?: number; status?: string; search?: string },
) {
  return useQuery({
    queryKey: ['documents', documentTypeId, options],
    queryFn: async () => {
      const res = await api.api.documents.$get({
        query: {
          documentTypeId,
          page: String(options?.page || 1),
          status: options?.status || 'all',
          ...(options?.search && { search: options.search }),
        },
      })
      if (!res.ok) await handleApiError(res, 'Failed to fetch documents')
      const data = await res.json()
      return extractData(data, 'Failed to fetch documents')
    },
    enabled: !!documentTypeId,
    // Keep showing previous results while new search results load
    placeholderData: (previousData) => previousData,
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const res = await api.api.documents[':id'].$get({
        param: { id },
      })
      if (!res.ok) await handleApiError(res, 'Failed to fetch document')
      const data = await res.json()
      return extractData(data, 'Failed to fetch document')
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
      queryClient.invalidateQueries({ queryKey: ['documents'], exact: false })
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
      queryClient.invalidateQueries({ queryKey: ['documents'], exact: false })
    },
  })
}

// Processing
export function useProcessDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      documentId,
      model,
    }: {
      documentId: string
      model?: string
    }) => {
      const res = await api.api.process[':documentId'].$post({
        param: { documentId },
        json: model ? { model } : {},
      })
      if (!res.ok) throw new Error('Failed to process document')
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['document', variables.documentId],
      })
      queryClient.invalidateQueries({ queryKey: ['documents'], exact: false })
    },
  })
}

// Streaming Processing using SSE (text streaming with bracket closing on server)
export function useProcessDocumentStreaming() {
  const queryClient = useQueryClient()
  const abortControllerRef = useRef<AbortController | null>(null)

  const processWithStreaming = async (
    documentId: string,
    model: string | undefined,
    onStarted: (jobId: string) => void,
    onPartial: (data: Record<string, unknown>) => void,
    onComplete: (data: Record<string, unknown>) => void,
    onError: (error: string) => void,
  ): Promise<void> => {
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController()

    return new Promise((resolve, reject) => {
      // Use fetch with POST to send body, then read SSE stream
      fetch('/api/process/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, model }),
        credentials: 'include',
        signal: abortControllerRef.current?.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to start streaming')
          }

          const reader = response.body?.getReader()
          if (!reader) throw new Error('No response body')

          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })

            // Parse SSE events from buffer
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                const eventType = line.slice(7)
                const nextLine = lines[lines.indexOf(line) + 1]
                if (nextLine?.startsWith('data: ')) {
                  const data = nextLine.slice(6)

                  if (eventType === 'started') {
                    try {
                      const { jobId } = JSON.parse(data)
                      onStarted(jobId)
                    } catch (_e) {
                      // Ignore parse errors
                    }
                  } else if (eventType === 'partial') {
                    try {
                      onPartial(JSON.parse(data))
                    } catch (_e) {
                      // Ignore parse errors for partial data
                    }
                  } else if (eventType === 'complete') {
                    try {
                      onComplete(JSON.parse(data))
                    } catch (e) {
                      console.error('Failed to parse complete data:', e)
                    }
                  } else if (eventType === 'error') {
                    onError(data)
                  } else if (eventType === 'done') {
                    queryClient.invalidateQueries({
                      queryKey: ['document', documentId],
                    })
                    queryClient.invalidateQueries({
                      queryKey: ['documents'],
                      exact: false,
                    })
                    queryClient.invalidateQueries({
                      queryKey: ['activeJobs'],
                      exact: false,
                    })
                    resolve()
                    return
                  }
                }
              }
            }
          }

          resolve()
        })
        .catch((error) => {
          // Don't report abort errors as failures
          if (error.name === 'AbortError') {
            resolve()
            return
          }
          onError(error.message || 'Connection error')
          reject(error)
        })
    })
  }

  const abort = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }

  return { processWithStreaming, abort }
}

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
      queryClient.invalidateQueries({ queryKey: ['documents'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['activeJobs'], exact: false })
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

export function useCancelBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (batchId: string) => {
      const res = await fetch(`/api/batches/${batchId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to cancel batch')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['batch'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['activeJobs'], exact: false })
    },
  })
}

// Users
export function useUsers(options?: { page?: number; search?: string }) {
  return useQuery({
    queryKey: ['users', options],
    queryFn: async () => {
      const res = await api.api.users.$get({
        query: {
          page: String(options?.page || 1),
          ...(options?.search && { search: options.search }),
        },
      })
      if (!res.ok) throw new Error('Failed to fetch users')
      return res.json()
    },
    placeholderData: (previousData) => previousData,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      name: string
      email: string
      password: string
      role?: 'admin' | 'user' | 'none'
    }) => {
      const res = await api.api.users.$post({ json: data })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(
          (error as { error?: string }).error || 'Failed to create user',
        )
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string
      role: 'admin' | 'user' | 'none'
    }) => {
      const res = await api.api.users[':id'].role.$patch({
        param: { id: userId },
        json: { role },
      })
      if (!res.ok) throw new Error('Failed to update user role')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string
      data: {
        name?: string
        email?: string
        role?: 'admin' | 'user' | 'none'
      }
    }) => {
      const res = await api.api.users[':id'].$patch({
        param: { id: userId },
        json: data,
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(
          (error as { error?: string }).error || 'Failed to update user',
        )
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.api.users[':id'].$delete({
        param: { id: userId },
      })
      if (!res.ok) throw new Error('Failed to delete user')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// Document rotation
export function useRotateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      documentId,
      degrees,
      pageNumber,
    }: {
      documentId: string
      degrees: number
      pageNumber?: number
    }) => {
      const res = await api.api.documents[':id'].rotate.$post({
        param: { id: documentId },
        json: { degrees, pageNumber },
      })
      if (!res.ok) throw new Error('Failed to rotate document')
      return res.json()
    },
    onSuccess: (_, { documentId }) => {
      // Invalidate document to force refetch (cache bust for file)
      queryClient.invalidateQueries({ queryKey: ['document', documentId] })
    },
  })
}

// Active jobs for a document type
export function useActiveJobs(documentTypeId: string | undefined) {
  return useQuery({
    queryKey: ['activeJobs', documentTypeId],
    queryFn: async () => {
      if (!documentTypeId) return { jobs: [] }
      const res = await api.api.jobs.active.$get({
        query: { documentTypeId },
      })
      if (!res.ok) throw new Error('Failed to fetch active jobs')
      return res.json()
    },
    enabled: !!documentTypeId,
    // Refetch periodically to stay in sync
    refetchInterval: 5000,
  })
}

export function useCancelJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (jobId: string) => {
      const res = await fetch(`/api/jobs/${jobId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to cancel job')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'], exact: false })
      queryClient.invalidateQueries({ queryKey: ['activeJobs'], exact: false })
    },
  })
}
