'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useSettingsStore } from '@/stores/settings'
import { AppLayout } from '@/components/layout/app-layout'

export default function DebugPage() {
  const { debugMode } = useSettingsStore()
  const [debugInfo, setDebugInfo] = useState<any>({})
  
  // Only log in debug mode (client-side only)
  useEffect(() => {
    if (debugMode) {
      console.log('🔧 [DEBUG] Debug page component loading...')
    }
  }, [debugMode])
  
  useEffect(() => {
    if (!debugMode) return // Only show intrusive notifications if debug mode is ON
    
    console.log('🔧 [DEBUG] Debug page mounted - showing toast')
    
    // EXTREMELY VISIBLE DEBUGGING (only when debug mode is enabled)
    const timestamp = new Date().toTimeString()
    
    toast(`🔧 DEBUG PAGE LOADED: ${timestamp}`, { 
      duration: 15000, 
      icon: '🎯',
      style: { 
        background: '#10b981', 
        color: 'white', 
        fontSize: '18px', 
        fontWeight: 'bold',
        zIndex: 9999,
        border: '3px solid #fff'
      }
    })
    
    // Store in localStorage for debugging
    localStorage.setItem('debugPageLoaded', new Date().toISOString())
    
    // Collect debug information (always available on debug page)
    const info = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pathname: window.location.pathname,
      localStorage: {
        lastNavigation: localStorage.getItem('lastNavigation'),
        lastPageLoad: localStorage.getItem('lastPageLoad'),
      },
      navigator: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      }
    }
    
    setDebugInfo(info)
    console.log('🔧 [DEBUG] Debug info collected:', info)
  }, [debugMode])
  
  // Collect debug information on mount (always, since this is the debug page)
  useEffect(() => {
    const info = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pathname: window.location.pathname,
      localStorage: {
        lastNavigation: localStorage.getItem('lastNavigation'),
        lastPageLoad: localStorage.getItem('lastPageLoad'),
      },
      navigator: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      }
    }
    
    setDebugInfo(info)
  }, [])
  
  return (
    <AppLayout title="Debug Information">
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            <strong>✅ SUCCESS!</strong> Debug page loaded successfully. This proves navigation is working!
          </div>
          
          <h1 className="text-3xl font-bold mb-6">Debug Information</h1>
          
          <div className="grid gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <h2 className="text-xl font-semibold mb-4">Navigation Test</h2>
              <p className="text-green-600 font-medium">✅ You successfully navigated to the debug page!</p>
              <p className="text-sm text-gray-600 mt-2">
                This means React Router navigation is working correctly.
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <h2 className="text-xl font-semibold mb-4">Debug Information</h2>
              <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <h2 className="text-xl font-semibold mb-4">Console Tests</h2>
              <div className="space-y-2">
                <button 
                  className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
                  onClick={() => {
                    console.log('🔧 [DEBUG] Button click test - this should appear in console')
                    toast('Button clicked - check console!', { icon: '🎯' })
                  }}
                >
                  Test Console Logging
                </button>
                
                <button 
                  className="bg-purple-500 text-white px-4 py-2 rounded mr-2"
                  onClick={() => {
                    toast('Test Toast Message!', { 
                      duration: 3000,
                      icon: '🧪',
                      style: { background: '#8b5cf6', color: 'white' }
                    })
                  }}
                >
                  Test Toast Messages
                </button>
                
                <button 
                  className="bg-red-500 text-white px-4 py-2 rounded"
                  onClick={() => {
                    console.error('🔧 [DEBUG] Test error log')
                    alert('Test alert dialog - this should work!')
                  }}
                >
                  Test Error & Alert
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
