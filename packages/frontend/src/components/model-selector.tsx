import { useState, useEffect } from 'react'
import { ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useQuery } from '@tanstack/react-query'

interface Model {
  id: string
  name: string
  contextLength?: number
}

interface ModelSelectorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

// Fetch models from the API
async function fetchModels(): Promise<Model[]> {
  const response = await fetch('/api/models')
  if (!response.ok) {
    throw new Error('Failed to fetch models')
  }
  return response.json()
}

export function ModelSelector({ value, onChange, placeholder = 'Select model...' }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const { data: models = [], isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: fetchModels,
    staleTime: 1000 * 60 * 60, // 1 hour
  })

  // Find the selected model
  const selectedModel = models.find((m) => m.id === value)

  // Filter models based on search
  const filteredModels = searchValue
    ? models.filter(
        (m) =>
          m.id.toLowerCase().includes(searchValue.toLowerCase()) ||
          m.name.toLowerCase().includes(searchValue.toLowerCase())
      )
    : models

  // Check if the search value is a custom model (not in the list)
  const isCustomModel = searchValue && !models.some((m) => m.id === searchValue)

  const handleSelect = (modelId: string) => {
    onChange(modelId)
    setOpen(false)
    setSearchValue('')
  }

  const handleCreateCustom = () => {
    if (searchValue.trim()) {
      onChange(searchValue.trim())
      setOpen(false)
      setSearchValue('')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="justify-between font-mono text-sm"
        >
          {value ? (selectedModel?.id || value) : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="end" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search models..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Loading models...
              </div>
            ) : filteredModels.length === 0 && !isCustomModel ? (
              <CommandEmpty>No models found.</CommandEmpty>
            ) : (
              <>
                {/* Custom model option */}
                {isCustomModel && (
                  <>
                    <CommandGroup heading="Custom Model">
                      <CommandItem
                        value={searchValue}
                        onSelect={handleCreateCustom}
                        className="cursor-pointer"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        <span>Use custom: </span>
                        <span className="font-mono font-medium">{searchValue}</span>
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

                {/* Available models */}
                <CommandGroup heading="Available Models">
                  {filteredModels.slice(0, 50).map((model) => (
                    <CommandItem
                      key={model.id}
                      value={model.id}
                      onSelect={() => handleSelect(model.id)}
                      className={cn(
                        'cursor-pointer',
                        value === model.id && 'bg-primary/10 text-primary'
                      )}
                    >
                      <span className="font-mono text-sm">{model.id}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>

                {filteredModels.length > 50 && (
                  <div className="py-2 text-center text-xs text-muted-foreground">
                    Showing 50 of {filteredModels.length} models. Type to filter.
                  </div>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
