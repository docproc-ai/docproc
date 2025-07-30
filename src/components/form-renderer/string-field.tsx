'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { FormFieldProps } from './types'

export function StringField({ name, schema, value, onChange, required, isStreaming }: FormFieldProps) {
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type

  // Handle enums for any type, not just strings
  if (schema.enum) {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </Label>
        {schema.description && (
          <p className="text-muted-foreground text-sm">{schema.description}</p>
        )}
        <Select value={String(value ?? '')} onValueChange={onChange} disabled={isStreaming}>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {schema.enum.map((option, index) => (
              <SelectItem key={index} value={String(option)}>
                {String(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // Only render string fields if not an enum
  if (fieldType !== 'string') return null

  if (schema['ui:widget'] === 'textarea') {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </Label>
        {schema.description && (
          <p className="text-muted-foreground text-sm">{schema.description}</p>
        )}
        <Textarea
          id={name}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.default}
          rows={4}
          disabled={isStreaming}
        />
      </div>
    )
  }

  if (schema.format === 'date') {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </Label>
        {schema.description && (
          <p className="text-muted-foreground text-sm">{schema.description}</p>
        )}
        <Input
          id={name}
          type={isStreaming ? "text" : "date"}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.default}
          disabled={isStreaming}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {schema.title || name}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {schema.description && <p className="text-muted-foreground text-sm">{schema.description}</p>}
      <Input
        id={name}
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={schema.default}
        disabled={isStreaming}
      />
    </div>
  )
}
