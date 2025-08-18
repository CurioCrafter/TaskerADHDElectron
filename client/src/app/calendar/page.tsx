'use client'

import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useBoardStore } from '@/stores/board'
import { useSettingsStore } from '@/stores/settings'
import { AppLayout } from '@/components/layout/app-layout'
import { TaskEditModal } from '@/components/ui/task-edit-modal'
import { TaskForm } from '@/components/ui/task-form'
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addDays, subDays, isToday, parseISO } from 'date-fns'
import type { Task } from '@/types'

// Example tasks to demonstrate different types and repeatable patterns
const EXAMPLE_TASKS = [
  {
    title: 'Daily Standup',
    summary: 'Team daily standup meeting',
    priority: 'HIGH' as const,
    energy: 'LOW' as const,
    dueAt: new Date().toISOString(),
    estimateMin: 15,
    isRepeatable: true,
    repeatPattern: 'daily' as const,
    repeatInterval: 1,
    boardName: 'Work',
    boardId: 'work-board'
  },
  {
    title: 'Weekly Review',
    summary: 'Review progress and plan next week',
    priority: 'MEDIUM' as const,
    energy: 'MEDIUM' as const,
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Next Monday
    estimateMin: 60,
    isRepeatable: true,
    repeatPattern: 'weekly' as const,
    repeatInterval: 1,
    repeatDays: [1], // Monday
    boardName: 'Personal',
    boardId: 'personal-board'
  },
  {
    title: 'Monthly Budget Review',
    summary: 'Review monthly expenses and budget',
    priority: 'MEDIUM' as const,
    energy: 'LOW' as const,
    dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Next month
    estimateMin: 45,
    isRepeatable: true,
    repeatPattern: 'monthly' as const,
    repeatInterval: 1,
    boardName: 'Finance',
    boardId: 'finance-board'
  },
  {
    title: 'Grocery Shopping',
    summary: 'Weekly grocery shopping trip',
    priority: 'MEDIUM' as const,
    energy: 'LOW' as const,
    dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // This weekend
    estimateMin: 90,
    isRepeatable: true,
    repeatPattern: 'weekly' as const,
    repeatInterval: 1,
    repeatDays: [0, 6], // Weekend
    boardName: 'Personal',
    boardId: 'personal-board'
  },
  {
    title: 'Project Deadline',
    summary: 'Important project milestone',
    priority: 'URGENT' as const,
    energy: 'HIGH' as const,
    dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // Next week
    estimateMin: 240,
    isRepeatable: false,
    boardName: 'Work',
    boardId: 'work-board'
  }
]

