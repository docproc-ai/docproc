import type { JsonSchema } from '../schema-builder/types'

export interface FormRendererProps {
  schema: JsonSchema
  data: any
  onChange: (data: any) => void
}

export interface FormFieldProps {
  name: string
  schema: JsonSchema
  value: any
  onChange: (value: any) => void
  required?: boolean
  isArrayItem?: boolean
}
