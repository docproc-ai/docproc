'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSettings, ANTHROPIC_MODELS } from '@/hooks/use-settings'
import { SettingsIcon } from 'lucide-react'

export function SettingsDialog() {
  const { model, setModel, isLoaded } = useSettings()
  const [localModel, setLocalModel] = useState(ANTHROPIC_MODELS[2])
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (isLoaded) {
      setLocalModel(model)
    }
  }, [model, isLoaded, isOpen])

  const handleSave = () => {
    setModel(localModel)
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <SettingsIcon className="h-4 w-4" />
          <span className="sr-only">Open Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your Anthropic API key and model preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select value={localModel} onValueChange={setLocalModel}>
              <SelectTrigger id="model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {ANTHROPIC_MODELS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleSave}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
