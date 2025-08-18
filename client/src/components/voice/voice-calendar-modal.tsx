'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import type { VoiceCalendarResult, CalendarEvent } from '@/services/llm/voice-calendar-integration'
import { VoiceCalendarIntegration } from '@/services/llm/voice-calendar-integration'
import { useBoardStore } from '@/stores/board'
import { useStagingStore } from '@/stores/staging'

interface VoiceCalendarModalProps {
  isOpen: boolean
  onClose: () => void
  proposals: VoiceCalendarResult | null
  transcript: string
  useStaging?: boolean
}

export function VoiceCalendarModal({ isOpen, onClose, proposals, transcript, useStaging: globalUseStaging = false }: VoiceCalendarModalProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  
  const { currentBoard, createTask } = useBoardStore()
  const { addToStaging } = useStagingStore()
  const [useStaging, setUseStaging] = useState(globalUseStaging)

  // Select all by default
  useEffect(() => {
    if (proposals) {
      const taskIds = new Set(proposals.tasks.map(t => t.id))
      const eventIds = new Set(proposals.calendarEvents.map(e => e.id))
      setSelectedTasks(taskIds)
      setSelectedEvents(eventIds)
    }
  }, [proposals])

  // Sync with global staging preference
  useEffect(() => {
    setUseStaging(globalUseStaging)
  }, [globalUseStaging])

  if (!isOpen || !proposals) return null

  const handleTaskToggle = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleEventToggle = (eventId: string) => {
    const newSelected = new Set(selectedEvents)
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId)
    } else {
      newSelected.add(eventId)
    }
    setSelectedEvents(newSelected)
  }

  const toggleEventExpansion = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  const generateRecurringEvents = (event: CalendarEvent): CalendarEvent[] => {
    if (!event.recurrence) return [event]
    
    const integration = new VoiceCalendarIntegration('')
    return integration.generateRecurringEvents(event, 12) // Generate 12 occurrences
  }

  const createSelectedItems = async () => {
    if (selectedTasks.size === 0 && selectedEvents.size === 0) {
      toast.error('Please select at least one item to create')
      return
    }

    setIsCreating(true)
    let tasksCreated = 0
    let eventsCreated = 0

    try {
      // Create selected tasks
      for (const task of proposals.tasks) {
        if (selectedTasks.has(task.id)) {
          if (currentBoard) {
            await createTask({
              title: task.title,
              summary: task.summary,
              priority: task.priority as any,
              energy: task.energy as any,
              estimateMin: task.estimateMin,
              dueAt: task.dueAt,
              isRepeatable: task.isRepeatable || false,
              ...(task.repeatPattern && { repeatPattern: task.repeatPattern }),
              ...(task.repeatInterval && { repeatInterval: task.repeatInterval }),
              ...(task.repeatDays && { repeatDays: task.repeatDays }),
              ...(task.repeatCount && { repeatCount: task.repeatCount }),
              ...(task.repeatEndDate && { repeatEndDate: task.repeatEndDate })
            })
            tasksCreated++
          } else if (useStaging) {
            // Add to staging only when staging is ON
            addToStaging({
              title: task.title,
              summary: task.summary,
              priority: task.priority,
              energy: task.energy,
              dueAt: task.dueAt,
              estimateMin: task.estimateMin,
              isRepeatable: task.isRepeatable || false,
              ...(task.repeatPattern && { repeatPattern: task.repeatPattern }),
              ...(task.repeatInterval && { repeatInterval: task.repeatInterval }),
              ...(task.repeatDays && { repeatDays: task.repeatDays }),
              ...(task.repeatCount && { repeatCount: task.repeatCount }),
              ...(task.repeatEndDate && { repeatEndDate: task.repeatEndDate }),
              position: 0,
              labels: [],
              subtasks: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              source: 'voice',
              confidence: proposals.confidence || 0.8,
              suggestedImprovements: [],
              detectedCategory: 'personal',
              suggestedLabels: [],
              relatedTasks: []
            })
            tasksCreated++
          } else {
            // Fallback: create directly on board if staging is OFF but no current board
            if (currentBoard) {
              await createTask({
                title: task.title,
                summary: task.summary,
                priority: task.priority as any,
                energy: task.energy as any,
                estimateMin: task.estimateMin,
                dueAt: task.dueAt,
                isRepeatable: task.isRepeatable || false,
                ...(task.repeatPattern && { repeatPattern: task.repeatPattern }),
                ...(task.repeatInterval && { repeatInterval: task.repeatInterval }),
                ...(task.repeatDays && { repeatDays: task.repeatDays }),
                ...(task.repeatCount && { repeatCount: task.repeatCount }),
                ...(task.repeatEndDate && { repeatEndDate: task.repeatEndDate })
              })
              tasksCreated++
            }
          }
        }
      }

      // Create selected calendar events
      for (const event of proposals.calendarEvents) {
        if (selectedEvents.has(event.id)) {
          await createCalendarEvents(event)
          eventsCreated++
        }
      }

      // Success notification
      const messages = []
      if (tasksCreated > 0) messages.push(`${tasksCreated} task${tasksCreated > 1 ? 's' : ''}`)
      if (eventsCreated > 0) messages.push(`${eventsCreated} calendar event${eventsCreated > 1 ? 's' : ''}`)
      
      toast.success(`Created ${messages.join(' and ')}!`)
      onClose()
    } catch (error) {
      console.error('Creation error:', error)
      toast.error('Failed to create some items')
    } finally {
      setIsCreating(false)
    }
  }

  const createCalendarEvents = async (event: CalendarEvent) => {
    // Store calendar events in localStorage for now
    // In a full implementation, this would integrate with Google Calendar, Outlook, etc.
    const existingEvents = JSON.parse(localStorage.getItem('calendarEvents') || '[]')
    
    if (event.recurrence) {
      const recurringEvents = generateRecurringEvents(event)
      const eventsToStore = recurringEvents.map(e => ({
        ...e,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate?.toISOString() || null,
        recurrence: {
          ...e.recurrence,
          endDate: e.recurrence?.endDate?.toISOString() || null
        }
      }))
      existingEvents.push(...eventsToStore)
    } else {
      existingEvents.push({
        ...event,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate?.toISOString() || null
      })
    }
    
    localStorage.setItem('calendarEvents', JSON.stringify(existingEvents))
    // Notify any open pages to refresh calendar view
    console.log('🔧 [CALENDAR] Dispatching calendarEventsUpdated event')
    try { 
      window.dispatchEvent(new Event('calendarEventsUpdated')) 
      console.log('✅ [CALENDAR] Event dispatched successfully')
    } catch (error) {
      console.error('❌ [CALENDAR] Failed to dispatch event:', error)
    }
  }

  const formatRecurrence = (event: CalendarEvent): string => {
    if (!event.recurrence) return 'One-time event'
    
    const { type, interval, daysOfWeek, count } = event.recurrence
    
    let description = ''
    if (interval === 1) {
      description = `${type}`
    } else {
      description = `Every ${interval} ${type}s`
    }
    
    if (daysOfWeek && daysOfWeek.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const days = daysOfWeek.map(d => dayNames[d]).join(', ')
      description += ` (${days})`
    }
    
    if (count) {
      description += `, ${count} times`
    } else {
      description += `, ongoing`
    }
    
    return description
  }

  const getIntentIcon = () => {
    switch (proposals.intent) {
      case 'calendar_only': return '📅'
      case 'task_and_calendar': return '📋📅'
      default: return '📋'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {getIntentIcon()} Voice Calendar Integration
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                AI detected {proposals.intent.replace('_', ' and ')} from your voice input
              </p>
              <div className="mt-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/20 rounded text-sm text-blue-800 dark:text-blue-300">
                Confidence: {Math.round(proposals.confidence * 100)}%
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Original Transcript */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              🎤 Your Voice Input:
            </h3>
            <p className="text-gray-700 dark:text-gray-300 italic">
              "{transcript}"
            </p>
          </div>

          {/* Tasks Section */}
          {proposals.tasks.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                📋 Tasks ({proposals.tasks.length})
              </h3>
              <div className="space-y-3">
                {proposals.tasks.map(task => (
                  <div key={task.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedTasks.has(task.id)}
                        onChange={() => handleTaskToggle(task.id)}
                        className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {task.title}
                        </h4>
                        {task.summary && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {task.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 rounded">
                            {task.priority} Priority
                          </span>
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 rounded">
                            {task.energy} Energy
                          </span>
                          {task.estimateMin && (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                              {task.estimateMin} min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendar Events Section */}
          {proposals.calendarEvents.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                📅 Calendar Events ({proposals.calendarEvents.length})
              </h3>
              <div className="space-y-3">
                {proposals.calendarEvents.map(event => (
                  <div key={event.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedEvents.has(event.id)}
                        onChange={() => handleEventToggle(event.id)}
                        className="mt-1 h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {event.title}
                        </h4>
                        {event.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {event.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>📅 {format(event.startDate, 'MMM d, yyyy')}</span>
                          <span>🕐 {format(event.startDate, 'h:mm a')}</span>
                          <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/20 rounded">
                            {formatRecurrence(event)}
                          </span>
                        </div>
                        
                        {event.recurrence && (
                          <div className="mt-2">
                            <button
                              onClick={() => toggleEventExpansion(event.id)}
                              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            >
                              {expandedEvents.has(event.id) ? '↑ Hide' : '↓ Preview'} upcoming events
                            </button>
                            
                            {expandedEvents.has(event.id) && (
                              <div className="mt-2 bg-gray-50 dark:bg-gray-700 rounded p-3">
                                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                  Next 5 occurrences:
                                </div>
                                <div className="space-y-1 text-xs">
                                  {generateRecurringEvents(event).slice(0, 5).map((recurringEvent, idx) => (
                                    <div key={idx} className="flex justify-between">
                                      <span>{format(recurringEvent.startDate, 'EEE, MMM d, yyyy')}</span>
                                      <span>{format(recurringEvent.startDate, 'h:mm a')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Selected: {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''}, {selectedEvents.size} event{selectedEvents.size !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" className="mr-2" checked={useStaging} onChange={(e) => setUseStaging(e.target.checked)} />
                Use Staging for tasks
              </label>
              <button
                onClick={onClose}
                disabled={isCreating}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createSelectedItems}
                disabled={isCreating || (selectedTasks.size === 0 && selectedEvents.size === 0)}
                className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md transition-colors flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    ✨ Create Selected Items
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
