'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { JsonSchema } from './types'

interface ArrayFieldBuilderProps {
  schema: JsonSchema
  onChange: (updates: Partial<JsonSchema>) => void
  children: React.ReactNode
}

export function ArrayFieldBuilder({ schema, onChange, children }: ArrayFieldBuilderProps) {
  if (schema.type !== 'array') return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Label className="col-span-2 text-base font-semibold">Array Settings</Label>
        <div>
          <Label>Display as</Label>
          <Select
            value={schema['ui:widget'] || 'default'}
            onValueChange={(value) =>
              onChange({ 'ui:widget': value as 'default' | 'table' })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">List</SelectItem>
              <SelectItem value="table">Table</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Label className="text-base font-semibold">Array Items Schema</Label>
      <div className="border-border rounded-lg border p-4">
        {children}
      </div>
    </div>
  )
}
