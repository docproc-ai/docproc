import type { JsonSchema } from '../schema-builder/types'

export interface FormRendererProps {
  schema: JsonSchema
  data: unknown
  onChange: (data: unknown) => void
  isStreaming?: boolean
}

export interface FormFieldProps {
  name: string
  schema: JsonSchema
  value: unknown
  onChange: (value: unknown) => void
  required?: boolean
  isArrayItem?: boolean
  isStreaming?: boolean
}
