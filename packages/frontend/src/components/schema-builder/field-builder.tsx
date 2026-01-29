import { ChevronDown, ChevronRight, GripVertical, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Field, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { JsonSchema } from './types'

interface FieldBuilderProps {
  propertyKey: string
  propertySchema: JsonSchema
  propertyId: string
  isExpanded: boolean
  onToggle: () => void
  onRename: (oldKey: string, newKey: string) => void
  onRemove: (key: string) => void
  onTypeChange: (key: string, type: string) => void
  onRequiredChange: (key: string, required: boolean) => void
  onTitleChange: (key: string, title: string) => void
  onDescriptionChange: (key: string, description: string) => void
  onAiInstructionsChange: (key: string, instructions: string) => void
  isRequired: boolean
  isDraggedOver: boolean
  isDragged: boolean
  onDragStart: (e: React.DragEvent, key: string) => void
  onDragOver: (e: React.DragEvent, key: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, key: string) => void
  onDragEnd: () => void
  existingKeys: string[]
  children: React.ReactNode
}

export function FieldBuilder({
  propertyKey,
  propertySchema,
  propertyId,
  isExpanded,
  onToggle,
  onRename,
  onRemove,
  onTypeChange,
  onRequiredChange,
  onTitleChange,
  onDescriptionChange,
  onAiInstructionsChange,
  isRequired,
  isDraggedOver,
  isDragged,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  existingKeys,
  children,
}: FieldBuilderProps) {
  const [editingKey, setEditingKey] = useState(propertyKey)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setEditingKey(propertyKey)
    setHasError(false)
  }, [propertyKey])

  const validateKey = (key: string) => {
    const trimmedKey = key.trim()

    if (!trimmedKey) {
      return 'Property name cannot be empty'
    }

    if (trimmedKey !== propertyKey && existingKeys.includes(trimmedKey)) {
      return 'Property name already exists'
    }

    return null
  }

  const handleKeyBlur = () => {
    const trimmedKey = editingKey.trim()
    const error = validateKey(trimmedKey)

    if (error) {
      setHasError(true)
      return
    }

    setHasError(false)

    if (trimmedKey !== propertyKey) {
      onRename(propertyKey, trimmedKey)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setEditingKey(propertyKey)
      setHasError(false)
      e.currentTarget.blur()
    }
  }

  const errorMessage = hasError ? validateKey(editingKey) : null

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className={`border-border rounded-lg border p-4 transition-all ${
          isDraggedOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
        } ${isDragged ? 'opacity-50' : ''}`}
        draggable
        onDragStart={(e) => onDragStart(e, propertyKey)}
        onDragOver={(e) => onDragOver(e, propertyKey)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, propertyKey)}
        onDragEnd={onDragEnd}
      >
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-2">
              <GripVertical className="text-muted-foreground size-4 cursor-grab active:cursor-grabbing" />
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <div
                className="relative flex-1"
                onClick={(e) => e.stopPropagation()}
              >
                <Field data-invalid={hasError}>
                  <Input
                    value={editingKey}
                    onChange={(e) => setEditingKey(e.target.value)}
                    onBlur={handleKeyBlur}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    className="h-8 font-medium"
                    placeholder="Property name"
                    aria-invalid={hasError}
                  />
                  {errorMessage && (
                    <div className="absolute left-0 top-full z-10">
                      <FieldError>{errorMessage}</FieldError>
                    </div>
                  )}
                </Field>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={
                  Array.isArray(propertySchema.type)
                    ? propertySchema.type[0]
                    : String(propertySchema.type || 'string')
                }
                onValueChange={(type) => onTypeChange(propertyKey, type)}
              >
                <SelectTrigger
                  className="h-8 w-24"
                  onClick={(e) => e.stopPropagation()}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="integer">Integer</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                  <SelectItem value="array">Array</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id={`required-${propertyId}`}
                  checked={isRequired}
                  onCheckedChange={(checked) =>
                    onRequiredChange(propertyKey, !!checked)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
                <Label
                  htmlFor={`required-${propertyId}`}
                  className="cursor-pointer text-sm font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  Required
                </Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove(propertyKey)
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <div className="border-border space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`title-${propertyId}`}>Title</Label>
                <Input
                  id={`title-${propertyId}`}
                  value={propertySchema.title ?? ''}
                  onChange={(e) => onTitleChange(propertyKey, e.target.value)}
                  placeholder="Field title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`description-${propertyId}`}>Description</Label>
                <Input
                  id={`description-${propertyId}`}
                  value={propertySchema.description ?? ''}
                  onChange={(e) =>
                    onDescriptionChange(propertyKey, e.target.value)
                  }
                  placeholder="Field description"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`ai-instructions-${propertyId}`}>
                AI Instructions
              </Label>
              <Input
                id={`ai-instructions-${propertyId}`}
                value={propertySchema.ai?.instructions ?? ''}
                onChange={(e) =>
                  onAiInstructionsChange(propertyKey, e.target.value)
                }
                placeholder="e.g., 'Look for the largest number at the bottom'"
              />
            </div>

            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
