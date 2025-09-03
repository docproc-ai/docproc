export interface AIProvider {
  name: string
  models: readonly string[]
  defaultModel: string
  getModel: (modelName: string) => any
}

export interface ModelInfo {
  id: string
  provider: string
  displayName?: string
}

export type ProviderName = 'anthropic' | 'openrouter'