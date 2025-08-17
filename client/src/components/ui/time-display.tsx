'use client'

import { useState, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'

interface TimeDisplayProps {
  className?: string
  showDate?: boolean
  showTimezone?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function TimeDisplay({ 
  className = '', 
  showDate = true, 
  showTimezone = true,
  size = 'md' 
}: TimeDisplayProps) {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [mounted, setMounted] = useState(false)
  const { timeFormat } = useSettingsStore()

  useEffect(() => {
    // Set initial time only on client to prevent hydration mismatch
    setCurrentTime(new Date())
    setMounted(true)
    
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Show placeholder until mounted to prevent hydration mismatch
  if (!mounted || !currentTime) {
    return <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${getSizeClasses(size)} ${className}`} />
  }

  const formatTime = (date: Date) => {
    try {
      const is24h = timeFormat === '24h'
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: !is24h
      })
    } catch (error) {
      console.error('Time formatting error:', error)
      return '--:--:--'
    }
  }

  const formatDate = (date: Date) => {
    try {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    } catch (error) {
      console.error('Date formatting error:', error)
      return '-- -- --'
    }
  }

  const getTimezone = () => {
    try {
      if (typeof window !== 'undefined') {
        const savedTimezone = localStorage.getItem('userTimezone')
        if (savedTimezone) return savedTimezone
      }
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    } catch (error) {
      console.error('Timezone error:', error)
      return 'UTC'
    }
  }

  const sizeClasses = getSizeClasses(size)
  const textClasses = getTextClasses(size)

  return (
    <div className={`${sizeClasses} ${className}`}>
      <div className={`font-mono ${textClasses} text-gray-900 dark:text-gray-100`}>
        {formatTime(currentTime)}
      </div>
      {showDate && (
        <div className={`text-gray-600 dark:text-gray-400 ${getDateTextClasses(size)}`}>
          {formatDate(currentTime)}
        </div>
      )}
      {showTimezone && (
        <div className={`text-gray-500 dark:text-gray-500 ${getTimezoneTextClasses(size)}`}>
          {getTimezone().replace('_', ' ')}
        </div>
      )}
    </div>
  )
}

function getSizeClasses(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm': return 'p-2'
    case 'md': return 'p-3'
    case 'lg': return 'p-4'
  }
}

function getTextClasses(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm': return 'text-sm'
    case 'md': return 'text-base'
    case 'lg': return 'text-xl'
  }
}

function getDateTextClasses(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm': return 'text-xs'
    case 'md': return 'text-sm'
    case 'lg': return 'text-base'
  }
}

function getTimezoneTextClasses(size: 'sm' | 'md' | 'lg') {
  switch (size) {
    case 'sm': return 'text-xs'
    case 'md': return 'text-xs'
    case 'lg': return 'text-sm'
  }
}
