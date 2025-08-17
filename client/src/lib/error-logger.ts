/**
 * Global error logging and handling utilities
 */

// Global error handler for unhandled errors
export function setupGlobalErrorHandling() {
  if (typeof window !== 'undefined') {
    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      console.group('🚨 GLOBAL ERROR CAUGHT')
      console.error('Error:', event.error)
      console.error('Message:', event.message)
      console.error('Filename:', event.filename)
      console.error('Line:', event.lineno)
      console.error('Column:', event.colno)
      console.error('Stack:', event.error?.stack)
      console.error('Event:', event)
      console.groupEnd()
      
      // Check for length-related errors
      if (event.message?.includes('length') || event.error?.message?.includes('length')) {
        console.error('🚨 LENGTH-RELATED ERROR DETECTED:', {
          message: event.message,
          stack: event.error?.stack,
          possibleCauses: [
            'Array access on undefined/null',
            'String method on undefined/null',
            'Missing array validation',
            'Type mismatch in data'
          ]
        })
      }
    })

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.group('🚨 UNHANDLED PROMISE REJECTION')
      console.error('Reason:', event.reason)
      console.error('Promise:', event.promise)
      console.error('Event:', event)
      console.groupEnd()
      
      // Check for length-related promise rejections
      if (event.reason?.message?.includes('length')) {
        console.error('🚨 PROMISE REJECTION WITH LENGTH ERROR:', {
          reason: event.reason,
          stack: event.reason?.stack,
          possibleCauses: [
            'Async array operations on undefined',
            'API response format mismatch',
            'Store state corruption'
          ]
        })
      }
    })

    // Log startup info
    console.group('🔧 TASKERADHD ERROR LOGGING INITIALIZED')
    console.log('Timestamp:', new Date().toISOString())
    console.log('User Agent:', navigator.userAgent)
    console.log('Environment:', process.env.NODE_ENV)
    console.log('Error boundary active: ✅')
    console.log('Global error handlers: ✅')
    console.groupEnd()
  }
}

// Utility to safely access array/string properties
export const safeAccess = {
  length: (item: any): number => {
    try {
      if (item == null) return 0
      if (typeof item === 'string' || Array.isArray(item)) {
        return item.length
      }
      return 0
    } catch (error) {
      console.error('🚨 safeAccess.length error:', error, { item })
      return 0
    }
  },
  
  arrayAt: (array: any[], index: number): any => {
    try {
      if (!Array.isArray(array) || array.length === 0) return undefined
      if (index < 0 || index >= array.length) return undefined
      return array[index]
    } catch (error) {
      console.error('🚨 safeAccess.arrayAt error:', error, { array, index })
      return undefined
    }
  },
  
  property: (obj: any, prop: string): any => {
    try {
      if (obj == null || typeof obj !== 'object') return undefined
      return obj[prop]
    } catch (error) {
      console.error('🚨 safeAccess.property error:', error, { obj, prop })
      return undefined
    }
  }
}

// Log function for debugging
export function debugLog(message: string, ...args: any[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔧 [DEBUG] ${message}`, ...args)
  }
}
