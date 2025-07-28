'use client'

import { useRef, useEffect } from 'react'
import { Editor as MonacoEditor, type OnMount } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { Skeleton } from '@/components/ui/skeleton'
import type * as monaco from 'monaco-editor'
import { Textarea } from '@/components/ui/textarea'

interface EditorProps {
  value: string
  onChange: (value: string | undefined) => void
  language?: string
}

export default function Editor({ value, onChange, language = 'json' }: EditorProps) {
  const { resolvedTheme } = useTheme()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  // When the external value prop changes, update the editor's content.
  // This is crucial for when the data is updated by the AI or the form,
  // and we need to reflect that change in the editor.
  useEffect(() => {
    // We check if the editor's current value is different from the prop value
    // to prevent an infinite loop. If we just called setValue every time,
    // the onChange handler would trigger a state update in the parent, which
    // would re-run this effect, and so on.
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value)
    }
  }, [value])

  if (language !== 'json') {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[120px] font-mono text-sm"
        rows={5}
      />
    )
  }

  return (
    <div className="border-border h-full min-h-[200px] overflow-hidden rounded-md border">
      <MonacoEditor
        language={language}
        // The `defaultValue` prop is only used for the initial value.
        // Subsequent updates are handled by the useEffect above.
        defaultValue={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true, // This is important for resizable containers
        }}
        loading={<Skeleton className="h-full w-full" />}
      />
    </div>
  )
}
