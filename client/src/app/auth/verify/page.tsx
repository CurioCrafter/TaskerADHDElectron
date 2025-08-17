'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { LoadingSpinner } from '@/components/ui/loading'
import { toast } from 'react-hot-toast'

// Force dynamic rendering to avoid prerendering with useSearchParams
export const dynamic = 'force-dynamic'

export default function VerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { verifyMagicLink, isAuthenticated } = useAuthStore()
  
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    
    if (!token) {
      setStatus('error')
      setError('No verification token found in URL')
      return
    }

    const verify = async () => {
      try {
        const result = await verifyMagicLink(token)
        
        if (result.success) {
          setStatus('success')
          toast.success('Successfully logged in!')
          
          // Redirect after a brief success message
          setTimeout(() => {
            router.replace('/dashboard')
          }, 1500)
        } else {
          setStatus('error')
          setError(result.error || 'Invalid or expired magic link')
          toast.error(result.error || 'Invalid or expired magic link')
        }
      } catch (error) {
        setStatus('error')
        setError('Failed to verify magic link')
        toast.error('Failed to verify magic link')
      }
    }

    verify()
  }, [searchParams, verifyMagicLink, router])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && status === 'success') {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, status, router])

  const handleReturnToLogin = () => {
    router.push('/auth/login')
  }

  if (status === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-calm">
        <div className="text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Verifying your magic link...
          </h1>
          <p className="text-gray-600">
            Please wait while we log you in securely
          </p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-calm">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Welcome to TaskerADHD! 🎯
          </h1>
          <p className="text-gray-600 mb-4">
            You're all set! Redirecting to your dashboard...
          </p>
          <div className="flex items-center justify-center space-x-2">
            <LoadingSpinner size="sm" />
            <span className="text-sm text-gray-500">Preparing your workspace</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-calm px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Verification Failed
          </h1>
          
          <p className="text-gray-600 mb-6">
            {error}
          </p>

          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-amber-900 mb-2">
                Common reasons:
              </h3>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• The magic link has expired (15 minutes)</li>
                <li>• The link has already been used</li>
                <li>• The URL was copied incorrectly</li>
              </ul>
            </div>

            <button
              onClick={handleReturnToLogin}
              className="btn-primary w-full"
            >
              Request a new magic link
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            Need help? The magic link should be used within 15 minutes 
            and can only be used once for security.
          </p>
        </div>
      </div>
    </div>
  )
}
