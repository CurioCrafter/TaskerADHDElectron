'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/components/providers'

export function ThemeToggle() {
  const { theme, setTheme, focusMode, setFocusMode } = useTheme()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const themeOptions = [
    {
      id: 'light',
      icon: '🌞',
      label: 'Light Mode',
      description: 'Bright interface for well-lit environments'
    },
    {
      id: 'dark',
      icon: '🌙',
      label: 'Dark Mode',
      description: 'Dark interface to reduce eye strain'
    },
    {
      id: 'low-stim',
      icon: '🧘',
      label: 'Low Stimulation',
      description: 'Minimal colors and contrast for sensory sensitivity'
    }
  ]

  const getCurrentThemeIcon = () => {
    const currentOption = themeOptions.find(option => option.id === theme)
    return currentOption?.icon || '🌞'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Theme Toggle Button */}
      <button
        className="btn-ghost flex items-center space-x-1"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label="Theme and accessibility options"
        title="Theme and accessibility options"
      >
        <span>{getCurrentThemeIcon()}</span>
        {focusMode && <span className="text-xs">🎯</span>}
        <span className="text-xs">▼</span>
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-3">
            {/* Theme Selection */}
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Visual Theme
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => {
                      setTheme(option.id as any)
                      setShowDropdown(false)
                    }}
                    className={`p-2 rounded-lg border text-center transition-all group relative ${
                      theme === option.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                    title={option.description}
                  >
                    <div className="text-lg mb-1">{option.icon}</div>
                    <div className="text-xs font-medium">{option.label}</div>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      {option.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Focus Mode Toggle */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Focus Mode
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Minimizes distractions and emphasizes current task
                    </div>
                  </div>
                </div>
                
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={focusMode}
                    onChange={(e) => setFocusMode(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${
                    focusMode 
                      ? 'bg-primary-600' 
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}>
                    <div className={`w-4 h-4 bg-white rounded-full transition-transform transform ${
                      focusMode ? 'translate-x-6' : 'translate-x-1'
                    } mt-1`} />
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    {focusMode ? 'Disable focus mode' : 'Enable focus mode - hides non-essential UI elements'}
                  </div>
                </div>
              </label>
            </div>

            {/* Quick Actions */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Quick Actions:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setTheme('dark')
                      setFocusMode(true)
                      setShowDropdown(false)
                    }}
                    className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Enable dark mode + focus mode for deep work"
                  >
                    🌙🎯 Deep Work
                  </button>
                  <button
                    onClick={() => {
                      setTheme('low-stim')
                      setFocusMode(false)
                      setShowDropdown(false)
                    }}
                    className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Enable low-stim mode for sensory comfort"
                  >
                    🧘 Calm Mode
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
