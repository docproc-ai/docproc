export interface JsonSchema {
  type?: string | string[]
  title?: string
  description?: string
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  required?: string[]
  enum?: any[]
  default?: any
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  format?: 'date' | 'date-time' | 'email' | 'uri'
  'ui:widget'?: 'default' | 'table' | 'textarea'
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
