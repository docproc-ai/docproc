"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import Editor from "@/components/editor"
import type { JsonSchema } from "./schema-builder"
import { Textarea } from "@/components/ui/textarea"

interface FormRendererProps {
  schema: JsonSchema
  data: any
  onChange: (data: any) => void
}

export function FormRenderer({ schema, data, onChange }: FormRendererProps) {
  if (!schema || !schema.properties) {
    return (
      <div className="text-center text-muted-foreground p-8">
        <p>No schema properties defined.</p>
        <p className="text-sm">Select a document or define a schema to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {Object.entries(schema.properties).map(([key, fieldSchema]) => (
        <div key={key} className="mb-4">
          <FormField
            name={key}
            schema={fieldSchema}
            value={data?.[key]}
            onChange={(value) => onChange({ ...data, [key]: value })}
            required={schema.required?.includes(key)}
          />
        </div>
      ))}
    </div>
  )
}

// All the sub-components for the form renderer are below

interface FormFieldProps {
  name: string
  schema: JsonSchema
  value: any
  onChange: (value: any) => void
  required?: boolean
  isArrayItem?: boolean
}

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
    "w-full h-full bg-transparent border-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 rounded-none px-2 py-1"

  switch (fieldType) {
    case "number":
    case "integer":
      return (
        <Input
          type="number"
          value={value ?? ""}
          onChange={(e) =>
            onChange(
              e.target.value === ""
                ? undefined
                : fieldType === "integer"
                  ? Number.parseInt(e.target.value)
                  : Number.parseFloat(e.target.value),
            )
          }
          onWheel={(e) => e.currentTarget.blur()}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault()
            }
          }}
          className={cn(
            inputClasses,
            "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]",
          )}
        />
      )
    case "boolean":
      return (
        <div className="flex justify-center items-center h-full">
          <Checkbox checked={!!value} onCheckedChange={onChange} />
        </div>
      )
    case "string":
      if (schema.format === "date") {
        return (
          <Input
            type="date"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputClasses, "relative")}
          />
        )
      }
      return (
        <Input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClasses} />
      )
    default:
      return (
        <Input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={inputClasses} />
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
    if (itemsSchema.type === "object") {
      newItem = Object.entries(itemsSchema.properties || {}).reduce(
        (acc, [key, propSchema]) => {
          acc[key] = propSchema.default !== undefined ? propSchema.default : undefined
          return acc
        },
        {} as Record<string, any>,
      )
    } else {
      newItem = itemsSchema.default !== undefined ? itemsSchema.default : ""
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

  const itemsSchema = schema.items || { type: "string" }
  const isObjectArray = itemsSchema.type === "object" && itemsSchema.properties
  const headers = isObjectArray ? Object.keys(itemsSchema.properties) : [itemsSchema.title || "Value"]

  return (
    <div className="space-y-2 border border-border rounded-lg p-4">
      <div>
        <Label className="text-base font-semibold">
          {schema.title || name}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {schema.description && <p className="text-sm text-muted-foreground mt-1">{schema.description}</p>}
      </div>
      <div className="overflow-x-auto border border-border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {headers.map((header) => (
                <TableHead key={header} className="px-2 py-2 whitespace-nowrap">
                  {isObjectArray ? itemsSchema.properties?.[header]?.title || header : header}
                </TableHead>
              ))}
              <TableHead className="w-[50px] text-right px-2 py-2">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrayValue.map((item, rowIndex) => (
              <TableRow key={rowIndex}>
                {headers.map((headerKey) => {
                  const cellSchema = isObjectArray ? itemsSchema.properties?.[headerKey] || {} : itemsSchema
                  const cellValue = isObjectArray ? item[headerKey] : item
                  const columnKey = isObjectArray ? headerKey : null
                  return (
                    <TableCell key={headerKey} className="p-0 h-10">
                      <SpreadsheetCellInput
                        schema={cellSchema}
                        value={cellValue}
                        onChange={(newValue) => handleCellChange(rowIndex, columnKey, newValue)}
                      />
                    </TableCell>
                  )
                })}
                <TableCell className="text-right px-2 py-0">
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
        <Plus className="h-4 w-4 " />
        Add Row
      </Button>
    </div>
  )
}

