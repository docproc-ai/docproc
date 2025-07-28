export const ANTHROPIC_MODELS = [
  'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20241022',
  'claude-3-7-sonnet-20250219',
  'claude-3-sonnet-20240229',
  'claude-3-opus-20240229',
] as const

export type AnthropicModel = (typeof ANTHROPIC_MODELS)[number]

export const DEFAULT_MODEL: AnthropicModel = 'claude-3-5-haiku-20241022'
