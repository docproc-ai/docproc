'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus } from 'lucide-react'

interface EnumBuilderProps {
  value: any[]
  onChange: (newValue: any[]) => void
}

export function EnumBuilder({ value, onChange }: EnumBuilderProps) {
  const handleOptionChange = (index: number, newValue: string) => {
    const newOptions = [...value]
    newOptions[index] = newValue
    onChange(newOptions)
  }

  const addOption = () => {
    onChange([...value, `New Option`])
  }

  const removeOption = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2 pl-6">
      <p className="text-muted-foreground text-sm">
        The form will show a dropdown with these options.
      </p>
      {value.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={option}
            onChange={(e) => handleOptionChange(index, e.target.value)}
            placeholder={`Option ${index + 1}`}
          />
          <Button variant="ghost" size="icon" onClick={() => removeOption(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addOption}>
        <Plus className="h-4 w-4" />
        Add Option
      </Button>
    </div>
  )
}
