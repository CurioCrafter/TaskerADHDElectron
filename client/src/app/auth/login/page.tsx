'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { LoadingButton } from '@/components/ui/loading'
import { toast } from 'react-hot-toast'
import { clsx } from 'clsx'

export default function LoginPage() {
  const router = useRouter()
  const { 
    isAuthenticated, 
    isLoading, 
    requestMagicLink,
    error: authError 
  } = useAuthStore()

  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [formError, setFormError] = useState('')
  const [devMagicLink, setDevMagicLink] = useState('')

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    
    if (!email.trim()) {
      setFormError('Please enter your email address')
      return
    }

    if (!email.includes('@')) {
      setFormError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await requestMagicLink(email.trim().toLowerCase())
      
      if (result.success) {
        setEmailSent(true)
        if (result.devMode && result.magicLink) {
          setDevMagicLink(result.magicLink)
          toast.success('Development mode: Magic link ready!')
        } else {
          toast.success('Magic link sent! Check your email.')
        }
      } else {
        setFormError(result.error || 'Failed to send magic link')
        toast.error(result.error || 'Failed to send magic link')
      }
    } catch (error) {
      const errorMessage = 'Something went wrong. Please try again.'
      setFormError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTryAnotherEmail = () => {
    setEmailSent(false)
    setEmail('')
    setFormError('')
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-calm px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Check your email
              </h1>
              <p className="text-gray-600">
                We've sent a magic link to <strong>{email}</strong>
              </p>
            </div>

            <div className="space-y-4">
              {devMagicLink ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-green-900 mb-2">
                    🚀 Development Mode
                  </h3>
                  <p className="text-sm text-green-800 mb-3">
                    Click the button below to log in instantly (no email required in dev mode):
                  </p>
                  <a
                    href={devMagicLink}
                    className="btn-primary w-full text-center"
                  >
                    🎯 Log in to TaskerADHD
                  </a>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    🎯 ADHD-Friendly Login
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• No passwords to remember</li>
                    <li>• Secure one-click access</li>
                    <li>• Link expires in 15 minutes</li>
                  </ul>
                </div>
              )}

              <button
                onClick={handleTryAnotherEmail}
                className="btn-secondary w-full"
              >
                Try another email
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              Didn't receive the email? Check your spam folder or try again.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-calm px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              🎯 TaskerADHD
            </h1>
            <p className="text-gray-600">
              ADHD-friendly task management with voice capture
            </p>
          </div>

          {/* Features highlight */}
          <div className="bg-gradient-energy rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">
              ✨ Designed for neurodivergent minds
            </h3>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>🎤 Voice-to-task capture</li>
              <li>🧠 ADHD-friendly interface</li>
              <li>⚡ Energy-based task filtering</li>
              <li>🎯 Focus mode & time boxing</li>
            </ul>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={clsx(
                  'input w-full',
                  (formError || authError) && 'input-error'
                )}
                disabled={isSubmitting}
                autoComplete="email"
                autoFocus
              />
              {(formError || authError) && (
                <p className="mt-2 text-sm text-red-600">
                  {formError || authError}
                </p>
              )}
            </div>

            <LoadingButton
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              disabled={!email.trim() || isLoading}
              className="w-full"
            >
              Send Magic Link
            </LoadingButton>
          </form>

          {/* No password explanation */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">
              🔐 Passwordless & Secure
            </h4>
            <p className="text-sm text-gray-600">
              No passwords to remember! We'll send you a secure magic link 
              that logs you in with one click. Perfect for ADHD minds that 
              prefer simple, friction-free experiences.
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-500 mt-8">
            By logging in, you agree to our friendly terms of service and 
            privacy-first approach to your data.
          </p>
        </div>
      </div>
    </div>
  )
}
