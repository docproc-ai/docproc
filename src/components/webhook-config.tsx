'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Trash2, Plus, Eye, EyeOff, ChevronDown, Pencil } from 'lucide-react'
import type { DocumentWebhookConfig, DocumentWebhookEventConfig, DocumentWebhookHeader } from '@/lib/webhook-encryption'

interface WebhookConfigComponentProps {
  config: DocumentWebhookConfig | null
  onChange: (config: DocumentWebhookConfig | null) => void
}

const eventDescriptions = {
  'document.uploaded': 'Triggered when a document is first uploaded',
  'document.processed': 'Triggered when AI processing completes',
  'document.approved': 'Triggered when a document is approved by a user',
  'document.unapproved': 'Triggered when an approved document is recalled/unapproved'
}

const DEFAULT_EVENT_CONFIG: DocumentWebhookEventConfig = {
  enabled: false,
  url: '',
  method: 'POST',
  headers: []
}

export function WebhookConfigComponent({ config, onChange }: WebhookConfigComponentProps) {
  const [currentConfig, setCurrentConfig] = useState<DocumentWebhookConfig>(
    config || { events: {} }
  )

  useEffect(() => {
    onChange(currentConfig.events && Object.keys(currentConfig.events).length > 0 ? currentConfig : null)
  }, [currentConfig, onChange])

  const updateEventConfig = (eventName: keyof DocumentWebhookConfig['events'], eventConfig: DocumentWebhookEventConfig) => {
    setCurrentConfig((prev: DocumentWebhookConfig) => ({
      ...prev,
      events: {
        ...prev.events,
        [eventName]: eventConfig
      }
    }))
  }

  const addHeader = (eventName: keyof DocumentWebhookConfig['events']) => {
    const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
    updateEventConfig(eventName, {
      ...eventConfig,
      headers: [
        ...eventConfig.headers,
        { name: '', value: '', sensitive: false }
      ]
    })
  }

  const updateHeader = (
    eventName: keyof DocumentWebhookConfig['events'], 
    headerIndex: number, 
    header: DocumentWebhookHeader
  ) => {
    const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
    const newHeaders = [...eventConfig.headers]
    newHeaders[headerIndex] = header
    updateEventConfig(eventName, {
      ...eventConfig,
      headers: newHeaders
    })
  }

  const removeHeader = (eventName: keyof DocumentWebhookConfig['events'], headerIndex: number) => {
    const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
    const newHeaders = eventConfig.headers.filter((_: DocumentWebhookHeader, index: number) => index !== headerIndex)
    updateEventConfig(eventName, {
      ...eventConfig,
      headers: newHeaders
    })
  }

  const addPresetHeader = (eventName: keyof DocumentWebhookConfig['events'], preset: string) => {
    const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
    let header: DocumentWebhookHeader

    switch (preset) {
      case 'api-key':
        header = { name: 'X-API-Key', value: '', sensitive: true }
        break
      case 'bearer':
        header = { name: 'Authorization', value: 'Bearer ', sensitive: true }
        break
      case 'basic':
        header = { name: 'Authorization', value: 'Basic ', sensitive: true }
        break
      default:
        return
    }

    updateEventConfig(eventName, {
      ...eventConfig,
      headers: [...eventConfig.headers, header]
    })
  }

  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto mb-4">
          <div className="text-sm text-muted-foreground">
            Click to configure webhook events (optional)
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-6">
        {(Object.keys(eventDescriptions) as Array<keyof typeof eventDescriptions>).map((eventName) => {
          const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
          const isEnabled = eventConfig.enabled

          return (
            <Card key={eventName} className={isEnabled ? 'border-primary/50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {eventName}
                      {isEnabled && <Badge variant="secondary" className="text-xs">Enabled</Badge>}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {eventDescriptions[eventName]}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(enabled) => 
                      updateEventConfig(eventName, { ...eventConfig, enabled })
                    }
                  />
                </div>
              </CardHeader>

              {isEnabled && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-3 space-y-2">
                      <Label htmlFor={`${eventName}-url`}>Webhook URL</Label>
                      <Input
                        id={`${eventName}-url`}
                        type="url"
                        value={eventConfig.url}
                        onChange={(e) => updateEventConfig(eventName, { ...eventConfig, url: e.target.value })}
                        placeholder="https://api.example.com/webhook"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${eventName}-method`}>Method</Label>
                      <Select 
                        value={eventConfig.method} 
                        onValueChange={(method) => updateEventConfig(eventName, { ...eventConfig, method })}
                      >
                        <SelectTrigger id={`${eventName}-method`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                        <Label className="text-sm font-medium cursor-pointer">Headers</Label>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 mt-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">
                          Add authentication or custom headers for this webhook
                        </div>
                        <div className="flex gap-2">
                          <Select onValueChange={(preset) => addPresetHeader(eventName, preset)}>
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue placeholder="Add preset" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="api-key">API Key</SelectItem>
                              <SelectItem value="bearer">Bearer Token</SelectItem>
                              <SelectItem value="basic">Basic Auth</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addHeader(eventName)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Custom
                          </Button>
                        </div>
                      </div>

                      {eventConfig.headers.map((header, index) => (
                        <HeaderRow
                          key={index}
                          header={header}
                          onChange={(newHeader) => updateHeader(eventName, index, newHeader)}
                          onRemove={() => removeHeader(eventName, index)}
                        />
                      ))}

                      {eventConfig.headers.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded">
                          No headers configured
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              )}
            </Card>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}

interface HeaderRowProps {
  header: DocumentWebhookHeader
  onChange: (header: DocumentWebhookHeader) => void
  onRemove: () => void
}

function HeaderRow({ header, onChange, onRemove }: HeaderRowProps) {
  const [showValue, setShowValue] = useState(!header.sensitive)
  const isPlaceholder = header.sensitive && header.value === '[ENCRYPTED]'
  const isEditing = header.isEditing || false

  const handleEditClick = () => {
    onChange({ 
      ...header, 
      isEditing: true, 
      value: '' 
    })
  }

  const handleCancelEdit = () => {
    onChange({ 
      ...header, 
      isEditing: false, 
      value: '[ENCRYPTED]' 
    })
  }

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Name</Label>
        <Input
          value={header.name}
          onChange={(e) => onChange({ ...header, name: e.target.value })}
          placeholder="Header-Name"
          className="h-8"
        />
      </div>
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Value</Label>
        <div className="relative">
          {isPlaceholder && !isEditing ? (
            <div className="flex gap-1">
              <div className="h-8 px-3 py-2 border border-input bg-muted text-sm rounded-md flex items-center flex-1 text-muted-foreground">
                [ENCRYPTED]
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditClick}
                className="h-8 px-2"
                title="Edit encrypted value"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <>
              <Input
                type={showValue ? 'text' : 'password'}
                value={header.value}
                onChange={(e) => onChange({ ...header, value: e.target.value, isEditing: true })}
                placeholder="Header value"
                className="h-8 pr-16"
              />
              <div className="absolute right-0 top-0 flex">
                {isEditing && isPlaceholder && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={handleCancelEdit}
                    title="Cancel editing"
                  >
                    <span className="text-xs">✕</span>
                  </Button>
                )}
                {header.sensitive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setShowValue(!showValue)}
                  >
                    {showValue ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Sensitive</Label>
        <div className="h-8 flex items-center">
          <Switch
            checked={header.sensitive}
            disabled={isPlaceholder && !isEditing}
            onCheckedChange={(sensitive) => onChange({ 
              ...header, 
              sensitive,
              // Reset editing state when toggling sensitivity
              isEditing: false,
              value: sensitive && !isEditing ? '[ENCRYPTED]' : header.value
            })}
          />
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0 shrink-0"
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}
