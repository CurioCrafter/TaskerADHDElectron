'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useSettingsStore } from '@/stores/settings'

export function CurrentTimeDisplay() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [timezone, setTimezone] = useState<string>('')
  const { debugMode } = useSettingsStore()

  useEffect(() => {
    // Get system timezone
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    
    // Update time every second
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Get timezone from localStorage or use system timezone
  useEffect(() => {
    const savedTimezone = localStorage.getItem('userTimezone')
    if (savedTimezone) {
      setTimezone(savedTimezone)
    }
  }, [])

  const formatTimeWithTimezone = (date: Date, tz: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date)
    } catch (error) {
      // Fallback to local time if timezone is invalid
      return format(date, 'HH:mm:ss')
    }
  }

  const formatDateWithTimezone = (date: Date, tz: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }).format(date)
    } catch (error) {
      return format(date, 'EEE, MMM d, yyyy')
    }
  }

  if (debugMode) {
    console.log('🔧 [TIME DISPLAY] Current timezone:', timezone)
  }

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <div className="font-mono text-lg font-semibold text-primary-600 dark:text-primary-400">
            {formatTimeWithTimezone(currentTime, timezone)}
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            {formatDateWithTimezone(currentTime, timezone)}
          </div>
        </div>
        <div className="text-gray-500 dark:text-gray-500 text-xs">
          {timezone.replace('_', ' ')}
        </div>
      </div>
    </div>
  )
}
