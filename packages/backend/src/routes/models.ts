import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const app = new Hono()

// OpenRouter model interface
interface OpenRouterModel {
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

// Cache models for 1 hour
let cachedModels: OpenRouterModel[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  // Return cached if valid
  if (cachedModels && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return cachedModels
  }

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
      return cachedModels || []
    }

    const data: OpenRouterModelsResponse = await response.json()
    cachedModels = data.data || []
    cacheTimestamp = Date.now()
    return cachedModels
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error)
    return cachedModels || []
  }
}

// Get all vision-capable models (filtered for document processing)
app.get('/', async (c) => {
  const models = await fetchOpenRouterModels()

  // Filter to only models that support image input (for document processing)
  const visionModels = models.filter((model) =>
    model.architecture?.input_modalities?.includes('image')
  )

  // Return simplified model list
  const result = visionModels.map((model) => ({
    id: model.id,
    name: model.name,
    contextLength: model.context_length,
    pricing: {
      prompt: model.pricing.prompt,
      completion: model.pricing.completion,
    },
  }))

  return c.json(result)
})

// Search models by query
app.get(
  '/search',
  zValidator('query', z.object({ q: z.string().optional() })),
  async (c) => {
    const { q } = c.req.valid('query')
    const models = await fetchOpenRouterModels()

    // Filter to vision models
    let visionModels = models.filter((model) =>
      model.architecture?.input_modalities?.includes('image')
    )

    // Apply search filter if query provided
    if (q) {
      const query = q.toLowerCase()
      visionModels = visionModels.filter(
        (model) =>
          model.id.toLowerCase().includes(query) ||
          model.name.toLowerCase().includes(query)
      )
    }

    const result = visionModels.map((model) => ({
      id: model.id,
      name: model.name,
      contextLength: model.context_length,
    }))

    return c.json(result)
  }
)

export default app
