import { anthropicProvider } from './anthropic'
import { openrouterProvider } from './openrouter'
import { AIProvider, ProviderName, ModelInfo } from './types'

export const providers: Record<ProviderName, AIProvider> = {
  anthropic: anthropicProvider,
  openrouter: openrouterProvider,
}

export function getProvider(providerName: ProviderName): AIProvider {
  return providers[providerName]
}

export function getModelProvider(modelName: string): AIProvider | null {
  for (const provider of Object.values(providers)) {
    if (provider.models.includes(modelName as any)) {
      return provider
    }
  }
  return null
}

export function getAllModels(): ModelInfo[] {
  const models: ModelInfo[] = []
  
  for (const [providerName, provider] of Object.entries(providers)) {
    for (const modelId of provider.models) {
      models.push({
        id: modelId,
        provider: providerName,
        displayName: `${provider.name}/${modelId}`,
      })
    }
  }
  
  return models
}

export function getModelForProcessing(
  documentTypeProviderName?: string | null,
  documentTypeModelName?: string | null,
  overrideModel?: string,
): { provider: AIProvider; modelName: string } {
  // If override model is provided, find its provider
  if (overrideModel) {
    const provider = getModelProvider(overrideModel)
    if (provider) {
      return { provider, modelName: overrideModel }
    }
  }
  
  // Use document type's provider and model
  if (documentTypeProviderName && documentTypeModelName) {
    const provider = providers[documentTypeProviderName as ProviderName]
    if (provider && provider.models.includes(documentTypeModelName as any)) {
      return { provider, modelName: documentTypeModelName }
    }
  }
  
  // Fallback: if only model name exists (legacy), try to find provider
  if (documentTypeModelName) {
    const provider = getModelProvider(documentTypeModelName)
    if (provider) {
      return { provider, modelName: documentTypeModelName }
    }
  }
  
  // No defaults - this should cause an error if no provider/model is configured
  throw new Error('No provider or model configured. Please set a provider and model for this document type.')
}

export function getAvailableProviders(): Array<{ name: ProviderName; displayName: string; models: readonly string[] }> {
  return Object.entries(providers).map(([name, provider]) => ({
    name: name as ProviderName,
    displayName: provider.name,
    models: provider.models,
  }))
}

export * from './types'
export * from './anthropic'
export * from './openrouter'