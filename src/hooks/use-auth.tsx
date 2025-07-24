'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

interface User {
  id: string
  name: string
  email: string
  role?: string
  image?: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const session = await authClient.getSession()
        if (session.data?.user) {
          setUser(session.data.user as User)
        }
      } catch (error) {
        console.error('Error checking session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authClient.signIn.email({
        email,
        password,
      })

      if (result.data?.user) {
        // After successful sign-in, fetch complete user data with session
        try {
          const session = await authClient.getSession()
          if (session.data?.user) {
            setUser(session.data.user as User) // This should include role
          } else {
            setUser(result.data.user as User) // Fallback to sign-in response
          }
        } catch (sessionError) {
          console.error('Error fetching session after sign-in:', sessionError)
          setUser(result.data.user as User) // Fallback to sign-in response
        }

        return { success: true }
      } else {
        return { success: false, error: result.error?.message || 'Sign in failed' }
      }
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred' }
    }
  }

  const signOut = async () => {
    try {
      await authClient.signOut()
      setUser(null)
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    signIn,
    signOut,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
