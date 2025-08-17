'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import type { Task } from '@/types'

interface TimeBoxerProps {
  isOpen: boolean
  onClose: () => void
  selectedTask?: Task
  onTaskComplete?: (taskId: string) => void
}

interface TimeSession {
  id: string
  taskId?: string
  type: 'pomodoro' | 'short-break' | 'long-break' | 'focus' | 'deep-work'
  duration: number // minutes
  remainingTime: number // seconds
  isActive: boolean
  isPaused: boolean
  startedAt?: Date
  completedAt?: Date
}

interface PomodoroSettings {
  workDuration: number
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number // After how many pomodoros
  autoStartBreaks: boolean
  autoStartPomodoros: boolean
  soundEnabled: boolean
  notificationsEnabled: boolean
}

export function TimeBoxer({ isOpen, onClose, selectedTask, onTaskComplete }: TimeBoxerProps) {
  const [currentSession, setCurrentSession] = useState<TimeSession | null>(null)
  const [completedPomodoros, setCompletedPomodoros] = useState(0)
  const [settings, setSettings] = useState<PomodoroSettings>({
    workDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    longBreakInterval: 4,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    soundEnabled: true,
    notificationsEnabled: true
  })

  const [showSettings, setShowSettings] = useState(false)
  const [sessionHistory, setSessionHistory] = useState<TimeSession[]>([])
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('timeboxer_settings')
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }

    const savedPomodoros = localStorage.getItem('completed_pomodoros_today')
    if (savedPomodoros) {
      const data = JSON.parse(savedPomodoros)
      const today = new Date().toDateString()
      if (data.date === today) {
        setCompletedPomodoros(data.count)
      }
    }

    // Initialize audio for notifications
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmUeCSGByPLZiTYIG2m98N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrPp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCSCByPLZiTYIG2m88N2QQAoUXrTp66hVFAlFnuDyvmQeCQ==') // Basic notification sound
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('timeboxer_settings', JSON.stringify(settings))
  }, [settings])

  // Timer logic
  useEffect(() => {
    if (currentSession?.isActive && !currentSession.isPaused) {
      intervalRef.current = setInterval(() => {
        setCurrentSession(prev => {
          if (!prev) return null

          const newRemainingTime = prev.remainingTime - 1

          if (newRemainingTime <= 0) {
            // Session completed
            handleSessionComplete(prev)
            return null
          }

          return { ...prev, remainingTime: newRemainingTime }
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [currentSession?.isActive, currentSession?.isPaused])

  const handleSessionComplete = (session: TimeSession) => {
    const completedSession = {
      ...session,
      isActive: false,
      completedAt: new Date()
    }

    setSessionHistory(prev => [...prev, completedSession])

    // Play notification sound
    if (settings.soundEnabled && audioRef.current) {
      audioRef.current.play().catch(console.error)
    }

    // Show notification
    if (settings.notificationsEnabled) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`${session.type} completed!`, {
          body: session.type === 'pomodoro' ? 'Time for a break!' : 'Ready to focus again?',
          icon: '/favicon.ico'
        })
      } else {
        toast.success(`${session.type} completed! 🎉`)
      }
    }

    if (session.type === 'pomodoro') {
      const newCount = completedPomodoros + 1
      setCompletedPomodoros(newCount)

      // Save to localStorage
      localStorage.setItem('completed_pomodoros_today', JSON.stringify({
        date: new Date().toDateString(),
        count: newCount
      }))

      // Auto-start break if enabled
      if (settings.autoStartBreaks) {
        const isLongBreak = newCount % settings.longBreakInterval === 0
        startSession(isLongBreak ? 'long-break' : 'short-break')
      }

      // Mark task as complete if it was a single pomodoro task
      if (session.taskId && onTaskComplete) {
        // TODO: Add logic to determine if task should be marked complete
        // For now, we'll let the user decide
      }
    } else if (session.type.includes('break') && settings.autoStartPomodoros) {
      startSession('pomodoro', selectedTask?.id)
    }
  }

  const startSession = (type: TimeSession['type'], taskId?: string) => {
    let duration: number
    switch (type) {
      case 'pomodoro':
        duration = settings.workDuration
        break
      case 'short-break':
        duration = settings.shortBreakDuration
        break
      case 'long-break':
        duration = settings.longBreakDuration
        break
      case 'focus':
        duration = 45 // 45 minute focus session
        break
      case 'deep-work':
        duration = 90 // 90 minute deep work session
        break
      default:
        duration = settings.workDuration
    }

    const session: TimeSession = {
      id: `session_${Date.now()}`,
      type,
      taskId,
      duration,
      remainingTime: duration * 60,
      isActive: true,
      isPaused: false,
      startedAt: new Date()
    }

    setCurrentSession(session)

    // Request notification permission if needed
    if (settings.notificationsEnabled && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission()
    }
  }

  const pauseSession = () => {
    setCurrentSession(prev => prev ? { ...prev, isPaused: true } : null)
  }

  const resumeSession = () => {
    setCurrentSession(prev => prev ? { ...prev, isPaused: false } : null)
  }

  const stopSession = () => {
    if (currentSession) {
      const stoppedSession = {
        ...currentSession,
        isActive: false,
        completedAt: new Date()
      }
      setSessionHistory(prev => [...prev, stoppedSession])
    }
    setCurrentSession(null)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = () => {
    if (!currentSession) return 0
    const elapsed = (currentSession.duration * 60) - currentSession.remainingTime
    return (elapsed / (currentSession.duration * 60)) * 100
  }

  const getSessionIcon = (type: string) => {
    switch (type) {
      case 'pomodoro': return '🍅'
      case 'short-break': return '☕'
      case 'long-break': return '🛋️'
      case 'focus': return '🎯'
      case 'deep-work': return '🧠'
      default: return '⏱️'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              ⏰ Focus Timer
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Pomodoro technique and focus sessions
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="btn-ghost p-2"
              title="Settings"
            >
              ⚙️
            </button>
            <button onClick={onClose} className="btn-ghost p-2">✕</button>
          </div>
        </div>

        <div className="p-6">
          {/* Current Task */}
          {selectedTask && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                🎯 Current Task
              </h3>
              <p className="text-blue-800 dark:text-blue-200">{selectedTask.title}</p>
              {selectedTask.estimateMin && (
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                  Estimated: {selectedTask.estimateMin} minutes
                </p>
              )}
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Timer Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Work Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={settings.workDuration}
                    onChange={(e) => setSettings(prev => ({ ...prev, workDuration: Number(e.target.value) }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Short Break (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={settings.shortBreakDuration}
                    onChange={(e) => setSettings(prev => ({ ...prev, shortBreakDuration: Number(e.target.value) }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Long Break (minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={settings.longBreakDuration}
                    onChange={(e) => setSettings(prev => ({ ...prev, longBreakDuration: Number(e.target.value) }))}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Long Break Interval
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="8"
                    value={settings.longBreakInterval}
                    onChange={(e) => setSettings(prev => ({ ...prev, longBreakInterval: Number(e.target.value) }))}
                    className="input w-full"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoStartBreaks}
                    onChange={(e) => setSettings(prev => ({ ...prev, autoStartBreaks: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Auto-start breaks</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoStartPomodoros}
                    onChange={(e) => setSettings(prev => ({ ...prev, autoStartPomodoros: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Auto-start work sessions</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.soundEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, soundEnabled: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Sound notifications</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notificationsEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, notificationsEnabled: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Browser notifications</span>
                </label>
              </div>
            </div>
          )}

          {/* Timer Display */}
          {currentSession ? (
            <div className="text-center mb-6">
              <div className="mb-4">
                <div className="text-6xl mb-2">
                  {getSessionIcon(currentSession.type)}
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 capitalize">
                  {currentSession.type?.replace('-', ' ') || 'Session'}
                </h3>
                {currentSession.isPaused && (
                  <span className="text-sm text-yellow-600 dark:text-yellow-400">⏸️ Paused</span>
                )}
              </div>

              {/* Circular Progress */}
              <div className="relative w-48 h-48 mx-auto mb-6">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200 dark:text-gray-600"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${getProgressPercentage() * 2.827} 282.7`}
                    className={
                      currentSession.type === 'pomodoro' || currentSession.type === 'focus' || currentSession.type === 'deep-work'
                        ? 'text-red-500'
                        : 'text-green-500'
                    }
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl font-mono font-bold text-gray-900 dark:text-gray-100">
                      {formatTime(currentSession.remainingTime)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center space-x-4">
                {currentSession.isPaused ? (
                  <button
                    onClick={resumeSession}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <span>▶️</span>
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={pauseSession}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <span>⏸️</span>
                    <span>Pause</span>
                  </button>
                )}
                <button
                  onClick={stopSession}
                  className="btn-ghost flex items-center space-x-2"
                >
                  <span>⏹️</span>
                  <span>Stop</span>
                </button>
              </div>
            </div>
          ) : (
            /* Start Session Options */
            <div className="text-center mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">
                Choose Your Focus Mode
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => startSession('pomodoro', selectedTask?.id)}
                  className="p-6 border-2 border-red-200 dark:border-red-700 rounded-lg hover:border-red-300 dark:hover:border-red-600 transition-colors"
                >
                  <div className="text-4xl mb-2">🍅</div>
                  <div className="font-medium text-red-700 dark:text-red-300">Pomodoro</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{settings.workDuration} minutes</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Classic technique with breaks
                  </div>
                </button>

                <button
                  onClick={() => startSession('focus', selectedTask?.id)}
                  className="p-6 border-2 border-blue-200 dark:border-blue-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div className="text-4xl mb-2">🎯</div>
                  <div className="font-medium text-blue-700 dark:text-blue-300">Focus Session</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">45 minutes</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Extended focus time
                  </div>
                </button>

                <button
                  onClick={() => startSession('deep-work', selectedTask?.id)}
                  className="p-6 border-2 border-purple-200 dark:border-purple-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
                >
                  <div className="text-4xl mb-2">🧠</div>
                  <div className="font-medium text-purple-700 dark:text-purple-300">Deep Work</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">90 minutes</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Maximum concentration
                  </div>
                </button>

                <button
                  onClick={() => startSession('short-break')}
                  className="p-6 border-2 border-green-200 dark:border-green-700 rounded-lg hover:border-green-300 dark:hover:border-green-600 transition-colors"
                >
                  <div className="text-4xl mb-2">☕</div>
                  <div className="font-medium text-green-700 dark:text-green-300">Short Break</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{settings.shortBreakDuration} minutes</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Quick recharge
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Today's Stats */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Today's Progress</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{completedPomodoros}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Pomodoros</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.round(completedPomodoros * settings.workDuration / 60 * 10) / 10}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Hours Focused</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {(sessionHistory || []).filter(s => s.completedAt && 
                    new Date(s.completedAt).toDateString() === new Date().toDateString()
                  ).length}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Sessions</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
