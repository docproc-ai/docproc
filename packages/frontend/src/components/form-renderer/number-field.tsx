import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import type { FormFieldProps } from './types'

export function NumberField({
  name,
  schema,
  value,
  onChange,
  required,
  isStreaming,
}: FormFieldProps) {
  if (schema.type !== 'number' && schema.type !== 'integer') return null

  const fieldType = schema.type

  // Track the raw input string to allow intermediate states like "12." or "12.0"
  const [rawInput, setRawInput] = useState<string>(() =>
    typeof value === 'number' ? value.toLocaleString() : (value ?? ''),
  )
  const [isFocused, setIsFocused] = useState(false)

  // Sync rawInput when value changes externally (e.g., from streaming or reset)
  useEffect(() => {
    if (!isFocused) {
      setRawInput(typeof value === 'number' ? value.toLocaleString() : (value ?? ''))
    }
  }, [value, isFocused])

  return (
    <Field>
      <FieldLabel htmlFor={name}>
        {schema.title || name}
        {required && <span className="ml-1 text-red-500">*</span>}
      </FieldLabel>
      {schema.description && <FieldDescription>{schema.description}</FieldDescription>}
      <Input
        id={name}
        type="text"
        inputMode="decimal"
        value={rawInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false)
          // On blur, format the display value
          if (typeof value === 'number') {
            setRawInput(value.toLocaleString())
          }
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.-]/g, '')
          setRawInput(raw)

          if (raw === '' || raw === '-') {
            onChange(raw === '-' ? raw : undefined)
            return
          }

          // Only parse and update if it's a complete number (not ending with . or -)
          if (!raw.endsWith('.') && !raw.endsWith('-')) {
            const parsed =
              fieldType === 'integer' ? Number.parseInt(raw) : Number.parseFloat(raw)
            if (!Number.isNaN(parsed)) {
              onChange(parsed)
            }
          }
        }}
        onWheel={(e) => e.currentTarget.blur()}
        min={schema.minimum}
        max={schema.maximum}
        className=""
        disabled={isStreaming}
      />
    </Field>
  )
}
