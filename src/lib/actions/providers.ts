'use server'

import { fetchProviderModels } from '@/lib/providers'
import type { ProviderName } from '@/lib/providers/types'

export async function getModelsForProvider(providerName: string): Promise<string[]> {
  try {
    return await fetchProviderModels(providerName as ProviderName)
  } catch (error) {
    console.error(`Failed to fetch models for provider ${providerName}:`, error)
    return []
  }
}
