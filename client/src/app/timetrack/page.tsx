'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useBoardStore } from '@/stores/board'
import { useSettingsStore } from '@/stores/settings'
import { useTimeTrackingStore } from '@/stores/timeTracking'
import { AppLayout } from '@/components/layout/app-layout'
import { format } from 'date-fns'
import type { Task } from '@/types'

interface TimeEntry {
  id: string
  taskId: string
  taskTitle: string
  boardName: string
  startTime: Date
  endTime?: Date
  duration?: number // in minutes
  description?: string
  energy?: 'LOW' | 'MEDIUM' | 'HIGH'
  category?: string
  isRunning: boolean
}

export default function TimeTrackPage() {
  const { boards, fetchBoards, isLoading } = useBoardStore()
  const { debugMode } = useSettingsStore()
  const { 
    activeTimer, 
    timeEntries, 
    startTimer, 
    stopTimer,
    getDailyTotal,
    getTaskLog,
    getTopTasks
  } = useTimeTrackingStore()
  
  const [selectedBoard, setSelectedBoard] = useState<string>('all')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [view, setView] = useState<'timer' | 'log' | 'analytics'>('timer')

  // Debug logging
  useEffect(() => {
    if (debugMode) {
      console.log('🔧 [TIMETRACK] Time tracking page loading...')
    }
  }, [debugMode])

  // Load boards on mount
  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  // Update current time every second for active timers
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // No need for manual localStorage management - handled by store

  // Get all tasks from all boards
  const getAllTasks = () => {
    if (!boards) return []
    
    const allTasks: (Task & { boardName: string; boardId: string })[] = []
    
    boards.forEach(board => {
      if (selectedBoard === 'all' || board.id === selectedBoard) {
        board.columns?.forEach(column => {
          column.tasks?.forEach(task => {
            allTasks.push({
              ...task,
              boardName: board.name,
              boardId: board.id
            })
          })
        })
      }
    })
    
    return allTasks.sort((a, b) => a.title.localeCompare(b.title))
  }

  const handleStartTimer = (task: Task & { boardName: string }) => {
    startTimer({
      id: task.id,
      title: task.title,
      boardId: task.boardId,
      boardName: task.boardName,
      energy: task.energy
    })
    toast.success(`Started timer for "${task.title}"`)
  }

  const handleStopTimer = () => {
    const completedEntry = stopTimer()
    if (completedEntry) {
      toast.success(`Tracked ${completedEntry.duration} minutes on "${completedEntry.taskTitle}"`)
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    return `${hours}h ${mins}m`
  }

  const getCurrentSessionTime = () => {
    if (!activeTimer) return 0
    return Math.floor((currentTime.getTime() - activeTimer.startTime.getTime()) / (1000 * 60))
  }

  const todaysTotal = getDailyTotal()

  const getEnergyColor = (energy?: string) => {
    switch (energy) {
      case 'HIGH': return 'text-green-600 dark:text-green-400'
      case 'MEDIUM': return 'text-blue-600 dark:text-blue-400'
      case 'LOW': return 'text-orange-600 dark:text-orange-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const renderTimerView = () => (
    <div className="space-y-6">
      {/* Active Timer */}
      {activeTimer && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6 border border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                🟢 Currently Tracking
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-1">
                <strong>{activeTimer.taskTitle}</strong>
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {activeTimer.boardName} • Started {format(activeTimer.startTime, 'HH:mm')}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                {formatDuration(getCurrentSessionTime())}
              </div>
              <button
                onClick={handleStopTimer}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                ⏹️ Stop Timer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            ⏱️ Start New Timer
          </h3>
          <select
            value={selectedBoard}
            onChange={(e) => setSelectedBoard(e.target.value)}
            className="input text-sm"
          >
            <option value="all">All Projects</option>
            {boards?.map(board => (
              <option key={board.id} value={board.id}>
                {board.type === 'PROJECT' ? '📋' : '📝'} {board.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {getAllTasks().map(task => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  {task.title}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {task.boardName} • {task.priority || 'No Priority'} Priority
                  {task.estimateMin && ` • Est. ${task.estimateMin}min`}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm ${getEnergyColor(task.energy)}`}>
                  {task.energy || 'MED'}
                </span>
                <button
                  onClick={() => handleStartTimer(task)}
                  disabled={activeTimer?.taskId === task.id}
                  className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm transition-colors"
                >
                  {activeTimer?.taskId === task.id ? 'Running' : '▶️ Start'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {getAllTasks().length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">⏰</div>
            <div className="text-gray-500 dark:text-gray-400">
              No tasks available. Create some tasks first to track time.
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderLogView = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          📊 Time Log
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Today's total: <strong>{formatDuration(todaysTotal)}</strong>
        </p>
      </div>

      <div className="p-6">
        {timeEntries.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📝</div>
            <div className="text-gray-500 dark:text-gray-400">
              No time entries yet. Start tracking to see your log here.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {timeEntries.slice(0, 20).map(entry => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                    {entry.taskTitle}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {entry.boardName} • {format(entry.startTime, 'MMM d, HH:mm')}
                    {entry.endTime && ` - ${format(entry.endTime, 'HH:mm')}`}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {entry.duration ? formatDuration(entry.duration) : 'In Progress'}
                  </div>
                  <div className={`text-sm ${getEnergyColor(entry.energy)}`}>
                    {entry.energy} Energy
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <AppLayout title="Time Tracking">
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading time tracking...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Time Tracking">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              ⏱️ Time Tracking
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track time spent on tasks and build better time awareness
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* View Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { id: 'timer', label: 'Timer', icon: '⏱️' },
                { id: 'log', label: 'Log', icon: '📊' },
                { id: 'analytics', label: 'Analytics', icon: '📈' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setView(mode.id as any)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    view === mode.id
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Views */}
        {view === 'timer' && renderTimerView()}
        {view === 'log' && renderLogView()}
        {view === 'analytics' && (
          <div className="space-y-6">
            {/* Today's Summary */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                📈 Today's Analytics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatDuration(todaysTotal)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {timeEntries.filter(e => format(e.startTime, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {todaysTotal > 0 ? Math.round(todaysTotal / Math.max(1, timeEntries.filter(e => format(e.startTime, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length)) : 0}m
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Avg Session</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {activeTimer ? '🟢' : '⭕'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
                </div>
              </div>
            </div>

            {/* Top Tasks */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                🏆 Most Tracked Tasks
              </h3>
              <div className="space-y-3">
                {getTopTasks(5).map((task, index) => (
                  <div key={task.taskId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="text-lg font-bold text-gray-400">#{index + 1}</div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {task.taskTitle}
                        </h4>
                      </div>
                    </div>
                    <div className="font-semibold text-primary-600 dark:text-primary-400">
                      {formatDuration(task.totalTime)}
                    </div>
                  </div>
                ))}
                {getTopTasks(5).length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    No tasks tracked yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
