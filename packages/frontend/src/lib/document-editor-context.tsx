import { createContext, useContext, type ReactNode } from 'react'

interface DocumentEditorContextValue {
  streamingData: Record<string, unknown> | null
  isStreaming: boolean
}

const DocumentEditorContext = createContext<DocumentEditorContextValue | null>(null)

export function DocumentEditorProvider({
  children,
  streamingData,
  isStreaming,
}: {
  children: ReactNode
  streamingData: Record<string, unknown> | null
  isStreaming: boolean
}) {
  return (
    <DocumentEditorContext.Provider value={{ streamingData, isStreaming }}>
      {children}
    </DocumentEditorContext.Provider>
  )
}

export function useDocumentEditorContext() {
  const context = useContext(DocumentEditorContext)
  if (!context) {
    throw new Error('useDocumentEditorContext must be used within DocumentEditorProvider')
  }
  return context
}
