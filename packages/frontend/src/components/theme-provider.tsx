import { createContext, useContext, useEffect } from 'react'
import { useLocalStorage, useMedia } from 'react-use'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useLocalStorage<Theme>('docproc:theme', 'system')
  const prefersDark = useMedia('(prefers-color-scheme: dark)', false)

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (prefersDark ? 'dark' : 'light') : (theme ?? 'light')

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(resolvedTheme)
  }, [resolvedTheme])

  const toggleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system']
    const currentIdx = themes.indexOf(theme ?? 'system')
    setTheme(themes[(currentIdx + 1) % themes.length])
  }

  return (
    <ThemeContext.Provider
      value={{ theme: theme ?? 'system', resolvedTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
