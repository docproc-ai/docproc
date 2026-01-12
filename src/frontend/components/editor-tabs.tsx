import React from 'react'
import Editor from '@/components/editor'
import { Label } from '@/components/ui/label'

interface EditorTabProps {
  value: string
  onChange: (value: string | undefined) => void
}

const SchemaEditorTabComponent = ({ value, onChange }: EditorTabProps) => {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-lg font-semibold">JSON Schema</Label>
        <p className="text-muted-foreground mb-4 text-sm">
          Edit the JSON schema directly. Changes will update the form and builder.
        </p>
      </div>
      <div className="h-[500px]">
        <Editor language="json" value={value} onChange={onChange} />
      </div>
    </div>
  )
}

const DataEditorTabComponent = ({ value, onChange }: EditorTabProps) => {
  return (
    <div className="h-full">
      <Editor language="json" value={value} onChange={onChange} />
    </div>
  )
}

export const SchemaEditorTab = React.memo(SchemaEditorTabComponent)
export const DataEditorTab = React.memo(DataEditorTabComponent)