function FormField({ name, schema, value, onChange, required, isArrayItem = false }: FormFieldProps) {
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type
  const [expandedArrayItems, setExpandedArrayItems] = useState<Record<string, boolean>>({})

  const toggleArrayItem = (itemKey: string) => {
    setExpandedArrayItems((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }))
  }

  const handleChange = (newValue: any) => {
    onChange(newValue)
  }

  if (schema.enum) {
    return (
      <div className="space-y-2">
        <Label htmlFor={name}>
          {schema.title || name}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {schema.description && <p className="text-sm text-muted-foreground">{schema.description}</p>}
        <Select value={String(value ?? "")} onValueChange={handleChange}>
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

  switch (fieldType) {
    case "string":
      if (schema["ui:widget"] === "textarea") {
        return (
          <div className="space-y-2">
            <Label htmlFor={name}>
              {schema.title || name}
              {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {schema.description && <p className="text-sm text-muted-foreground">{schema.description}</p>}
            <Textarea
              id={name}
              value={value ?? ""}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={schema.default}
              rows={4}
            />
          </div>
        )
      }
      if (schema.format === "date") {
        return (
          <div className="space-y-2">
            <Label htmlFor={name}>
              {schema.title || name}
              {required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {schema.description && <p className="text-sm text-muted-foreground">{schema.description}</p>}
            <Input
              id={name}
              type="date"
              value={value ?? ""}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={schema.default}
            />
          </div>
        )
      }
      return (
        <div className="space-y-2">
          <Label htmlFor={name}>
            {schema.title || name}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {schema.description && <p className="text-sm text-muted-foreground">{schema.description}</p>}
          <Input
            id={name}
            type="text"
            value={value ?? ""}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={schema.default}
          />
        </div>
      )

    case "number":
    case "integer":
      return (
        <div className="space-y-2">
          <Label htmlFor={name}>
            {schema.title || name}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {schema.description && <p className="text-sm text-muted-foreground">{schema.description}</p>}
          <Input
            id={name}
            type="number"
            value={value ?? ""}
            onChange={(e) => {
              const val = e.target.value
              if (val === "") {
                handleChange(undefined)
              } else {
                handleChange(fieldType === "integer" ? Number.parseInt(val) : Number.parseFloat(val))
              }
            }}
            onWheel={(e) => e.currentTarget.blur()}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault()
              }
            }}
            min={schema.minimum}
            max={schema.maximum}
            className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
          />
        </div>
      )

    case "boolean":
      return (
        <div className="flex items-center space-x-2">
          <Checkbox id={name} checked={value || false} onCheckedChange={handleChange} />
          <Label htmlFor={name}>
            {schema.title || name}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {schema.description && <p className="text-sm text-muted-foreground ml-2">{schema.description}</p>}
        </div>
      )

    case "object":
      const objectContent = (
        <>
          {!isArrayItem && (
            <div>
              <Label className="text-base font-semibold">
                {schema.title || name}
                {required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {schema.description && <p className="text-sm text-muted-foreground mt-1">{schema.description}</p>}
            </div>
          )}
          {schema.properties &&
            Object.entries(schema.properties).map(([key, subSchema]) => (
              <FormField
                key={key}
                name={key}
                schema={subSchema}
                value={value?.[key]}
                onChange={(newValue) => handleChange({ ...value, [key]: newValue })}
                required={schema.required?.includes(key)}
              />
            ))}
        </>
      )

      if (isArrayItem) {
        return <div className="space-y-4">{objectContent}</div>
      }

      return <div className="space-y-4 border border-border rounded-lg p-4">{objectContent}</div>

    case "array":
      if (schema["ui:widget"] === "table") {
        return <ArrayTableField name={name} schema={schema} value={value} onChange={onChange} required={required} />
      }

      const arrayValue = value || []
      return (
        <div className="space-y-4 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">
                {schema.title || name}
                {required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {schema.description && <p className="text-sm text-muted-foreground mt-1">{schema.description}</p>}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleChange([...arrayValue, schema.items?.default ?? ""])}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {arrayValue.map((item: any, index: number) => {
            const itemKey = `${name}-${index}`
            const isExpanded = expandedArrayItems[itemKey] !== false

            return (
              <Collapsible key={index} open={isExpanded} onOpenChange={() => toggleArrayItem(itemKey)}>
                <div className="border border-border rounded-lg p-4 space-y-4">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <Label className="text-sm font-medium text-muted-foreground">
                          {schema.title || name}[{index}]
                        </Label>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          const newArray = arrayValue.filter((_: any, i: number) => i !== index)
                          handleChange(newArray)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <FormField
                      name={`${name}[${index}]`}
                      schema={schema.items || { type: "string" }}
                      value={item}
                      onChange={(newValue) => {
                        const newArray = [...arrayValue]
                        newArray[index] = newValue
                        handleChange(newArray)
                      }}
                      isArrayItem={true}
                    />
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
        </div>
      )

    default:
      return (
        <div className="space-y-2">
          <Label htmlFor={name}>
            {schema.title || name}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {schema.description && <p className="text-sm text-muted-foreground">{schema.description}</p>}
          <Editor language="text" value={String(value ?? "")} onChange={handleChange} />
        </div>
      )
  }
}
