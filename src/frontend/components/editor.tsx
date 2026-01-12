import { useRef, useEffect } from 'react'
import { Editor as MonacoEditor, type OnMount } from '@monaco-editor/react'
import { useTheme } from '@/lib/theme'
import { Skeleton } from '@/components/ui/skeleton'
import type * as monaco from 'monaco-editor'

interface EditorProps {
  value: string
  onChange: (value: string | undefined) => void
  language?: string
}

export default function Editor({ value, onChange, language = 'json' }: EditorProps) {
  const { theme } = useTheme()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value)
    }
  }, [value])

  return (
    <div className="border-border h-full min-h-[200px] overflow-hidden rounded-md border">
      <MonacoEditor
        language={language}
        defaultValue={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
        loading={<Skeleton className="h-full w-full" />}
      />
    </div>
  )
}
