import { useState } from 'react'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

export interface WebhookHeader {
  name: string
  value: string
  sensitive: boolean
  isEditing?: boolean
}

export interface WebhookEventConfig {
  enabled: boolean
  url: string
  method: string
  headers: WebhookHeader[]
}

export interface WebhookConfig {
  events: {
    'document.uploaded'?: WebhookEventConfig
    'document.processed'?: WebhookEventConfig
    'document.approved'?: WebhookEventConfig
    'document.unapproved'?: WebhookEventConfig
  }
}

interface WebhookConfigComponentProps {
  config: WebhookConfig | null
  onChange: (config: WebhookConfig | null) => void
}

const eventDescriptions: Record<string, string> = {
  'document.uploaded': 'Triggered when a document is first uploaded',
  'document.processed': 'Triggered when AI processing completes',
  'document.approved': 'Triggered when a document is approved by a user',
  'document.unapproved': 'Triggered when an approved document is recalled',
}

const DEFAULT_EVENT_CONFIG: WebhookEventConfig = {
  enabled: false,
  url: '',
  method: 'POST',
  headers: [],
}

export function WebhookConfigComponent({ config, onChange }: WebhookConfigComponentProps) {
  const [isOpen, setIsOpen] = useState(false)
  const currentConfig = config || { events: {} }

  const updateEventConfig = (eventName: keyof WebhookConfig['events'], eventConfig: WebhookEventConfig) => {
    const newConfig: WebhookConfig = {
      ...currentConfig,
      events: {
        ...currentConfig.events,
        [eventName]: eventConfig,
      },
    }
    // Only emit non-null if there's at least one enabled event
    const hasEnabledEvent = Object.values(newConfig.events).some(e => e?.enabled)
    onChange(hasEnabledEvent ? newConfig : null)
  }

  const addHeader = (eventName: keyof WebhookConfig['events']) => {
    const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
    updateEventConfig(eventName, {
      ...eventConfig,
      headers: [...eventConfig.headers, { name: '', value: '', sensitive: false }],
    })
  }

  const updateHeader = (eventName: keyof WebhookConfig['events'], index: number, header: WebhookHeader) => {
    const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
    const newHeaders = [...eventConfig.headers]
    newHeaders[index] = header
    updateEventConfig(eventName, { ...eventConfig, headers: newHeaders })
  }

  const removeHeader = (eventName: keyof WebhookConfig['events'], index: number) => {
    const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
    const newHeaders = eventConfig.headers.filter((_, i) => i !== index)
    updateEventConfig(eventName, { ...eventConfig, headers: newHeaders })
  }

  const addPresetHeader = (eventName: keyof WebhookConfig['events'], preset: string) => {
    const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
    let header: WebhookHeader

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
      headers: [...eventConfig.headers, header],
    })
  }

  const eventNames = Object.keys(eventDescriptions) as Array<keyof WebhookConfig['events']>
  const enabledCount = eventNames.filter(name => currentConfig.events[name]?.enabled).length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-0 h-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/>
              <path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/>
              <path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/>
            </svg>
            <span>Webhook Configuration</span>
            {enabledCount > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {enabledCount} enabled
              </span>
            )}
          </div>
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
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-4">
        {eventNames.map((eventName) => {
          const eventConfig = currentConfig.events[eventName] || DEFAULT_EVENT_CONFIG
          const isEnabled = eventConfig.enabled

          return (
            <Card key={eventName} className={isEnabled ? 'border-primary/50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {eventName}
                      {isEnabled && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Enabled
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {eventDescriptions[eventName]}
                    </CardDescription>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(enabled: boolean) =>
                      updateEventConfig(eventName, { ...eventConfig, enabled })
                    }
                  />
                </div>
              </CardHeader>

              {isEnabled && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3 space-y-2">
                      <Label htmlFor={`${eventName}-url`} className="text-xs">Webhook URL</Label>
                      <Input
                        id={`${eventName}-url`}
                        type="url"
                        value={eventConfig.url}
                        onChange={(e) =>
                          updateEventConfig(eventName, { ...eventConfig, url: e.target.value })
                        }
                        placeholder="https://api.example.com/webhook"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${eventName}-method`} className="text-xs">Method</Label>
                      <Select
                        value={eventConfig.method}
                        onValueChange={(method) =>
                          updateEventConfig(eventName, { ...eventConfig, method })
                        }
                      >
                        <SelectTrigger id={`${eventName}-method`} className="h-9">
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

                  {/* Headers Section */}
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 h-auto text-xs">
                        <span className="font-medium">Headers ({eventConfig.headers.length})</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m6 9 6 6 6-6"/>
                        </svg>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          Add authentication or custom headers
                        </span>
                        <div className="flex gap-2">
                          <Select onValueChange={(preset) => addPresetHeader(eventName, preset)}>
                            <SelectTrigger className="w-[120px] h-7 text-xs">
                              <SelectValue placeholder="Add preset" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="api-key">API Key</SelectItem>
                              <SelectItem value="bearer">Bearer Token</SelectItem>
                              <SelectItem value="basic">Basic Auth</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => addHeader(eventName)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                              <path d="M5 12h14"/><path d="M12 5v14"/>
                            </svg>
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
                        <div className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded">
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
  header: WebhookHeader
  onChange: (header: WebhookHeader) => void
  onRemove: () => void
}

function HeaderRow({ header, onChange, onRemove }: HeaderRowProps) {
  const [showValue, setShowValue] = useState(!header.sensitive)
  const isEncrypted = header.sensitive && header.value === '[ENCRYPTED]'

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Name</Label>
        <Input
          value={header.name}
          onChange={(e) => onChange({ ...header, name: e.target.value })}
          placeholder="Header-Name"
          className="h-8 text-xs"
        />
      </div>
      <div className="flex-1 space-y-1">
        <Label className="text-xs">Value</Label>
        <div className="relative">
          {isEncrypted ? (
            <div className="flex gap-1">
              <div className="h-8 px-3 py-2 border border-input bg-muted text-xs rounded-md flex items-center flex-1 text-muted-foreground">
                [ENCRYPTED]
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChange({ ...header, value: '', isEditing: true })}
                className="h-8 px-2"
                title="Edit encrypted value"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  <path d="m15 5 4 4"/>
                </svg>
              </Button>
            </div>
          ) : (
            <>
              <Input
                type={showValue ? 'text' : 'password'}
                value={header.value}
                onChange={(e) => onChange({ ...header, value: e.target.value })}
                placeholder="Header value"
                className="h-8 text-xs pr-8"
              />
              {header.sensitive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-8 w-8 p-0"
                  onClick={() => setShowValue(!showValue)}
                >
                  {showValue ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                      <line x1="2" x2="22" y1="2" y2="22"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Sensitive</Label>
        <div className="h-8 flex items-center">
          <Switch
            checked={header.sensitive}
            onCheckedChange={(sensitive: boolean) => onChange({ ...header, sensitive })}
          />
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRemove} className="h-8 w-8 p-0 shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
        </svg>
      </Button>
    </div>
  )
}