export default function CalendarPage() {
  const { boards, fetchBoards, isLoading } = useBoardStore()
  const { debugMode, showCalendarPlusButtons, toggleCalendarPlusButtons } = useSettingsStore()
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
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [selectedDateForNewTask, setSelectedDateForNewTask] = useState<Date | null>(null)
  const [newTask, setNewTask] = useState<Task | null>(null)

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
    const handler = () => {
      console.log('🔧 [CALENDAR] Received calendarEventsUpdated event, refreshing...')
      setCurrentDate((d) => new Date(d.getTime()))
    }
    if (typeof window !== 'undefined') {
      console.log('🔧 [CALENDAR] Adding event listener for calendarEventsUpdated')
      window.addEventListener('calendarEventsUpdated', handler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        console.log('🔧 [CALENDAR] Removing event listener for calendarEventsUpdated')
        window.removeEventListener('calendarEventsUpdated', handler)
      }
    }
  }, [])

  // Listen for task updates to refresh calendar (especially for repeatable tasks)
  useEffect(() => {
    const handler = () => {
      console.log('🔧 [CALENDAR] Received taskUpdated event, refreshing calendar...')
      setCurrentDate((d) => new Date(d.getTime()))
    }
    if (typeof window !== 'undefined') {
      console.log('🔧 [CALENDAR] Adding event listener for taskUpdated')
      window.addEventListener('taskUpdated', handler)
    }
    return () => {
      if (typeof window !== 'undefined') {
        console.log('🔧 [CALENDAR] Removing event listener for taskUpdated')
        window.removeEventListener('taskUpdated', handler)
      }
    }
  }, [])

  // Listen for board updates to refresh calendar
  useEffect(() => {
    if (boards && boards.length > 0) {
      // Force a refresh when boards change
      setCurrentDate((d) => new Date(d.getTime()))
    }
  }, [boards])

  // Get all tasks with due dates from all boards
  const getAllTasksWithDates = (): (Task & { boardName: string; boardId: string })[] => {
    if (!boards || boards.length === 0) return []
    
    const allTasks: (Task & { boardName: string; boardId: string })[] = []
    
    boards.forEach(board => {
      if (board.columns) {
        board.columns.forEach(column => {
          if (column.tasks) {
            column.tasks.forEach(task => {
              if (task.dueAt) {
                allTasks.push({
                  ...task,
                  boardName: board.name,
                  boardId: board.id
                })
              }
            })
          }
        })
      }
    })
    
    return allTasks
  }

  // Get example tasks for demonstration (when no real tasks exist)
  const getExampleTasks = (): (Task & { boardName: string; boardId: string })[] => {
    // Only show examples if no real tasks exist
    const realTasks = getAllTasksWithDates()
    if (realTasks.length > 0) return []
    
    return EXAMPLE_TASKS.map((task, index) => ({
      ...task,
      id: `example-${index}`,
      boardId: task.boardId,
      columnId: 'example-column',
      position: index,
      labels: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }))
  }

  // Handle opening task form for a specific date
  const handleAddTaskForDate = (date: Date) => {
    setSelectedDateForNewTask(date)
    setIsTaskFormOpen(true)
  }

  // Handle task form submission
  const handleTaskFormSubmit = async (taskData: any) => {
    try {
      // Add the selected date to the task data
      if (selectedDateForNewTask) {
        taskData.dueAt = selectedDateForNewTask.toISOString()
      }
      
      // Create the task using the board store
      const { createTask } = useBoardStore.getState()
      if (createTask && selectedDateForNewTask) {
        // Find the first board to use as default
        const defaultBoard = boards?.[0]
        if (defaultBoard && defaultBoard.columns?.[0]) {
          const newTask = await createTask({
            ...taskData,
            boardId: defaultBoard.id,
            columnId: defaultBoard.columns[0].id
          })
          
          if (newTask) {
            toast.success('Task created successfully!')
            // Refresh the calendar
            setCurrentDate((d) => new Date(d.getTime()))
            
            // Dispatch event to notify calendar that tasks have been updated
            if (typeof window !== 'undefined') {
              console.log('🔧 [CALENDAR] Dispatching taskUpdated event after creating task on calendar day')
              window.dispatchEvent(new Event('taskUpdated'))
            }
            
            setIsTaskFormOpen(false)
            setSelectedDateForNewTask(null)
          }
        }
      }
    } catch (error) {
      console.error('Failed to create task:', error)
      toast.error('Failed to create task')
    }
  }

  // Generate recurring task instances for calendar display
  const generateRecurringInstances = (task: Task & { boardName: string; boardId: string }, startDate: Date, endDate: Date) => {
    if (!task.isRepeatable || !task.dueAt) {
      // Debug: log why task isn't being processed as repeatable
      if (debugMode) {
        console.log('🔧 [CALENDAR] Task not repeatable:', {
          title: task.title,
          isRepeatable: task.isRepeatable,
          dueAt: task.dueAt,
          repeatPattern: task.repeatPattern,
          repeatInterval: task.repeatInterval,
          repeatDays: task.repeatDays
        })
      }
      return [task]
    }
    
    // Debug: log repeatable task details
    if (debugMode) {
      console.log('🔧 [CALENDAR] Processing repeatable task:', {
        title: task.title,
        repeatPattern: task.repeatPattern,
        repeatInterval: task.repeatInterval,
        repeatDays: task.repeatDays,
        repeatCount: task.repeatCount
      })
    }
    
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
        if (task.repeatDays && task.repeatDays.length > 0) {
          // Handle specific days of the week (e.g., weekends = [0,6])
          const currentDay = currentDate.getDay()
          const currentIndex = task.repeatDays.indexOf(currentDay)
          
          if (currentIndex !== -1 && currentIndex < task.repeatDays.length - 1) {
            // Move to next day in the same week
            const nextDay = task.repeatDays[currentIndex + 1]
            currentDate = addDays(currentDate, nextDay - currentDay)
          } else {
            // Move to first day of next week
            const nextWeekFirstDay = task.repeatDays[0]
            const daysUntilNextWeek = (7 - currentDay) + nextWeekFirstDay
            currentDate = addDays(currentDate, daysUntilNextWeek)
          }
        } else {
          // No specific days, just add weeks
          currentDate = addDays(currentDate, 7 * (task.repeatInterval || 1))
        }
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
    
    if (debugMode) {
      console.log('🔧 [CALENDAR] Generated instances:', instances.length, 'for task:', task.title)
    }
    
    return instances
  }

  // Get all tasks including recurring instances for a date range
  const getAllTasksWithRecurring = (startDate: Date, endDate: Date) => {
    const baseTasks = getAllTasksWithDates()
    const exampleTasks = getExampleTasks()
    const allTasks = [...baseTasks, ...exampleTasks]
    const allInstances: (Task & { boardName: string; boardId: string })[] = []
    
    allTasks.forEach(task => {
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
                
                {/* Plus button for adding tasks */}
                {showCalendarPlusButtons && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddTaskForDate(day)
                    }}
                    className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center transition-colors hover:scale-110 mb-2"
                    title={`Add task for ${format(day, 'MMMM d, yyyy')}`}
                  >
                    +
                  </button>
                )}
                
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
                  {showCalendarPlusButtons && (
                    <button
                      onClick={() => handleAddTaskForDate(day)}
                      className="mt-1 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-800 hover:bg-blue-200 dark:hover:bg-blue-700 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center transition-colors hover:scale-110"
                      title={`Add task for ${format(day, 'MMMM d, yyyy')}`}
                  >
                      +
                    </button>
                  )}
                </div>
                
                <div className="space-y-2">
                  {tasksForDay.map((task, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded text-xs text-white ${getPriorityColor(task.priority)} cursor-pointer hover:opacity-80`}
                      title={`${task.title} - ${task.boardName}${task.isRepeatable ? ` (Repeatable: ${(task as any).repeatPattern || 'custom'} every ${(task as any).repeatInterval || 1} ${(task as any).repeatPattern === 'weekly' ? 'week(s)' : (task as any).repeatPattern === 'monthly' ? 'month(s)' : 'day(s)'}${(task as any).repeatCount ? `, ${(task as any).repeatCount} times` : ''})` : ''} - Click to edit`}
                      onClick={() => {
                        setEditingTask(task)
                        setIsEditModalOpen(true)
                      }}
                    >
                      <div className="font-medium truncate flex items-center justify-between">
                        <span className="truncate flex-1">{task.title}</span>
                        {task.isRepeatable && (
                          <span className="ml-1 text-xs" title={`Repeatable: ${(task as any).repeatPattern || 'custom'} every ${(task as any).repeatInterval || 1} ${(task as any).repeatPattern === 'weekly' ? 'week(s)' : (task as any).repeatPattern === 'monthly' ? 'month(s)' : 'day(s)'}${(task as any).repeatCount ? `, ${(task as any).repeatCount} times` : ''}`}>🔄</span>
                        )}
                      </div>
                      <div className="text-xs opacity-90">{task.boardName}</div>
                      {task.isRepeatable && (task as any).repeatCount && (
                        <div className="text-xs opacity-75 mt-1">
                          Repeats {(task as any).repeatCount} times
                        </div>
                      )}
                    </div>
                  ))}
                  {tasksForDay.length === 0 && showCalendarPlusButtons && (
                    <div className="text-center py-4 text-gray-400 dark:text-gray-500 text-xs">
                      Click + to add task
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
                          {task.isRepeatable && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 dark:text-blue-400" title={`Repeatable: ${(task as any).repeatPattern || 'custom'} every ${(task as any).repeatInterval || 1} ${(task as any).repeatPattern === 'weekly' ? 'week(s)' : (task as any).repeatPattern === 'monthly' ? 'month(s)' : 'day(s)'}${(task as any).repeatCount ? `, ${(task as any).repeatCount} times` : ''}`}>
                                🔄 Repeatable
                              </span>
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

        {/* Calendar Controls */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
            <span className="text-lg">💡</span>
            <div>
              <p className="font-medium">Quick Task Creation</p>
              <p className="text-sm opacity-90">Use the <span className="font-mono bg-blue-200 dark:bg-blue-800 px-1 rounded">+</span> buttons on calendar days to add tasks directly for specific dates!</p>
            </div>
          </div>
          
          {/* Plus Button Toggle */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-blue-800 dark:text-blue-200 font-medium">
              Show + buttons:
            </label>
            <button
              onClick={toggleCalendarPlusButtons}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showCalendarPlusButtons
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
              }`}
            >
              {showCalendarPlusButtons ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
        
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'agenda' && renderAgendaView()}

        {/* Calendar Legend */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span>Urgent</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              <span>High</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span>Medium</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span>Low</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-600 dark:text-blue-400">🔄</span>
              <span>Repeatable Task</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-600 dark:text-blue-400">+</span>
              <span>Add Task</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-purple-600 dark:text-purple-400">💡</span>
              <span>Example Task</span>
            </div>
          </div>
        </div>

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
                const weekEnd = endOfWeek(currentDate)
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
        
        {/* Example Tasks Note */}
        {getExampleTasks().length > 0 && (
          <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg">
            <div className="flex items-center space-x-2 text-purple-800 dark:text-purple-200">
              <span className="text-lg">💡</span>
              <div>
                <p className="font-medium">Example Tasks Loaded</p>
                <p className="text-sm opacity-90">These are demonstration tasks showing different types including repeatable patterns. Create your own tasks to replace them!</p>
              </div>
            </div>
          </div>
        )}
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

      {/* Task Form Modal for adding new tasks */}
      {isTaskFormOpen && selectedDateForNewTask && (
        <TaskForm
          isOpen={isTaskFormOpen}
          onClose={() => {
            setIsTaskFormOpen(false)
            setSelectedDateForNewTask(null)
          }}
          onSubmit={handleTaskFormSubmit}
          boardId={boards?.[0]?.id}
        />
      )}
    </AppLayout>
  )
}
