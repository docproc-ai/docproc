import { createOpenRouter } from '@openrouter/ai-sdk-provider'
// import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { AIProvider } from './types'

export const OPENROUTER_MODELS = [
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-3.7-sonnet',
  'anthropic/claude-opus-4',
  'anthropic/claude-opus-4.1',
  'anthropic/claude-sonnet-4',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-pro',
  'google/gemma-3-12b-it',
  'google/gemma-3-27b-it',
  'google/gemma-3-4b-it',
  'google/gemma-3n-e4b-it',
  'meta-llama/llama-3.2-11b-vision-instruct',
  'meta-llama/llama-3.2-90b-vision-instruct',
  'meta-llama/llama-4-maverick',
  'meta-llama/llama-4-scout',
  'meta-llama/llama-guard-4-12b',
  'mistralai/mistral-medium-3',
  'mistralai/mistral-medium-3.1',
  'mistralai/mistral-small-3.1-24b-instruct',
  'mistralai/mistral-small-3.2-24b-instruct',
  'mistralai/pixtral-12b',
  'mistralai/pixtral-large-2411',
  'openai/gpt-4-turbo',
  'openai/gpt-4.1',
  'openai/gpt-4.1-mini',
  'openai/gpt-4.1-nano',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-5',
  'openai/gpt-5-chat',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
  'openai/o4-mini',
  'openai/o4-mini-high',
] as const

export type OpenRouterModel = (typeof OPENROUTER_MODELS)[number]

export const DEFAULT_OPENROUTER_MODEL: OpenRouterModel = 'anthropic/claude-3.5-haiku'

const openrouterClient = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
})

// const openrouterClient = createOpenAICompatible({
//   name: 'OpenRouter',
//   apiKey: process.env.OPENROUTER_API_KEY || '',
//   baseURL: 'https://openrouter.ai/api/v1',
// })

export const openrouterProvider: AIProvider = {
  name: 'OpenRouter',
  models: OPENROUTER_MODELS,
  defaultModel: DEFAULT_OPENROUTER_MODEL,
  getModel: (modelName: string) => openrouterClient(modelName),
}
