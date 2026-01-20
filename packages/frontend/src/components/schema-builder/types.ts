export interface JsonSchema {
  type?: string | string[]
  title?: string
  description?: string
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  enum?: (string | number | boolean | null)[]
  default?: string | number | boolean | null
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  format?: 'date' | 'date-time' | 'email' | 'uri'
  'ui:widget'?: 'default' | 'table' | 'textarea'
  'ui:pivoted'?: boolean
  'ui:displayTemplate'?: string
  ai?: {
    instructions?: string
  }
}

export interface SchemaBuilderProps {
  schema: JsonSchema
  onChange: (schema: JsonSchema) => void
  path?: string
}

export interface FieldBuilderProps {
  schema: JsonSchema
  onChange: (schema: JsonSchema) => void
  path?: string
}
