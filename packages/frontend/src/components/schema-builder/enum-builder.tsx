import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addOption}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
        Add Option
      </Button>
    </div>
  )
}
