'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { LoadingSpinner } from '@/components/ui/loading'

export default function HomePage() {
  const router = useRouter()
  const { setUser, setToken } = useAuthStore()

  useEffect(() => {
    // Development bypass - automatically log in with a dev user
    const devUser = {
      id: 'dev-user-1',
      email: 'dev@taskeradhd.local',
      displayName: 'Dev User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    const devToken = 'dev-token-bypass'
    
    // Set user and token
    setUser(devUser)
    setToken(devToken)
    
    // Redirect to dashboard
    router.replace('/dashboard')
  }, [setUser, setToken, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-calm">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🎯 TaskerADHD
          </h1>
          <p className="text-lg text-gray-600">
            ADHD-friendly task management
          </p>
        </div>
        
        <LoadingSpinner size="lg" />
        
        <p className="mt-4 text-gray-500">
          Setting up your workspace...
        </p>
      </div>
    </div>
  )
}
