'use client'

import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/stores/settings'

export function DebugToggle() {
  const { debugMode, toggleDebugMode } = useSettingsStore()
  const [mounted, setMounted] = useState(false)

  // Ensure component is mounted to avoid hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <button className="px-3 py-1 text-sm rounded transition-colors bg-gray-100 text-gray-600 border border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600">
        🔧 Debug
      </button>
    )
  }

  return (
    <button
      onClick={toggleDebugMode}
      className={`
        px-3 py-1 text-sm rounded transition-colors
        ${debugMode 
          ? 'bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700' 
          : 'bg-gray-100 text-gray-600 border border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
        }
        hover:opacity-80
      `}
      title="Toggle debug mode"
    >
      🔧 Debug {debugMode ? 'ON' : 'OFF'}
    </button>
  )
}
