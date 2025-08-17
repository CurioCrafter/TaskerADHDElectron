/**
 * Voice-to-Calendar Integration Service
 * Processes voice input to detect scheduling patterns and create calendar events
 */

import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, parseISO } from 'date-fns'

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  startDate: Date
  endDate?: Date
  isAllDay?: boolean
  recurrence?: RecurrencePattern
  taskId?: string
  energy?: 'LOW' | 'MEDIUM' | 'HIGH'
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
}

export interface RecurrencePattern {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number // every N days/weeks/months
  daysOfWeek?: number[] // 0=Sunday, 1=Monday, etc.
  endDate?: Date
  count?: number // number of occurrences
}

export interface VoiceCalendarResult {
  intent: 'task_only' | 'calendar_only' | 'task_and_calendar'
  tasks: Array<{
    id: string
    title: string
    summary?: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    energy?: 'LOW' | 'MEDIUM' | 'HIGH'
    estimateMin?: number
    dueAt?: string
    isRepeatable?: boolean
  }>
  calendarEvents: CalendarEvent[]
  confidence: number
}

const CALENDAR_KEYWORDS = [
  'every', 'daily', 'weekly', 'monthly', 'schedule', 'appointment',
  'meeting', 'remind', 'calendar', 'weekend', 'weekday', 'monday',
  'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'morning', 'afternoon', 'evening', 'tonight', 'tomorrow', 'next week',
  'next month', 'recurring', 'repeat', 'regularly'
]

const TIME_PATTERNS = {
  'morning': { hour: 9, minute: 0 },
  'afternoon': { hour: 14, minute: 0 },
  'evening': { hour: 18, minute: 0 },
  'night': { hour: 20, minute: 0 }
}

export class VoiceCalendarIntegration {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async processVoiceInput(transcript: string): Promise<VoiceCalendarResult> {
    // First, determine if this needs calendar integration
    const needsCalendar = this.detectCalendarIntent(transcript)
    
    if (!needsCalendar) {
      // Fallback to regular task creation
      return {
        intent: 'task_only',
        tasks: await this.extractTasksOnly(transcript),
        calendarEvents: [],
        confidence: 0.8
      }
    }

