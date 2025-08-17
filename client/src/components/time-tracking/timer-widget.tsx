'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'

interface TimeEntry {
  id: string
  taskId: string
  taskTitle: string
  boardName: string
  startTime: Date
  isRunning: boolean
}

interface TimerWidgetProps {
  isVisible: boolean
  onClose: () => void
  position?: { x: number; y: number }
  onPositionChange?: (position: { x: number; y: number }) => void
}

export function TimerWidget({ isVisible, onClose, position = { x: 20, y: 20 }, onPositionChange }: TimerWidgetProps) {
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isMinimized, setIsMinimized] = useState(false)
  const widgetRef = useRef<HTMLDivElement>(null)

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Load active timer from localStorage
  useEffect(() => {
    const savedActiveTimer = localStorage.getItem('activeTimer')
    if (savedActiveTimer) {
      const parsed = JSON.parse(savedActiveTimer)
      setActiveTimer({
        ...parsed,
        startTime: new Date(parsed.startTime)
      })
    }
  }, [])

  // Sync with localStorage changes (from main time tracking page)
  useEffect(() => {
    const handleStorageChange = () => {
      const savedActiveTimer = localStorage.getItem('activeTimer')
      if (savedActiveTimer) {
        const parsed = JSON.parse(savedActiveTimer)
        setActiveTimer({
          ...parsed,
          startTime: new Date(parsed.startTime)
        })
      } else {
        setActiveTimer(null)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    const interval = setInterval(handleStorageChange, 1000) // Check every second
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  // Dragging functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!widgetRef.current) return
    
    const rect = widgetRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setIsDragging(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      }
      
      // Keep widget within screen bounds
      const maxX = window.innerWidth - 300 // widget width
      const maxY = window.innerHeight - 150 // widget height
      
      newPosition.x = Math.max(0, Math.min(newPosition.x, maxX))
      newPosition.y = Math.max(0, Math.min(newPosition.y, maxY))
      
      onPositionChange?.(newPosition)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, onPositionChange])

  const getCurrentSessionTime = () => {
    if (!activeTimer) return 0
    return Math.floor((currentTime.getTime() - activeTimer.startTime.getTime()) / 1000) // seconds
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  const stopTimer = () => {
    if (!activeTimer) return

    const endTime = new Date()
    const duration = Math.round((endTime.getTime() - activeTimer.startTime.getTime()) / 1000) // seconds

    // Add to time entries
    const timeEntries = JSON.parse(localStorage.getItem('timeEntries') || '[]')
    const completedEntry = {
      ...activeTimer,
      endTime,
      duration,
      isRunning: false
    }
    
    localStorage.setItem('timeEntries', JSON.stringify([completedEntry, ...timeEntries]))
    localStorage.removeItem('activeTimer')
    setActiveTimer(null)
  }

  if (!isVisible) return null

  return (
    <div
      ref={widgetRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700"
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 'auto' : '300px',
        userSelect: 'none'
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">⏱️ Timer</span>
          {activeTimer && (
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="hover:bg-white/20 p-1 rounded text-xs"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '□' : '_'}
          </button>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-1 rounded text-xs"
            title="Close Widget"
          >
            ×
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4">
          {activeTimer ? (
            <div className="space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1 truncate">
                  {activeTimer.taskTitle}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {activeTimer.boardName}
                </p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                  {formatDuration(getCurrentSessionTime())}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Started {format(activeTimer.startTime, 'HH:mm')}
                </p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={stopTimer}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded text-sm font-medium transition-colors"
                >
                  ⏹️ Stop
                </button>
                <button
                  onClick={() => window.open('/timetrack', '_blank')}
                  className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-3 rounded text-sm transition-colors"
                  title="Open Time Tracking"
                >
                  📊
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-gray-400 text-3xl mb-2">⏱️</div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                No active timer
              </p>
              <button
                onClick={() => window.open('/timetrack', '_blank')}
                className="bg-primary-500 hover:bg-primary-600 text-white py-2 px-4 rounded text-sm font-medium transition-colors"
              >
                Start Timer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Minimized view */}
      {isMinimized && activeTimer && (
        <div className="px-3 py-2 flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {formatDuration(getCurrentSessionTime())}
          </span>
        </div>
      )}
    </div>
  )
}

// Hook to manage widget state
export function useTimerWidget() {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })

  // Load position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('timerWidgetPosition')
    if (saved) {
      setPosition(JSON.parse(saved))
    }
  }, [])

  // Save position to localStorage
  const updatePosition = (newPosition: { x: number; y: number }) => {
    setPosition(newPosition)
    localStorage.setItem('timerWidgetPosition', JSON.stringify(newPosition))
  }

  return {
    isVisible,
    position,
    showWidget: () => setIsVisible(true),
    hideWidget: () => setIsVisible(false),
    toggleWidget: () => setIsVisible(prev => !prev),
    updatePosition
  }
}
