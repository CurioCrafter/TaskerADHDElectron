import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User } from '@/types'

interface AuthState {
  // State
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  // Actions
  setUser: (user: User) => void
  setToken: (token: string) => void
  clearAuth: () => void
  checkAuth: () => Promise<void>
  requestMagicLink: (email: string) => Promise<{ success: boolean; error?: string; devMode?: boolean; magicLink?: string }>
  verifyMagicLink: (token: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Set user
      setUser: (user: User) => {
        set({ 
          user, 
          isAuthenticated: true, 
          error: null 
        })
      },

      // Set auth token
      setToken: (token: string) => {
        set({ token })
      },

      // Clear authentication
      clearAuth: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null
        })
      },

      // Check authentication status
      checkAuth: async () => {
        const { token } = get()
        
        if (!token) {
          set({ isLoading: false, isAuthenticated: false })
          return
        }

        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (response.ok) {
            const data = await response.json()
            set({
              user: data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null
            })
          } else {
            // In development, don't clear auth for 401 errors
            if (process.env.NODE_ENV === 'development') {
              console.log('Dev mode: Ignoring 401 auth error')
              set({
                user: { 
                  id: 'dev-user', 
                  email: 'dev@taskeradhd.local',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                },
                isAuthenticated: true,
                isLoading: false,
                error: null
              })
            } else {
              // Token is invalid, clear auth
              get().clearAuth()
              set({ isLoading: false })
            }
          }
        } catch (error) {
          console.error('Auth check failed:', error)
          set({
            isLoading: false,
            error: 'Failed to verify authentication'
          })
        }
      },

      // Request magic link
      requestMagicLink: async (email: string) => {
        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`${API_URL}/api/auth/magic-link/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
          })

          const data = await response.json()

          if (response.ok) {
            set({ isLoading: false })
            return { 
              success: true,
              devMode: data.devMode,
              magicLink: data.magicLink
            }
          } else {
            set({ 
              isLoading: false, 
              error: data.error || 'Failed to send magic link' 
            })
            return { 
              success: false, 
              error: data.error || 'Failed to send magic link' 
            }
          }
        } catch (error) {
          const errorMessage = 'Network error. Please check your connection.'
          set({ isLoading: false, error: errorMessage })
          return { success: false, error: errorMessage }
        }
      },

      // Verify magic link token
      verifyMagicLink: async (token: string) => {
        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`${API_URL}/api/auth/magic-link/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
          })

          const data = await response.json()

          if (response.ok) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              error: null
            })
            return { success: true }
          } else {
            set({ 
              isLoading: false, 
              error: data.error || 'Invalid or expired magic link' 
            })
            return { 
              success: false, 
              error: data.error || 'Invalid or expired magic link' 
            }
          }
        } catch (error) {
          const errorMessage = 'Network error. Please check your connection.'
          set({ isLoading: false, error: errorMessage })
          return { success: false, error: errorMessage }
        }
      },

      // Logout
      logout: () => {
        // Call logout endpoint (optional since JWT is stateless)
        fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${get().token}`,
            'Content-Type': 'application/json'
          }
        }).catch(() => {
          // Ignore errors on logout
        })

        // Clear local state
        get().clearAuth()
      }
    }),
    {
      name: 'taskeradhd-auth',
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      ),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated
      }),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migration between versions if needed
        if (version === 0) {
          // Clear old data if structure changed
          return {
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          }
        }
        return persistedState
      }
    }
  )
)

// Helper function to get auth headers for API calls
export const getAuthHeaders = (): Record<string, string> => {
  const { token } = useAuthStore.getState()
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

// Helper function to check if user is authenticated
export const isAuthenticated = () => {
  return useAuthStore.getState().isAuthenticated
}

// Helper function to get current user
export const getCurrentUser = () => {
  return useAuthStore.getState().user
}
