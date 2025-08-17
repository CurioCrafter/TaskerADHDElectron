'use client'

import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('🚨 Error Boundary caught an error:', error)
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Error Boundary - Component Stack:', errorInfo.componentStack)
    console.error('🚨 Error Boundary - Error Details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })

    this.setState({
      error,
      errorInfo
    })

    // Log to console for debugging
    console.group('🚨 RUNTIME ERROR DETAILS')
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    console.error('Props:', this.props)
    console.error('State:', this.state)
    console.groupEnd()
  }

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props
      const { error } = this.state

      if (Fallback && error) {
        return <Fallback error={error} reset={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })} />
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="text-4xl mb-4">🚨</div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                A runtime error occurred. Check the console for details.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-4">
                  <summary className="cursor-pointer text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Error Details (Development)
                  </summary>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-auto max-h-32">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
              
              <div className="space-y-2">
                <button
                  onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                  className="w-full btn-primary"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full btn-ghost"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    console.error('🚨 useErrorHandler caught error:', error)
    console.error('🚨 Error context:', errorInfo)
    
    // In development, also log to console with stack trace
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 DETAILED ERROR INFORMATION')
      console.error('Error Object:', error)
      console.error('Error Message:', error.message)
      console.error('Error Stack:', error.stack)
      console.error('Context:', errorInfo)
      console.error('Timestamp:', new Date().toISOString())
      console.groupEnd()
    }
  }
}
