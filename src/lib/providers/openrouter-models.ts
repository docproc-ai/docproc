'use server'

import { unstable_cache } from 'next/cache'

export interface OpenRouterModel {
  id: string
  name: string
  description: string
  context_length: number
  architecture: {
    modality: string
    input_modalities: string[]
    output_modalities: string[]
  }
  pricing: {
    prompt: string
    completion: string
  }
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[]
}

async function fetchOpenRouterModelsUncached(): Promise<OpenRouterModel[]> {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not set, returning empty model list')
    return []
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      console.error('Failed to fetch OpenRouter models:', response.statusText)
      return []
    }

    const data: OpenRouterModelsResponse = await response.json()
    return data.data || []
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error)
    return []
  }
}

// Cache the models for 1 hour
export const fetchOpenRouterModels = unstable_cache(
  fetchOpenRouterModelsUncached,
  ['openrouter-models'],
  { revalidate: 3600 }
)

// Get models that support vision (image input)
export async function getOpenRouterVisionModels(): Promise<OpenRouterModel[]> {
  const models = await fetchOpenRouterModels()
  return models.filter((model) => model.architecture.input_modalities.includes('image'))
}

// Get just the model IDs for simpler usage
export async function getOpenRouterModelIds(): Promise<string[]> {
  const models = await fetchOpenRouterModels()
  return models.map((model) => model.id)
}

// Get vision model IDs only
export async function getOpenRouterVisionModelIds(): Promise<string[]> {
  const models = await getOpenRouterVisionModels()
  return models.map((model) => model.id)
}
