import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

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

// Response schemas
const modelResponse = z.object({
  id: z.string(),
  name: z.string(),
  contextLength: z.number(),
  pricing: z
    .object({
      prompt: z.string(),
      completion: z.string(),
    })
    .optional(),
})

const searchModelResponse = z.object({
  id: z.string(),
  name: z.string(),
  contextLength: z.number(),
})

// Route definitions
const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Models'],
  summary: 'List all vision-capable models',
  description:
    'Returns models filtered for document processing (image input support)',
  responses: {
    200: {
      description: 'List of vision-capable models',
      content: { 'application/json': { schema: z.array(modelResponse) } },
    },
  },
})

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['Models'],
  summary: 'Search models by query',
  request: {
    query: z.object({
      q: z.string().optional().openapi({ description: 'Search query' }),
    }),
  },
  responses: {
    200: {
      description: 'Filtered list of models',
      content: { 'application/json': { schema: z.array(searchModelResponse) } },
    },
  },
})

// Create router and register routes
const app = new OpenAPIHono()

  .openapi(listRoute, async (c) => {
    const models = await fetchOpenRouterModels()

    const visionModels = models.filter((model) =>
      model.architecture?.input_modalities?.includes('image'),
    )

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

  .openapi(searchRoute, async (c) => {
    const { q } = c.req.valid('query')
    const models = await fetchOpenRouterModels()

    let visionModels = models.filter((model) =>
      model.architecture?.input_modalities?.includes('image'),
    )

    if (q) {
      const query = q.toLowerCase()
      visionModels = visionModels.filter(
        (model) =>
          model.id.toLowerCase().includes(query) ||
          model.name.toLowerCase().includes(query),
      )
    }

    const result = visionModels.map((model) => ({
      id: model.id,
      name: model.name,
      contextLength: model.context_length,
    }))

    return c.json(result)
  })

export default app
