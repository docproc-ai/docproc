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

export function StringField({ name, schema, value, onChange, required }: FormFieldProps) {
  if (schema.type !== 'string') return null

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
        <Select value={String(value ?? '')} onValueChange={onChange}>
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
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={schema.default}
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
      {schema.description && (
        <p className="text-muted-foreground text-sm">{schema.description}</p>
      )}
      <Input
        id={name}
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={schema.default}
      />
    </div>
  )
}
