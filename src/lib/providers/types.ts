export interface AIProvider {
  name: string
  models: readonly string[]
  defaultModel: string
  getModel: (modelName: string) => any
  // Optional async function to fetch models dynamically
  fetchModels?: () => Promise<string[]>
}

export interface ModelInfo {
  id: string
  provider: string
  displayName?: string
}

export interface ProviderInfo {
  name: ProviderName
  displayName: string
  models: string[]
  supportsDynamicModels: boolean
}

export type ProviderName = 'anthropic' | 'openrouter'