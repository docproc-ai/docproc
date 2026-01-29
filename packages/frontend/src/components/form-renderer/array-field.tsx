import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemActions,
  ItemGroup,
} from '@/components/ui/item'
import { cn } from '@/lib/utils'
import type { FormFieldProps } from './types'
import type { JsonSchema } from '../schema-builder/types'
import { StringField } from './string-field'
import { NumberField } from './number-field'
import { BooleanField } from './boolean-field'
import { ObjectField } from './object-field'

// Forward declaration to avoid circular dependency
function FormField({
  name,
  schema,
  value,
  onChange,
  required,
  isArrayItem = false,
  isStreaming = false,
}: {
  name: string
  schema: JsonSchema
  value: unknown
  onChange: (value: unknown) => void
  required?: boolean
  isArrayItem?: boolean
  isStreaming?: boolean
}) {
  // Handle enum fields (dropdowns) for any type
  if (schema.enum) {
    return (
      <StringField
        name={name}
        schema={schema}
        value={value}
        onChange={onChange}
        required={required}
        isArrayItem={isArrayItem}
        isStreaming={isStreaming}
      />
    )
  }

  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type

  // Render based on field type
  switch (fieldType) {
    case 'string':
      return (
        <StringField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    case 'number':
    case 'integer':
      return (
        <NumberField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    case 'boolean':
      return (
        <BooleanField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    case 'object':
      return (
        <ObjectField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    case 'array':
      return (
        <ArrayField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
    default:
      // Fallback for unknown types - render as string
      return (
        <StringField
          name={name}
          schema={schema}
          value={value}
          onChange={onChange}
          required={required}
          isArrayItem={isArrayItem}
          isStreaming={isStreaming}
        />
      )
  }
}

// Helper to format ISO date to locale string
function formatDateForDisplay(isoValue: string | undefined | null): string {
  if (!isoValue) return ''
  try {
    const date = new Date(`${isoValue}T00:00:00`)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString()
    }
    return isoValue
  } catch {
    return isoValue
  }
}

// Helper to parse locale date string to ISO
function parseDateToISO(input: string): string | null {
  if (!input) return null
  try {
    const date = new Date(input)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch {
    // Fall through
  }
  return null
}

// Date input that shows locale format but stores ISO, commits on blur
function DateCellInput({
  value,
  onChange,
  onKeyDown,
  className,
  disabled,
}: {
  value: string | undefined
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  className?: string
  disabled?: boolean
}) {
  const [localValue, setLocalValue] = useState(() =>
    formatDateForDisplay(value),
  )

  // Sync from prop when value changes externally
  useEffect(() => {
    setLocalValue(formatDateForDisplay(value))
  }, [value])

  const handleBlur = () => {
    const parsed = parseDateToISO(localValue)
    if (parsed) {
      onChange(parsed)
      setLocalValue(formatDateForDisplay(parsed))
    } else if (localValue === '') {
      onChange('')
    }
    // If parse failed, keep the local value as-is for the user to fix
  }

  return (
    <Input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      className={className}
      disabled={disabled}
    />
  )
}

function SpreadsheetCellInput({
  schema,
  value,
  onChange,
  disabled = false,
}: {
  schema: JsonSchema
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}) {
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type
  const inputClasses =
    'w-full h-full bg-transparent border-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 rounded-none px-2 py-1'

  // Handle keyboard navigation between cells
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Skip if Ctrl is pressed - let global handler handle document navigation
    if (e.ctrlKey) return

    const isVerticalNav =
      e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown'
    if (!isVerticalNav) return

    e.preventDefault()
    const cell = (e.target as HTMLElement).closest('td')
    if (!cell) return
    const row = cell.parentElement
    if (!row) return
    const cellIndex = Array.from(row.children).indexOf(cell)
    const goUp = e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)
    const targetRow = goUp ? row.previousElementSibling : row.nextElementSibling
    if (targetRow) {
      const targetCell = targetRow.children[cellIndex]
      const targetInput = targetCell?.querySelector(
        'input',
      ) as HTMLInputElement | null
      if (targetInput) {
        targetInput.focus()
        targetInput.select()
      }
    }
  }

  // Convert value to string for display
  const toStringValue = (val: unknown): string => {
    if (typeof val === 'string') return val
    if (val != null) return String(val)
    return ''
  }

  switch (fieldType) {
    case 'number':
    case 'integer': {
      // Display formatted value, parse on change
      const displayNum =
        typeof value === 'number' ? value.toLocaleString() : toStringValue(value)
      return (
        <Input
          type="text"
          inputMode="decimal"
          value={displayNum}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.-]/g, '')
            if (raw === '' || raw === '-') {
              onChange(raw === '-' ? raw : undefined)
              return
            }
            const parsed =
              fieldType === 'integer'
                ? Number.parseInt(raw, 10)
                : Number.parseFloat(raw)
            if (!Number.isNaN(parsed)) {
              onChange(parsed)
            }
          }}
          onKeyDown={handleKeyDown}
          onWheel={(e) => e.currentTarget.blur()}
          className={cn(inputClasses, 'text-right')}
          disabled={disabled}
        />
      )
    }
    case 'boolean':
      return (
        <div className="flex h-full items-center justify-center">
          <Checkbox
            checked={!!value}
            onCheckedChange={onChange}
            disabled={disabled}
          />
        </div>
      )
    case 'string':
      if (schema.format === 'date') {
        // Use text input for dates in spreadsheet to get proper right-alignment
        // Native date inputs have browser-specific padding that ignores text-align
        return (
          <DateCellInput
            value={typeof value === 'string' ? value : undefined}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            className={cn(inputClasses, 'text-right')}
            disabled={disabled}
          />
        )
      }
      return (
        <Input
          type="text"
          value={toStringValue(value)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={inputClasses}
          disabled={disabled}
        />
      )
    default:
      return (
        <Input
          type="text"
          value={toStringValue(value)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={inputClasses}
          disabled={disabled}
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
  isStreaming = false,
}: {
  name: string
  schema: JsonSchema
  value: unknown
  onChange: (value: unknown[]) => void
  required?: boolean
  isStreaming?: boolean
}) {
  const [isPivoted, setIsPivoted] = useState(schema['ui:pivoted'] ?? false)
  const arrayValue: unknown[] = Array.isArray(value) ? value : []

  const handleAddRecord = () => {
    const itemsSchema = schema.items || {}
    let newItem: unknown
    if (itemsSchema.type === 'object') {
      newItem = Object.entries(itemsSchema.properties || {}).reduce(
        (acc, [key, propSchema]) => {
          acc[key] =
            (propSchema as JsonSchema).default !== undefined
              ? (propSchema as JsonSchema).default
              : undefined
          return acc
        },
        {} as Record<string, unknown>,
      )
    } else {
      newItem = itemsSchema.default !== undefined ? itemsSchema.default : ''
    }
    onChange([...arrayValue, newItem])
  }

  const handleRemoveRecord = (index: number) => {
    const newArray = arrayValue.filter((_, i) => i !== index)
    onChange(newArray)
  }

  const handleCellChange = (
    recordIndex: number,
    fieldKey: string | null,
    newValue: unknown,
  ) => {
    const newArray = [...arrayValue]
    if (fieldKey) {
      const currentRecord = newArray[recordIndex]
      const recordObj = typeof currentRecord === 'object' && currentRecord !== null
        ? currentRecord as Record<string, unknown>
        : {}
      newArray[recordIndex] = { ...recordObj, [fieldKey]: newValue }
    } else {
      newArray[recordIndex] = newValue
    }
    onChange(newArray)
  }

  const itemsSchema = schema.items || { type: 'string' }
  const isObjectArray = itemsSchema.type === 'object' && itemsSchema.properties
  const fieldKeys = isObjectArray
    ? Object.keys(itemsSchema.properties || {})
    : [itemsSchema.title || 'Value']

  // Helper to get field value from item
  const getItemFieldValue = (item: unknown, fieldKey: string): unknown => {
    if (typeof item === 'object' && item !== null && fieldKey in item) {
      return (item as Record<string, unknown>)[fieldKey]
    }
    return undefined
  }

  // Get field title from schema
  const getFieldTitle = (fieldKey: string) => {
    if (isObjectArray) {
      return (
        (itemsSchema.properties?.[fieldKey] as JsonSchema)?.title || fieldKey
      )
    }
    return fieldKey
  }

  // Render normal (non-pivoted) table
  const renderNormalTable = () => (
    <div className="border-border overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {fieldKeys.map((fieldKey) => (
              <TableHead key={fieldKey} className="px-2 py-2 whitespace-nowrap">
                {getFieldTitle(fieldKey)}
              </TableHead>
            ))}
            <TableHead className="w-[50px] px-2 py-2 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {arrayValue.map((item, recordIndex) => (
            <TableRow key={recordIndex}>
              {fieldKeys.map((fieldKey) => {
                const cellSchema = isObjectArray
                  ? (itemsSchema.properties?.[fieldKey] as JsonSchema) || {}
                  : itemsSchema
                const cellValue = isObjectArray ? getItemFieldValue(item, fieldKey) : item
                const columnKey = isObjectArray ? fieldKey : null
                // Set minWidth for date columns to prevent cutoff
                const isDate = cellSchema.format === 'date'
                const minWidth = isDate ? '100px' : undefined
                return (
                  <TableCell
                    key={fieldKey}
                    className="h-10 p-0"
                    style={{ minWidth }}
                  >
                    <SpreadsheetCellInput
                      schema={cellSchema}
                      value={cellValue}
                      onChange={(newValue) =>
                        handleCellChange(recordIndex, columnKey, newValue)
                      }
                      disabled={isStreaming}
                    />
                  </TableCell>
                )
              })}
              <TableCell className="px-2 py-0 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveRecord(recordIndex)}
                  disabled={isStreaming}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  // Render pivoted table (fields as rows, records as columns)
  const renderPivotedTable = () => (
    <div className="border-border overflow-x-auto rounded-md border">
      <Table className="w-auto">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="px-2 py-2 whitespace-nowrap font-semibold">
              Field
            </TableHead>
            {arrayValue.map((_, recordIndex) => (
              <TableHead
                key={recordIndex}
                className="px-1 py-2 whitespace-nowrap text-center"
              >
                <div className="flex items-center justify-center gap-0.5">
                  <span className="text-xs">{recordIndex + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => handleRemoveRecord(recordIndex)}
                    disabled={isStreaming}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </TableHead>
            ))}
            {!isStreaming && (
              <TableHead className="w-[100px] px-2 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddRecord}
                  className="w-full"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {fieldKeys.map((fieldKey) => {
            const cellSchema = isObjectArray
              ? (itemsSchema.properties?.[fieldKey] as JsonSchema) || {}
              : itemsSchema
            return (
              <TableRow key={fieldKey}>
                <TableCell className="bg-muted/30 px-2 py-2 font-medium whitespace-nowrap">
                  {getFieldTitle(fieldKey)}
                </TableCell>
                {arrayValue.map((item, recordIndex) => {
                  const cellValue = isObjectArray ? getItemFieldValue(item, fieldKey) : item
                  const columnKey = isObjectArray ? fieldKey : null
                  // Format display value - dates and numbers in locale format
                  const displayValue = (() => {
                    if (cellValue == null) return ''
                    if (cellSchema.format === 'date' && cellValue) {
                      try {
                        const dateStr = typeof cellValue === 'string' ? cellValue : String(cellValue)
                        return new Date(dateStr).toLocaleDateString()
                      } catch {
                        return String(cellValue)
                      }
                    }
                    if (
                      (cellSchema.type === 'number' ||
                        cellSchema.type === 'integer') &&
                      typeof cellValue === 'number'
                    ) {
                      return cellValue.toLocaleString()
                    }
                    return cellValue
                  })()
                  // Calculate min width in pixels (~9px per char average)
                  // Using pixels ensures proper sizing even when content is off-screen
                  const charCount = displayValue
                    ? String(displayValue).length
                    : 4
                  const minWidthPx = Math.max(60, charCount * 8 + 16) // min 60px, 8px/char + padding
                  return (
                    <TableCell
                      key={recordIndex}
                      className="h-10 p-0"
                      style={{ minWidth: `${minWidthPx}px` }}
                    >
                      <SpreadsheetCellInput
                        schema={cellSchema}
                        value={cellValue}
                        onChange={(newValue) =>
                          handleCellChange(recordIndex, columnKey, newValue)
                        }
                        disabled={isStreaming}
                      />
                    </TableCell>
                  )
                })}
                {!isStreaming && <TableCell />}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )

  return (
    <Field>
      <div className="flex items-center justify-between">
        <div>
          <FieldLabel>
            {schema.title || name}
            {required && <span className="ml-1 text-red-500">*</span>}
          </FieldLabel>
          {schema.description && (
            <FieldDescription>{schema.description}</FieldDescription>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsPivoted(!isPivoted)}
          title={isPivoted ? 'Switch to normal view' : 'Switch to pivoted view'}
        >
          <ArrowLeftRight className="h-4 w-4" />
        </Button>
      </div>
      {isPivoted ? renderPivotedTable() : renderNormalTable()}
      {!isPivoted && !isStreaming && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddRecord}
        >
          <Plus className="h-4 w-4" />
          Add Record
        </Button>
      )}
    </Field>
  )
}

export function ArrayField({
  name,
  schema,
  value,
  onChange,
  required,
  isStreaming,
}: FormFieldProps) {
  const [expandedArrayItems, setExpandedArrayItems] = useState<
    Record<string, boolean>
  >({})
  const [newItemValue, setNewItemValue] = useState('')

  if (schema.type !== 'array') return null

  const toggleArrayItem = (itemKey: string) => {
    setExpandedArrayItems((prev) => {
      const currentState = prev[itemKey] ?? true // Default to expanded if undefined
      return {
        ...prev,
        [itemKey]: !currentState,
      }
    })
  }

  // Normalize value to array
  const arrayValue: unknown[] = Array.isArray(value) ? value : []

  if (schema['ui:widget'] === 'table') {
    return (
      <ArrayTableField
        name={name}
        schema={schema}
        value={arrayValue}
        onChange={onChange as (value: unknown[]) => void}
        required={required}
        isStreaming={isStreaming}
      />
    )
  }

  const itemsSchema = schema.items || { type: 'string' }
  const itemType = Array.isArray(itemsSchema.type)
    ? itemsSchema.type[0]
    : itemsSchema.type
  const isPrimitiveArray =
    itemType !== 'object' && itemType !== 'array'

  const allExpanded = arrayValue.every((_, index) => {
    const itemKey = `${name}-${index}`
    return expandedArrayItems[itemKey] !== false
  })

  const toggleAll = () => {
    const newState: Record<string, boolean> = {}
    arrayValue.forEach((_, index) => {
      const itemKey = `${name}-${index}`
      newState[itemKey] = !allExpanded
    })
    setExpandedArrayItems(newState)
  }

  // Simple list rendering for primitive arrays (strings, numbers, booleans)
  if (isPrimitiveArray) {
    return (
      <Field>
        <div>
          <FieldLabel>
            {schema.title || name}
            {required && <span className="ml-1 text-red-500">*</span>}
          </FieldLabel>
          {schema.description && (
            <FieldDescription>{schema.description}</FieldDescription>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {arrayValue.map((item: unknown, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <FormField
                  name={`${name}[${index}]`}
                  schema={itemsSchema}
                  value={item}
                  onChange={(newValue: unknown) => {
                    const newArray = [...arrayValue]
                    newArray[index] = newValue
                    onChange(newArray)
                  }}
                  isArrayItem={true}
                  isStreaming={isStreaming}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const newArray = arrayValue.filter(
                    (_: unknown, i: number) => i !== index,
                  )
                  onChange(newArray)
                }}
                disabled={isStreaming}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {!isStreaming && (
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Add new item..."
                  value={newItemValue}
                  onChange={(e) => setNewItemValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newItemValue.trim()) {
                      e.preventDefault()
                      onChange([...arrayValue, newItemValue])
                      setNewItemValue('')
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  onChange([...arrayValue, newItemValue])
                  setNewItemValue('')
                }}
                disabled={!newItemValue.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </Field>
    )
  }

  // Complex item rendering with collapsibles for objects/arrays
  return (
    <Field>
      <div className="flex items-center justify-between">
        <div>
          <FieldLabel>
            {schema.title || name}
            {required && <span className="ml-1 text-red-500">*</span>}
          </FieldLabel>
          {schema.description && (
            <FieldDescription>{schema.description}</FieldDescription>
          )}
        </div>
        {arrayValue.length > 1 && (
          <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </Button>
        )}
      </div>
      <ItemGroup>
        {arrayValue.map((item: unknown, index: number) => {
          const itemKey = `${name}-${index}`
          const isExpanded = expandedArrayItems[itemKey] !== false

          // Generate display text from template or value
          const displayText = (() => {
            const isObjectItem = itemsSchema.type === 'object'
            const template = itemsSchema['ui:displayTemplate']

            // For object items with template, use template
            if (isObjectItem && template && typeof item === 'object' && item !== null) {
              const itemObj = item as Record<string, unknown>
              const result = template.replace(
                /\{\{\s*(\w+)\s*\}\}/g,
                (match: string, fieldName: string) => {
                  const fieldValue = itemObj[fieldName]
                  return fieldValue !== undefined && fieldValue !== null && fieldValue !== ''
                    ? String(fieldValue)
                    : match
                },
              )
              return result || `${schema.title || name}[${index}]`
            }

            // For non-object items, show the value directly
            if (
              !isObjectItem &&
              item !== undefined &&
              item !== null &&
              item !== ''
            ) {
              return String(item)
            }

            // Fallback to index
            return `${schema.title || name}[${index}]`
          })()

          return (
            <Collapsible
              key={index}
              open={isExpanded}
              onOpenChange={() => toggleArrayItem(itemKey)}
            >
              <Item variant="outline" className="flex-col !flex-nowrap">
                <CollapsibleTrigger asChild>
                  <div className="flex w-full cursor-pointer items-center justify-between">
                    <ItemContent>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <ItemTitle>{displayText}</ItemTitle>
                      </div>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          const newArray = arrayValue.filter(
                            (_: unknown, i: number) => i !== index,
                          )
                          onChange(newArray)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ItemActions>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="w-full pt-4">
                  <FormField
                    name={`${name}[${index}]`}
                    schema={itemsSchema}
                    value={item}
                    onChange={(newValue: unknown) => {
                      const newArray = [...arrayValue]
                      newArray[index] = newValue
                      onChange(newArray)
                    }}
                    isArrayItem={true}
                    isStreaming={isStreaming}
                  />
                </CollapsibleContent>
              </Item>
            </Collapsible>
          )
        })}
      </ItemGroup>
      {!isStreaming && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const newIndex = arrayValue.length
            const itemKey = `${name}-${newIndex}`
            setExpandedArrayItems((prev) => ({ ...prev, [itemKey]: true }))
            onChange([...arrayValue, itemsSchema.default ?? ''])
          }}
          className="w-fit"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      )}
    </Field>
  )
}
