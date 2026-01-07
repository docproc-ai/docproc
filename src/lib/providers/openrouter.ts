import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { AIProvider } from './types'
import { getOpenRouterVisionModelIds } from './openrouter-models'

// Fallback models in case the API is unavailable
export const OPENROUTER_FALLBACK_MODELS = [
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-3.7-sonnet',
  'anthropic/claude-opus-4',
  'anthropic/claude-sonnet-4',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
] as const

export type OpenRouterModel = string

export const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-3.5-haiku'

const openrouterClient = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

export const openrouterProvider: AIProvider = {
  name: 'OpenRouter',
  models: OPENROUTER_FALLBACK_MODELS,
  defaultModel: DEFAULT_OPENROUTER_MODEL,
  getModel: (modelName: string) => openrouterClient(modelName),
  fetchModels: getOpenRouterVisionModelIds,
}
