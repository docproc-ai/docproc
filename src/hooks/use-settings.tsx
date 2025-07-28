'use client'

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'

interface Settings {
  model: string
}

interface SettingsContextType extends Settings {
  setModel: (model: string) => void
  isLoaded: boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export const ANTHROPIC_MODELS = [
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20240620',
]

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState(ANTHROPIC_MODELS[2]) // Default to Haiku
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const storedModel = localStorage.getItem('anthropic_model')
      if (storedModel && ANTHROPIC_MODELS.includes(storedModel)) setModel(storedModel)
    } catch (error) {
      console.error('Could not access local storage:', error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  const handleSetModel = (newModel: string) => {
    setModel(newModel)
    try {
      localStorage.setItem('anthropic_model', newModel)
    } catch (error) {
      console.error('Could not access local storage:', error)
    }
  }

  return (
    <SettingsContext.Provider value={{ model, setModel: handleSetModel, isLoaded }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