    // Enhanced processing for calendar integration
    const prompt = this.buildCalendarPrompt(transcript)
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: prompt
            },
            {
              role: 'user',
              content: transcript
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json()
      const result = JSON.parse(data.choices[0].message.content)
      
      return this.processCalendarResult(result)
    } catch (error) {
      console.error('Voice calendar integration failed:', error)
      // Fallback to task-only processing
      return {
        intent: 'task_only',
        tasks: await this.extractTasksOnly(transcript),
        calendarEvents: [],
        confidence: 0.3
      }
    }
  }

  private detectCalendarIntent(transcript: string): boolean {
    const lowerTranscript = transcript.toLowerCase()
    return CALENDAR_KEYWORDS.some(keyword => lowerTranscript.includes(keyword))
  }

  private buildCalendarPrompt(transcript: string): string {
    return `You are an expert at interpreting voice commands for task management and calendar scheduling.

IMPORTANT: You must respond with valid JSON only. No other text.

Analyze this voice input and determine:
1. What tasks need to be created
2. What calendar events need to be scheduled
3. Any recurring patterns mentioned

Key patterns to detect:
- Time references: "every weekend", "daily", "weekly", "monthly", "every Monday"
- Specific times: "morning", "afternoon", "evening", "at 3pm"  
- Duration estimates: "30 minutes", "1 hour", "quick task"
- Priority indicators: "urgent", "important", "when I have time"
- Energy levels: "easy task", "intensive work", "quick thing"

For recurring patterns:
- "every weekend" = weekly recurrence on Saturday/Sunday
- "every weekday" = weekly recurrence Monday-Friday  
- "every Monday" = weekly recurrence on Mondays
- "daily" = daily recurrence
- "weekly" = weekly recurrence (same day of week)
- "monthly" = monthly recurrence

Response format:
{
  "intent": "task_only" | "calendar_only" | "task_and_calendar",
  "tasks": [
    {
      "id": "unique_id",
      "title": "Task title",
      "summary": "Brief description",
      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      "energy": "LOW" | "MEDIUM" | "HIGH", 
      "estimateMin": number_or_null,
      "dueAt": "ISO_date_string_or_null",
      "isRepeatable": boolean
    }
  ],
  "calendarEvents": [
    {
      "id": "unique_id", 
      "title": "Event title",
      "description": "Optional description",
      "startDate": "ISO_date_string",
      "endDate": "ISO_date_string_or_null",
      "isAllDay": boolean,
      "recurrence": {
        "type": "daily" | "weekly" | "monthly" | "yearly",
        "interval": number,
        "daysOfWeek": [0,1,2,3,4,5,6] // 0=Sun, 6=Sat, null if not weekly
        "count": number_of_occurrences_or_null
      } | null
    }
  ],
  "confidence": 0.0_to_1.0
}

Examples:
- "Go to grocery store every weekend" → task + weekly calendar events (Sat/Sun)
- "Daily standup at 9am" → weekly calendar event (weekdays at 9am)
- "Review project every Monday morning" → task + weekly calendar (Mondays 9am)
- "Water plants twice a week" → task + custom recurrence

Current date/time context: ${new Date().toISOString()}
User timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  }

  private async extractTasksOnly(transcript: string): Promise<any[]> {
    // Fallback to simple task extraction without calendar
    const prompt = `Extract tasks from this voice input. Respond with JSON only:
{
  "tasks": [
    {
      "id": "unique_id",
      "title": "Task title", 
      "summary": "Brief description",
      "priority": "MEDIUM",
      "energy": "MEDIUM",
      "estimateMin": null
    }
  ]
}

Voice input: "${transcript}"`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      })

      if (response.ok) {
        const data = await response.json()
        const result = JSON.parse(data.choices[0].message.content)
        return result.tasks || []
      }
    } catch (error) {
      console.error('Task extraction fallback failed:', error)
    }

    // Ultimate fallback
    return [{
      id: `task_${Date.now()}`,
      title: transcript.slice(0, 50),
      summary: transcript,
      priority: 'MEDIUM',
      energy: 'MEDIUM',
      estimateMin: null
    }]
  }

  private processCalendarResult(result: any): VoiceCalendarResult {
    // Process and validate the result from GPT-4
    const events = result.calendarEvents?.map((event: any) => ({
      ...event,
      id: event.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startDate: new Date(event.startDate),
      endDate: event.endDate ? new Date(event.endDate) : undefined,
      recurrence: event.recurrence ? {
        ...event.recurrence,
        endDate: event.recurrence.endDate ? new Date(event.recurrence.endDate) : undefined
      } : undefined
    })) || []

    const tasks = result.tasks?.map((task: any) => ({
      ...task,
      id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : undefined
    })) || []

    return {
      intent: result.intent || 'task_and_calendar',
      tasks,
      calendarEvents: events,
      confidence: Math.max(0, Math.min(1, result.confidence || 0.8))
    }
  }

  /**
   * Generate recurring calendar events based on pattern
   */
  generateRecurringEvents(baseEvent: CalendarEvent, maxEvents: number = 52): CalendarEvent[] {
    if (!baseEvent.recurrence) return [baseEvent]

    const events: CalendarEvent[] = []
    const { type, interval, daysOfWeek, count, endDate } = baseEvent.recurrence
    let currentDate = new Date(baseEvent.startDate)
    let eventCount = 0

    const maxCount = count || maxEvents
    const maxDate = endDate || addMonths(new Date(), 12) // Default: 1 year ahead

    while (eventCount < maxCount && currentDate <= maxDate) {
      // Create event for current date
      const event: CalendarEvent = {
        ...baseEvent,
        id: `${baseEvent.id}_${eventCount}`,
        startDate: new Date(currentDate),
        endDate: baseEvent.endDate ? new Date(currentDate.getTime() + (baseEvent.endDate.getTime() - baseEvent.startDate.getTime())) : undefined
      }
      events.push(event)

      // Calculate next occurrence
      switch (type) {
        case 'daily':
          currentDate = addDays(currentDate, interval)
          break
        case 'weekly':
          if (daysOfWeek && daysOfWeek.length > 0) {
            // Find next day in daysOfWeek
            const today = currentDate.getDay()
            const nextDayIndex = daysOfWeek.findIndex(day => day > today)
            if (nextDayIndex !== -1) {
              const daysUntilNext = daysOfWeek[nextDayIndex] - today
              currentDate = addDays(currentDate, daysUntilNext)
            } else {
              // Go to next week, first day
              const daysUntilNextWeek = (7 - today) + daysOfWeek[0]
              currentDate = addDays(currentDate, daysUntilNextWeek)
            }
          } else {
            currentDate = addWeeks(currentDate, interval)
          }
          break
        case 'monthly':
          currentDate = addMonths(currentDate, interval)
          break
        default:
          // Stop if unknown recurrence type
          break
      }

      eventCount++
    }

    return events
  }
}

// Utility functions for calendar integration
export const CalendarUtils = {
  isWeekend: (date: Date): boolean => {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday or Saturday
  },

  isWeekday: (date: Date): boolean => {
    const day = date.getDay()
    return day >= 1 && day <= 5 // Monday through Friday
  },

  getNextWeekend: (from: Date = new Date()): Date => {
    const saturday = addDays(from, (6 - from.getDay()) % 7 || 7)
    return saturday
  },

  parseTimeString: (timeStr: string): { hour: number; minute: number } | null => {
    const time = timeStr.toLowerCase()
    
    // Check for named times
    if (TIME_PATTERNS[time]) {
      return TIME_PATTERNS[time]
    }

    // Parse "3pm", "9:30am", "14:00", etc.
    const timeMatch = time.match(/(\d{1,2})(:(\d{2}))?\s*(am|pm)?/)
    if (timeMatch) {
      let hour = parseInt(timeMatch[1])
      const minute = parseInt(timeMatch[3]) || 0
      const ampm = timeMatch[4]

      if (ampm === 'pm' && hour !== 12) hour += 12
      if (ampm === 'am' && hour === 12) hour = 0

      return { hour, minute }
    }

    return null
  }
}
