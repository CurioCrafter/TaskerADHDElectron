'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useBoardStore } from '@/stores/board'
import { useSettingsStore } from '@/stores/settings'
import { AppLayout } from '@/components/layout/app-layout'
import { TaskEditModal } from '@/components/ui/task-edit-modal'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addDays, subDays, isToday, parseISO } from 'date-fns'
import type { Task } from '@/types'

export default function CalendarPage() {
  const { boards, fetchBoards, isLoading } = useBoardStore()
  const { debugMode } = useSettingsStore()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isInitializing, setIsInitializing] = useState(true)
  
  // Only log in debug mode (client-side only)
  useEffect(() => {
    if (debugMode) {
      console.log('🔧 [CALENDAR] Calendar page component loading...')
    }
  }, [debugMode])
  
  // Debug notifications only when debug mode is enabled
  useEffect(() => {
    if (!debugMode) return
    
    console.log('🔧 [CALENDAR] Calendar page mounted - showing toast')
    
    // DEBUGGING for when debug mode is ON
    const timestamp = new Date().toTimeString()
    
    toast(`📅 CALENDAR PAGE LOADED: ${timestamp}`, { 
      duration: 10000, 
      icon: '🔧',
      style: { 
        background: '#f59e0b', 
        color: 'white', 
        fontSize: '16px', 
        fontWeight: 'bold',
        zIndex: 9999
      }
    })
    
    // Store in localStorage for debugging
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('lastPageLoad', `Calendar: ${new Date().toISOString()}`)
      document.title = `TaskerADHD - Calendar (Loaded ${timestamp})`
    }
  }, [debugMode])
  
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedBoard, setSelectedBoard] = useState<string>('all')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Load boards on mount with proper loading state
  useEffect(() => {
    const loadData = async () => {
      setIsInitializing(true)
      try {
        await fetchBoards()
      } catch (error) {
        console.error('Failed to load boards for calendar:', error)
      } finally {
        setIsInitializing(false)
      }
    }
    loadData()
  }, [fetchBoards])

  // Listen for local calendar event updates (from voice modal storing events)
  useEffect(() => {
    const handler = () => setCurrentDate((d) => new Date(d.getTime()))
    if (typeof window !== 'undefined') {
      window.addEventListener('calendarEventsUpdated', handler)
    }
    return () => {
      if (typeof window !== 'undefined') window.removeEventListener('calendarEventsUpdated', handler)
    }
  }, [])

  // Get all tasks with due dates from all boards
  const getAllTasksWithDates = () => {
    if (!boards) return []
    
    const allTasks: (Task & { boardName: string; boardId: string })[] = []
    
    boards.forEach(board => {
      if (selectedBoard === 'all' || board.id === selectedBoard) {
        board.columns?.forEach(column => {
          column.tasks?.forEach(task => {
            if (task.dueAt) {
              allTasks.push({
                ...task,
                boardName: board.name,
                boardId: board.id
              })
            }
          })
        })
      }
    })
    
    return allTasks.sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
  }

  // Generate recurring task instances for calendar display
  const generateRecurringInstances = (task: Task & { boardName: string; boardId: string }, startDate: Date, endDate: Date) => {
    if (!task.isRepeatable || !task.dueAt) return [task]
    
    const instances: (Task & { boardName: string; boardId: string })[] = []
    const baseDate = parseISO(task.dueAt)
    let currentDate = new Date(baseDate)
    
    // Generate instances up to the end date
    while (currentDate <= endDate) {
      if (currentDate >= startDate) {
        instances.push({
          ...task,
          dueAt: currentDate.toISOString(),
          boardName: task.boardName,
          boardId: task.boardId
        })
      }
      
      // Calculate next occurrence based on repeat pattern
      if (task.repeatPattern === 'daily') {
        currentDate = addDays(currentDate, task.repeatInterval || 1)
      } else if (task.repeatPattern === 'weekly') {
        currentDate = addDays(currentDate, 7 * (task.repeatInterval || 1))
      } else if (task.repeatPattern === 'monthly') {
        currentDate = addDays(currentDate, 30 * (task.repeatInterval || 1))
      } else {
        // Default to weekly if pattern is unclear
        currentDate = addDays(currentDate, 7)
      }
      
      // Stop if we have a repeat count limit
      if (task.repeatCount && instances.length >= task.repeatCount) break
      
      // Stop if we have a repeat end date
      if (task.repeatEndDate && currentDate > parseISO(task.repeatEndDate)) break
    }
    
    return instances
  }

  // Get all tasks including recurring instances for a date range
  const getAllTasksWithRecurring = (startDate: Date, endDate: Date) => {
    const baseTasks = getAllTasksWithDates()
    const allInstances: (Task & { boardName: string; boardId: string })[] = []
    
    baseTasks.forEach(task => {
      if (task.isRepeatable) {
        const instances = generateRecurringInstances(task, startDate, endDate)
        allInstances.push(...instances)
      } else {
        // Ensure non-recurring tasks have the required properties
        allInstances.push({
          ...task,
          boardName: (task as any).boardName || 'Unknown',
          boardId: (task as any).boardId || 'unknown'
        })
      }
    })
    
    return allInstances.sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime())
  }

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
    const allTasks = getAllTasksWithRecurring(startOfDay, endOfDay)
    
    return allTasks.filter(task => {
      const taskDate = parseISO(task.dueAt!)
      return isSameDay(taskDate, date)
    })
  }

  // Get tasks for current week
  const getWeekTasks = () => {
    const weekStart = startOfWeek(currentDate)
    const weekEnd = endOfWeek(currentDate)
    const allTasks = getAllTasksWithRecurring(weekStart, weekEnd)
    
    return allTasks.filter(task => {
      const taskDate = parseISO(task.dueAt!)
      return taskDate >= weekStart && taskDate <= weekEnd
    })
  }

  // Generate calendar days for month view
  const getCalendarDays = () => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }

  // Get week days for week view
  const getWeekDays = () => {
    const weekStart = startOfWeek(currentDate)
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'month') {
      const newDate = new Date(currentDate)
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1))
      setCurrentDate(newDate)
    } else if (viewMode === 'week') {
      const newDate = direction === 'next' ? addDays(currentDate, 7) : subDays(currentDate, 7)
      setCurrentDate(newDate)
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500'
      case 'HIGH': return 'bg-orange-500'
      case 'MEDIUM': return 'bg-blue-500'
      case 'LOW': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  const renderMonthView = () => {
    const days = getCalendarDays()
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {/* Week headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const tasksForDay = getTasksForDate(day)
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isSelected = selectedDate && isSameDay(day, selectedDate)
            const isCurrentDay = isToday(day)
            
            return (
              <div
                key={index}
                className={`min-h-[120px] border-r border-b border-gray-200 dark:border-gray-700 p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  !isCurrentMonth ? 'bg-gray-50 dark:bg-gray-800' : ''
                } ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${
                  isCurrentDay ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                }`}
                onClick={() => setSelectedDate(day)}
              >
                <div className={`text-sm font-medium mb-1 ${
                  !isCurrentMonth ? 'text-gray-400 dark:text-gray-500' : 
                  isCurrentDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {format(day, 'd')}
                </div>
                
                <div className="space-y-1">
                  {tasksForDay.slice(0, 3).map((task, idx) => (
                    <div
                      key={idx}
                      className={`text-xs p-1 rounded truncate ${getPriorityColor(task.priority)} text-white flex items-center justify-between cursor-pointer hover:opacity-80`}
                      title={`${task.title} - ${task.boardName}${task.isRepeatable ? ' (Repeatable)' : ''} - Click to edit`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingTask(task)
                        setIsEditModalOpen(true)
                      }}
                    >
                      <span className="truncate flex-1">{task.title}</span>
                      {task.isRepeatable && (
                        <span className="ml-1 text-xs" title="Repeatable task">🔄</span>
                      )}
                    </div>
                  ))}
                  {/* Local calendar events saved by voice calendar integration */}
                  {(() => {
                    try {
                      const events = JSON.parse(localStorage.getItem('calendarEvents') || '[]')
                      const todays = events.filter((e: any) => isSameDay(new Date(e.startDate), day))
                      return todays.slice(0, 3).map((e: any, idx: number) => (
                        <div
                          key={`local-${idx}`}
                          className="text-xs p-1 rounded truncate bg-purple-600 text-white"
                          title={e.title}
                        >
                          {e.title}
                        </div>
                      ))
                    } catch {
                      return null
                    }
                  })()}
                  {tasksForDay.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      +{tasksForDay.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const days = getWeekDays()
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-7 gap-4 p-4">
          {days.map((day, index) => {
            const tasksForDay = getTasksForDate(day)
            const isCurrentDay = isToday(day)
            
            return (
              <div key={index} className="min-h-[300px]">
                <div className={`text-center p-2 rounded-lg mb-2 ${
                  isCurrentDay ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 
                  'text-gray-900 dark:text-gray-100'
                }`}>
                  <div className="text-sm font-medium">{format(day, 'EEE')}</div>
                  <div className="text-lg font-bold">{format(day, 'd')}</div>
                </div>
                
                <div className="space-y-2">
                  {tasksForDay.map((task, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-xs text-white ${getPriorityColor(task.priority)} cursor-pointer hover:opacity-80`}
                      title={`${task.title} - ${task.boardName}${task.isRepeatable ? ' (Repeatable)' : ''} - Click to edit`}
                      onClick={() => {
                        setEditingTask(task)
                        setIsEditModalOpen(true)
                      }}
                    >
                      <div className="font-medium truncate flex items-center justify-between">
                        <span className="truncate flex-1">{task.title}</span>
                        {task.isRepeatable && (
                          <span className="ml-1 text-xs" title="Repeatable task">🔄</span>
                        )}
                      </div>
                      <div className="text-xs opacity-90">{task.boardName}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderAgendaView = () => {
    const allTasks = getAllTasksWithDates()
    const upcomingTasks = allTasks.filter(task => new Date(task.dueAt!) >= new Date())
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Upcoming Tasks ({upcomingTasks.length})
          </h3>
          
          {upcomingTasks.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📅</div>
              <div className="text-gray-500 dark:text-gray-400">No upcoming tasks with due dates</div>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingTasks.slice(0, 20).map((task, idx) => {
                const dueDate = parseISO(task.dueAt!)
                const isOverdue = dueDate < new Date()
                const isDueToday = isSameDay(dueDate, new Date())
                
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border ${
                      isOverdue ? 'border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20' :
                      isDueToday ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' :
                      'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {task.title}
                        </h4>
                        <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                          <span>{task.boardName}</span>
                          <span>•</span>
                          <span className={`px-2 py-1 rounded text-xs text-white ${getPriorityColor(task.priority)}`}>
                            {task.priority || 'No Priority'}
                          </span>
                          {task.estimateMin && (
                            <>
                              <span>•</span>
                              <span>{task.estimateMin}min</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={`text-right text-sm ${
                        isOverdue ? 'text-red-600 dark:text-red-400' :
                        isDueToday ? 'text-blue-600 dark:text-blue-400' :
                        'text-gray-500 dark:text-gray-400'
                      }`}>
                        <div className="font-medium">
                          {isOverdue ? 'Overdue' : isDueToday ? 'Due Today' : 'Due'}
                        </div>
                        <div>{format(dueDate, 'MMM d, yyyy')}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show loading state during initial load
  if (isInitializing || isLoading) {
    return (
      <AppLayout title="Calendar">
        <div className="p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Loading calendar...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Calendar">
      <div className="p-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              📅 Calendar & Schedule
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              View tasks by due date across all your projects
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Board Filter */}
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
            
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { id: 'month', label: 'Month', icon: '📅' },
                { id: 'week', label: 'Week', icon: '📊' },
                { id: 'agenda', label: 'Agenda', icon: '📝' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setViewMode(mode.id as any)}
                  className={`px-3 py-1 text-sm rounded transition-colors ${
                    viewMode === mode.id
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

        {/* Navigation */}
        {viewMode !== 'agenda' && (
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateDate('prev')}
                className="btn-ghost"
              >
                ← Previous
              </button>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {viewMode === 'month' 
                  ? format(currentDate, 'MMMM yyyy')
                  : `Week of ${format(startOfWeek(currentDate), 'MMM d, yyyy')}`
                }
              </h2>
              <button
                onClick={() => navigateDate('next')}
                className="btn-ghost"
              >
                Next →
              </button>
            </div>
            
            <button
              onClick={() => setCurrentDate(new Date())}
              className="btn-secondary"
            >
              Today
            </button>
          </div>
        )}

        {/* Calendar Views */}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'agenda' && renderAgendaView()}

        {/* Selected Date Details */}
        {selectedDate && viewMode === 'month' && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Tasks for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h3>
            
            {getTasksForDate(selectedDate).length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No tasks scheduled for this date</p>
            ) : (
              <div className="space-y-3">
                {getTasksForDate(selectedDate).map((task, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{task.title}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {task.boardName} • {task.priority || 'No Priority'}
                        {task.estimateMin && ` • ${task.estimateMin}min`}
                      </p>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {getAllTasksWithDates().filter(task => isSameDay(parseISO(task.dueAt!), new Date())).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Due Today</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {getAllTasksWithDates().filter(task => {
                const taskDate = parseISO(task.dueAt!)
                const weekEnd = endOfWeek(new Date())
                return taskDate >= new Date() && taskDate <= weekEnd
              }).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">This Week</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {getAllTasksWithDates().filter(task => parseISO(task.dueAt!) < new Date()).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Overdue</div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
              {getAllTasksWithDates().length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Scheduled</div>
          </div>
        </div>
      </div>
      
      {/* Task Edit Modal */}
      {editingTask && (
        <TaskEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setEditingTask(null)
          }}
          task={editingTask}
        />
      )}
    </AppLayout>
  )
}
