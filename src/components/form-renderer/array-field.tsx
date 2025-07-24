'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { FormFieldProps } from './types'
import type { JsonSchema } from '../schema-builder/types'

function SpreadsheetCellInput({
  schema,
  value,
  onChange,
}: {
  schema: JsonSchema
  value: any
  onChange: (value: any) => void
}) {
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type
  const inputClasses =
    'w-full h-full bg-transparent border-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 rounded-none px-2 py-1'

  switch (fieldType) {
    case 'number':
    case 'integer':
      return (
        <Input
          type="number"
          value={value ?? ''}
          onChange={(e) =>
            onChange(
              e.target.value === ''
                ? undefined
                : fieldType === 'integer'
                  ? Number.parseInt(e.target.value)
                  : Number.parseFloat(e.target.value),
            )
          }
          onWheel={(e) => e.currentTarget.blur()}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault()
            }
          }}
          className={cn(
            inputClasses,
            '[-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          )}
        />
      )
    case 'boolean':
      return (
        <div className="flex h-full items-center justify-center">
          <Checkbox checked={!!value} onCheckedChange={onChange} />
        </div>
      )
    case 'string':
      if (schema.format === 'date') {
        return (
          <Input
            type="date"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputClasses, 'relative')}
          />
        )
      }
      return (
        <Input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      )
    default:
      return (
        <Input
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
        />
      )
  }
}

function ArrayTableField({
  name,
  schema,
  value,
  onChange,
  required,
}: {
  name: string
  schema: JsonSchema
  value: any[]
  onChange: (value: any[]) => void
  required?: boolean
}) {
  const arrayValue = value || []

  const handleAddRow = () => {
    const itemsSchema = schema.items || {}
    let newItem: any
    if (itemsSchema.type === 'object') {
      newItem = Object.entries(itemsSchema.properties || {}).reduce(
        (acc, [key, propSchema]) => {
          acc[key] = propSchema.default !== undefined ? propSchema.default : undefined
          return acc
        },
        {} as Record<string, any>,
      )
    } else {
      newItem = itemsSchema.default !== undefined ? itemsSchema.default : ''
    }
    onChange([...arrayValue, newItem])
  }

  const handleRemoveRow = (index: number) => {
    const newArray = arrayValue.filter((_, i) => i !== index)
    onChange(newArray)
  }

  const handleCellChange = (rowIndex: number, columnKey: string | null, newValue: any) => {
    const newArray = [...arrayValue]
    if (columnKey) {
      newArray[rowIndex] = { ...newArray[rowIndex], [columnKey]: newValue }
    } else {
      newArray[rowIndex] = newValue
    }
    onChange(newArray)
  }

  const itemsSchema = schema.items || { type: 'string' }
  const isObjectArray = itemsSchema.type === 'object' && itemsSchema.properties
  const headers = isObjectArray
    ? Object.keys(itemsSchema.properties || {})
    : [itemsSchema.title || 'Value']

  return (
    <div className="border-border space-y-2 rounded-lg border p-4">
      <div>
        <Label className="text-base font-semibold">
          {schema.title || name}
          {required && <span className="ml-1 text-red-500">*</span>}
        </Label>
        {schema.description && (
          <p className="text-muted-foreground mt-1 text-sm">{schema.description}</p>
        )}
      </div>
      <div className="border-border overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {headers.map((header) => (
                <TableHead key={header} className="px-2 py-2 whitespace-nowrap">
                  {isObjectArray ? itemsSchema.properties?.[header]?.title || header : header}
                </TableHead>
              ))}
              <TableHead className="w-[50px] px-2 py-2 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrayValue.map((item, rowIndex) => (
              <TableRow key={rowIndex}>
                {headers.map((headerKey) => {
                  const cellSchema = isObjectArray
                    ? itemsSchema.properties?.[headerKey] || {}
                    : itemsSchema
                  const cellValue = isObjectArray ? item[headerKey] : item
                  const columnKey = isObjectArray ? headerKey : null
                  return (
                    <TableCell key={headerKey} className="h-10 p-0">
                      <SpreadsheetCellInput
                        schema={cellSchema}
                        value={cellValue}
                        onChange={(newValue) => handleCellChange(rowIndex, columnKey, newValue)}
                      />
                    </TableCell>
                  )
                })}
                <TableCell className="px-2 py-0 text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(rowIndex)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleAddRow}>
        <Plus className="h-4 w-4" />
        Add Row
      </Button>
    </div>
  )
}

export function ArrayField({ name, schema, value, onChange, required }: FormFieldProps) {
  const [expandedArrayItems, setExpandedArrayItems] = useState<Record<string, boolean>>({})

  if (schema.type !== 'array') return null

  const toggleArrayItem = (itemKey: string) => {
    setExpandedArrayItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }))
  }

  if (schema['ui:widget'] === 'table') {
    return (
      <ArrayTableField
        name={name}
        schema={schema}
        value={value}
        onChange={onChange}
        required={required}
      />
    )
  }

  const arrayValue = value || []

  return (
    <div className="border-border space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">
            {schema.title || name}
            {required && <span className="ml-1 text-red-500">*</span>}
          </Label>
          {schema.description && (
            <p className="text-muted-foreground mt-1 text-sm">{schema.description}</p>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange([...arrayValue, schema.items?.default ?? ''])}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {arrayValue.map((item: any, index: number) => {
        const itemKey = `${name}-${index}`
        const isExpanded = expandedArrayItems[itemKey] !== false

        return (
          <Collapsible
            key={index}
            open={isExpanded}
            onOpenChange={() => toggleArrayItem(itemKey)}
          >
            <div className="border-border space-y-4 rounded-lg border p-4">
              <CollapsibleTrigger asChild>
                <div className="flex cursor-pointer items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Label className="text-muted-foreground text-sm font-medium">
                      {schema.title || name}[{index}]
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      const newArray = arrayValue.filter((_: any, i: number) => i !== index)
                      onChange(newArray)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {/* This would need to be replaced with the actual FormField component */}
                <div className="text-muted-foreground text-sm">
                  Array item content would go here
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )
      })}
    </div>
  )
}
