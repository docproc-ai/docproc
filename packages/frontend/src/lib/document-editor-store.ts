import { create } from 'zustand'

interface DocumentEditorState {
  streamingData: Record<string, unknown> | null
  streamingDocId: string | null
  isStreaming: boolean
  hasUnsavedChanges: boolean
  saveFn: (() => Promise<void>) | null
  processFn: ((skipValidation?: boolean) => Promise<void>) | null

  setStreamingData: (data: Record<string, unknown> | null) => void
  setStreamingDocId: (id: string | null) => void
  setIsStreaming: (streaming: boolean) => void
  setHasUnsavedChanges: (has: boolean) => void
  registerSave: (fn: (() => Promise<void>) | null) => void
  registerProcess: (
    fn: ((skipValidation?: boolean) => Promise<void>) | null,
  ) => void
  reset: () => void
}

export const useDocumentEditorStore = create<DocumentEditorState>((set) => ({
  streamingData: null,
  streamingDocId: null,
  isStreaming: false,
  hasUnsavedChanges: false,
  saveFn: null,
  processFn: null,

  setStreamingData: (data) => set({ streamingData: data }),
  setStreamingDocId: (id) => set({ streamingDocId: id }),
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  setHasUnsavedChanges: (has) => set({ hasUnsavedChanges: has }),
  registerSave: (fn) => set({ saveFn: fn }),
  registerProcess: (fn) => set({ processFn: fn }),
  reset: () =>
    set({
      streamingData: null,
      streamingDocId: null,
      isStreaming: false,
      hasUnsavedChanges: false,
      saveFn: null,
      processFn: null,
    }),
}))
