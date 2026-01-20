import { createContext, useContext, type ReactNode } from 'react'

interface DocumentEditorContextValue {
  streamingData: Record<string, unknown> | null
  isStreaming: boolean
  // Callbacks that child can register, parent can call
  registerSave: (fn: (() => Promise<void>) | null) => void
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (has: boolean) => void
}

const DocumentEditorContext = createContext<DocumentEditorContextValue | null>(
  null,
)

export function DocumentEditorProvider({
  children,
  streamingData,
  isStreaming,
  registerSave,
  hasUnsavedChanges,
  setHasUnsavedChanges,
}: {
  children: ReactNode
  streamingData: Record<string, unknown> | null
  isStreaming: boolean
  registerSave: (fn: (() => Promise<void>) | null) => void
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (has: boolean) => void
}) {
  return (
    <DocumentEditorContext.Provider
      value={{
        streamingData,
        isStreaming,
        registerSave,
        hasUnsavedChanges,
        setHasUnsavedChanges,
      }}
    >
      {children}
    </DocumentEditorContext.Provider>
  )
}

export function useDocumentEditorContext() {
  const context = useContext(DocumentEditorContext)
  if (!context) {
    throw new Error(
      'useDocumentEditorContext must be used within DocumentEditorProvider',
    )
  }
  return context
}
