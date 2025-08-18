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
  intent: 'task_only' | 'calendar_only' | 'task_and_calendar' | 'needs_clarification'
  tasks: Array<{
    id: string
    title: string
    summary?: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    energy?: 'LOW' | 'MEDIUM' | 'HIGH'
    estimateMin?: number
    dueAt?: string
    isRepeatable?: boolean
    // Add all repeatable fields to match TaskProposal interface
    repeatPattern?: 'daily' | 'weekly' | 'monthly' | 'custom'
    repeatInterval?: number
    repeatDays?: number[]
    repeatEndDate?: string
    repeatCount?: number
    parentTaskId?: string
    nextDueDate?: string
  }>
  calendarEvents: CalendarEvent[]
  clarifyingQuestions?: string[]
  confidence: number
}

const CALENDAR_KEYWORDS = [
  'every', 'daily', 'weekly', 'monthly', 'schedule', 'appointment',
  'meeting', 'remind', 'calendar', 'weekend', 'weekday', 'monday',
  'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'morning', 'afternoon', 'evening', 'tonight', 'tomorrow', 'next week',
  'next month', 'recurring', 'repeat', 'regularly'
]

const TIME_PATTERNS: { [key: string]: { hour: number; minute: number } } = {
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

  private forceClarificationForVagueInput(transcript: string): boolean {
    const lowerTranscript = transcript.toLowerCase()
    
    // Check if the input already has sufficient details
    const hasSpecificTime = /(?:at|by|before|after)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)/i.test(transcript) ||
                           /(?:morning|afternoon|evening|night)/i.test(transcript) ||
                           /(?:eleven|twelve|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(transcript)
    
    const hasSpecificDay = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month))/i.test(transcript)
    
    const hasSpecificAction = /(?:meeting|appointment|call|task|reminder|event)/i.test(transcript)
    
    // If we have specific time, day, and action, we probably don't need clarification
    if (hasSpecificTime && hasSpecificDay && hasSpecificAction) {
      console.log('🔧 [VOICE] Input has sufficient details - no clarification needed:', {
        hasSpecificTime,
        hasSpecificDay,
        hasSpecificAction
      })
      return false
    }
    
    // Check for smart default patterns that should NOT force clarification
    const smartDefaultPatterns = [
      'every week',
      'every weekend', 
      'weekly',
      'monthly',
      'daily'
    ]
    
    const hasSmartDefaults = smartDefaultPatterns.some(pattern => lowerTranscript.includes(pattern))
    
    // Common vague patterns that should always trigger clarification
    const vaguePatterns = [
      'regularly',
      'often',
      'sometimes',
      'sometime',
      'later',
      'when i have time',
      'on a day',
      'during the week',
      'this week',
      'next week'
    ]
    
    const isVague = vaguePatterns.some(pattern => lowerTranscript.includes(pattern))
    
    // Don't force clarification if we have smart defaults, even if other patterns are vague
    if (hasSmartDefaults) {
      console.log('🔧 [VOICE] Input has smart defaults - not forcing clarification:', {
        hasSmartDefaults,
        isVague,
        smartDefaultPatterns: smartDefaultPatterns.filter(pattern => lowerTranscript.includes(pattern))
      })
      return false
    }
    
    return isVague
  }

  async processVoiceInput(transcript: string, clarifyThreshold: number = 0.4): Promise<VoiceCalendarResult> {
    // Validate API key first
    if (!this.apiKey || this.apiKey.trim() === '') {
      console.error('VoiceCalendarIntegration: No API key provided')
      throw new Error('OpenAI API key is required')
    }

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
      console.log('VoiceCalendarIntegration: Making OpenAI API call with key:', this.apiKey.substring(0, 8) + '...')
      
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
        const errorText = await response.text()
        console.error('VoiceCalendarIntegration: OpenAI API error:', response.status, response.statusText, errorText)
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('VoiceCalendarIntegration: OpenAI response received:', data)
      
      const raw = data.choices?.[0]?.message?.content
      if (!raw) {
        throw new Error('No content in OpenAI response')
      }
      
      let result
      try {
        result = JSON.parse(raw)
      } catch (e) {
        console.error('VoiceCalendarIntegration: JSON parse error:', e, 'Raw content:', raw)
        // Ask follow-up clarification when ambiguous
        return {
          intent: 'needs_clarification',
          tasks: [{
            id: `clarify_${Date.now()}`,
            title: '❓ Need more details',
            summary: `Original request: "${transcript}"\n\nPlease provide more specific details about timing, location, and frequency.`,
            priority: 'MEDIUM',
            energy: 'LOW',
            estimateMin: 5,
            dueAt: undefined,
            isRepeatable: false
          }],
          calendarEvents: [],
          clarifyingQuestions: [
            'What specific time?',
            'Which day(s) of the week?',
            'How often should this repeat?',
            'Where should this happen?'
          ],
          confidence: 0.2
        }
      }

      // Determine threshold (settings or default 0.4)
      const threshold = typeof clarifyThreshold === 'number' ? clarifyThreshold : 0.4
      
      // Check if the input already has sufficient details before deciding on clarification
      const hasSufficientDetails = this.hasSufficientDetails(transcript)
      
      // ALWAYS ask for clarification if confidence is low or if the input seems vague
      const isVague = this.isInputVague(transcript)
      const needsClarification = (result.confidence <= threshold || isVague || !result.calendarEvents || result.calendarEvents.length === 0) && !hasSufficientDetails
      
      console.log('🔧 [VOICE] Clarification analysis:', {
        transcript,
        resultConfidence: result.confidence,
        threshold,
        isVague,
        hasCalendarEvents: !!result.calendarEvents && result.calendarEvents.length > 0,
        hasSufficientDetails,
        needsClarification,
        forceClarification: this.forceClarificationForVagueInput(transcript)
      })
      
      if (needsClarification) {
        console.log('VoiceCalendarIntegration: Input needs clarification - confidence:', result.confidence, 'isVague:', isVague, 'hasSufficientDetails:', hasSufficientDetails)
        
        // Generate clarifying questions
        const questions = this.generateClarifyingQuestions(transcript, result)
        
        // If no questions are needed, don't ask for clarification
        if (questions.length === 0) {
          console.log('🔧 [VOICE] No clarification questions needed - proceeding with task creation')
          return this.processCalendarResult(result)
        }
        
        return {
          intent: 'needs_clarification',
          tasks: [{
            id: `clarify_${Date.now()}`,
            title: '❓ Need more details',
            summary: `Original request: "${transcript}"\n\nPlease provide more specific details.`,
            priority: 'MEDIUM',
            energy: 'LOW',
            estimateMin: 5,
            dueAt: undefined,
            isRepeatable: false
          }],
          calendarEvents: [],
          clarifyingQuestions: questions,
          confidence: Math.min(result.confidence || 0.3, 0.4)
        }
      }

      // Check if we need to force clarification for vague inputs
      if (this.forceClarificationForVagueInput(transcript)) {
        console.log('🔧 [VOICE] Forcing clarification for vague input:', transcript)
        const questions = this.generateClarifyingQuestions(transcript, result)
        
        // If no questions are needed, don't ask for clarification
        if (questions.length === 0) {
          console.log('🔧 [VOICE] No clarification questions needed - proceeding with task creation')
          return this.processCalendarResult(result)
        }
        
        return {
          intent: 'needs_clarification',
          tasks: [{
            id: `clarify_${Date.now()}`,
            title: '❓ Need more details',
            summary: `Original request: "${transcript}"\n\nPlease provide more specific details.`,
            priority: 'MEDIUM',
            energy: 'LOW',
            estimateMin: 5,
            dueAt: undefined,
            isRepeatable: false
          }],
          calendarEvents: [],
          clarifyingQuestions: questions,
          confidence: 0.2
        }
      }

      return this.processCalendarResult(result)
    } catch (error) {
      console.error('VoiceCalendarIntegration: Processing failed:', error)
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

CRITICAL RULES:
1. If the voice input is ambiguous about timing, location, or specifics, you MUST set confidence to 0.4 or lower and create a clarifying question task instead of guessing.
2. DO NOT split single requests into multiple tasks unless explicitly requested (e.g., "create 3 tasks for...")
3. If someone says "every weekend" or similar recurring language, create ONE repeatable task/event, not multiple separate ones
4. Be SKEPTICAL and ask questions for vague plans
5. If the input already contains specific time, day, and action details, DO NOT ask for clarification - proceed with task creation

ALWAYS ASK CLARIFYING QUESTIONS FOR:
- Vague timing: "sometime this week", "on a day during the week", "later"
- Unclear recurrence: "regularly", "often", "sometimes"
- Missing specifics: "eat pizza" without time/day, "meeting" without details
- Conflicting information: "every weekend at 6pm" (Saturday or Sunday or both?)

SMART DEFAULTS - DON'T ASK CLARIFICATION FOR:
- "every week" → Set to next Monday at 9am, weekly repeat
- "every weekend" → Set to next Saturday at 10am, weekly repeat on weekends [0,6]
- "weekly" → Set to next Monday at 9am, weekly repeat
- "monthly" → Set to next month same day, monthly repeat
- "daily" → Set to tomorrow at 9am, daily repeat

DO NOT ASK CLARIFICATION FOR:
- Specific meetings: "meeting next monday at 11am" (has time, day, and action)
- Specific appointments: "doctor appointment tomorrow at 2pm" (has time, day, and action)
- Specific tasks: "review project on friday morning" (has day and time context)
- Specific events: "team lunch next wednesday at noon" (has day, time, and action)

Key patterns to detect:
- Time references: "every weekend", "daily", "weekly", "monthly", "every Monday"
- Specific times: "morning", "afternoon", "evening", "at 3pm", "at 6pm"  
- Duration estimates: "30 minutes", "1 hour", "quick task"
- Priority indicators: "urgent", "important", "when I have time"
- Energy levels: "easy task", "intensive work", "quick thing"

For recurring patterns:
- "every weekend" = weekly recurrence on Saturday AND Sunday (both days)
- "every weekday" = weekly recurrence Monday-Friday  
- "every Monday" = weekly recurrence on Mondays
- "daily" = daily recurrence
- "weekly" = weekly recurrence (same day of week)
- "monthly" = monthly recurrence

IMPORTANT: For repeatable tasks without a specific end date, automatically set repeatEndDate to today's date to prevent infinite repetition.

Response format:
{
  "intent": "task_only" | "calendar_only" | "task_and_calendar" | "needs_clarification",
  "tasks": [
    {
      "id": "unique_id",
      "title": "Task title",
      "summary": "Brief description",
      "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
      "energy": "LOW" | "MEDIUM" | "HIGH", 
      "estimateMin": number_or_null,
      "dueAt": "ISO_date_string_or_null",
      "isRepeatable": boolean,
      "repeatPattern": "daily" | "weekly" | "monthly" | null,
      "repeatInterval": number_or_null,
      "repeatDays": [0,1,2,3,4,5,6] | null,
      "repeatCount": number_or_null,
      "repeatEndDate": "ISO_date_string_or_null"
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
        "daysOfWeek": [0,1,2,3,4,5,6], // 0=Sun, 6=Sat, for "every weekend" use [0,6]
        "count": number_of_occurrences_or_null
      } | null
    }
  ],
  "clarifyingQuestions": [
    "What specific time?",
    "Which day of the week?",
    "How often should this repeat?"
  ],
  "confidence": 0.0_to_1.0
}

Examples:
- "Set a recurring reminder for Chick-fil-A every weekend at 6pm" → ONE repeatable task + calendar events for Sat+Sun at 6pm, confidence 0.9
  Task: isRepeatable: true, repeatPattern: "weekly", repeatInterval: 1, repeatDays: [0,6], repeatCount: 52, repeatEndDate: "2024-12-31T23:59:59.000Z"
- "I want to eat pizza every week" → SMART DEFAULT: Set to next Monday at 9am, weekly repeat, confidence 0.8
  Task: isRepeatable: true, repeatPattern: "weekly", repeatInterval: 1, repeatDays: [1], dueAt: "next-monday-9am", repeatCount: 52, repeatEndDate: "2024-12-31T23:59:59.000Z"
- "I want to go eat pizza every weekend" → SMART DEFAULT: Set to next Saturday at 10am, weekly repeat on weekends, confidence 0.8
  Task: isRepeatable: true, repeatPattern: "weekly", repeatInterval: 1, repeatDays: [0,6], dueAt: "next-saturday-10am", repeatCount: 52, repeatEndDate: "2024-12-31T23:59:59.000Z"
- "Go to chick fil a on a day during the week" → needs_clarification, confidence 0.2, questions: ["Which day of the week?", "What time?"]
- "Daily standup at 9am weekdays" → ONE repeatable task + weekly calendar events (Mon-Fri 9am), confidence 0.95
  Task: isRepeatable: true, repeatPattern: "weekly", repeatInterval: 1, repeatDays: [1,2,3,4,5], repeatCount: 52, repeatEndDate: "2024-12-31T23:59:59.000Z"
- "Review project every Monday morning at 9am" → ONE repeatable task + weekly calendar (Mondays 9am), confidence 0.9
  Task: isRepeatable: true, repeatPattern: "weekly", repeatInterval: 1, repeatDays: [1], repeatCount: 52, repeatEndDate: "2024-12-31T23:59:59.000Z"

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

    const tasks = result.tasks?.map((task: any) => {
      // Apply smart defaults for repeatable tasks
      let processedTask = this.applySmartDefaults(task)
      
      // Auto-set end date for repeatable tasks without an end date
      if (processedTask.isRepeatable && !processedTask.repeatEndDate) {
        const today = new Date()
        today.setHours(23, 59, 59, 999) // End of today
        processedTask.repeatEndDate = today.toISOString()
        console.log('🔧 [VOICE] Auto-setting repeatEndDate to today for repeatable task:', processedTask.title)
      }
      
      return processedTask
    }) || []

    return {
      intent: result.intent || 'task_and_calendar',
      tasks,
      calendarEvents: events,
      confidence: Math.max(0, Math.min(1, result.confidence || 0.8))
    }
  }

  /**
   * Apply smart defaults to repeatable tasks based on natural language patterns
   */
  private applySmartDefaults(task: any): any {
    if (!task.isRepeatable) {
      return {
        ...task,
        id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : undefined
      }
    }

    const now = new Date()
    let processedTask = {
      ...task,
      id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : undefined,
      repeatEndDate: task.repeatEndDate || new Date(now.getFullYear() + 1, 11, 31).toISOString() // Default to end of next year
    }

    // If no due date is set, apply smart defaults based on repeat pattern
    if (!processedTask.dueAt) {
      switch (processedTask.repeatPattern) {
        case 'weekly':
          if (processedTask.repeatDays && processedTask.repeatDays.length > 0) {
            // Find the next occurrence of the specified day(s)
            const nextOccurrence = this.findNextOccurrence(processedTask.repeatDays)
            processedTask.dueAt = nextOccurrence.toISOString()
          } else {
            // Default to next Monday at 9am
            const nextMonday = this.getNextDayOfWeek(1) // Monday = 1
            nextMonday.setHours(9, 0, 0, 0)
            processedTask.dueAt = nextMonday.toISOString()
          }
          break
          
        case 'monthly':
          // Default to same day next month at 9am
          const nextMonth = new Date(now)
          nextMonth.setMonth(nextMonth.getMonth() + 1)
          nextMonth.setHours(9, 0, 0, 0)
          processedTask.dueAt = nextMonth.toISOString()
          break
          
        case 'daily':
          // Default to tomorrow at 9am
          const tomorrow = new Date(now)
          tomorrow.setDate(tomorrow.getDate() + 1)
          tomorrow.setHours(9, 0, 0, 0)
          processedTask.dueAt = tomorrow.toISOString()
          break
          
        default:
          // Default to next Monday at 9am
          const defaultDate = this.getNextDayOfWeek(1)
          defaultDate.setHours(9, 0, 0, 0)
          processedTask.dueAt = defaultDate.toISOString()
      }
      
      console.log('🔧 [VOICE] Applied smart default due date:', {
        title: processedTask.title,
        pattern: processedTask.repeatPattern,
        dueAt: processedTask.dueAt
      })
    }

    return processedTask
  }

  /**
   * Find the next occurrence of a specific day of the week
   */
  private findNextOccurrence(daysOfWeek: number[]): Date {
    const now = new Date()
    const today = now.getDay() // 0 = Sunday, 1 = Monday, etc.
    
    // Sort days to find the next one
    const sortedDays = [...daysOfWeek].sort((a, b) => a - b)
    
    // Find the next day this week
    for (const day of sortedDays) {
      if (day > today) {
        const nextDate = new Date(now)
        nextDate.setDate(now.getDate() + (day - today))
        nextDate.setHours(9, 0, 0, 0) // Default to 9am
        return nextDate
      }
    }
    
    // If no day this week, find the first day next week
    const firstDayNextWeek = sortedDays[0]
    const daysUntilNextWeek = (7 - today) + firstDayNextWeek
    const nextDate = new Date(now)
    nextDate.setDate(now.getDate() + daysUntilNextWeek)
    nextDate.setHours(9, 0, 0, 0) // Default to 9am
    return nextDate
  }

  /**
   * Get the next occurrence of a specific day of the week
   */
  private getNextDayOfWeek(targetDay: number): Date {
    const now = new Date()
    const today = now.getDay()
    const daysUntilTarget = (targetDay - today + 7) % 7
    const nextDate = new Date(now)
    nextDate.setDate(now.getDate() + daysUntilTarget)
    return nextDate
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
            if (daysOfWeek.length === 1) {
              // Single day weekly recurrence - just add 7 days
              currentDate = addDays(currentDate, 7)
            } else {
              // Multiple days (e.g., weekend = Saturday + Sunday)
              const currentDay = currentDate.getDay()
              const currentIndex = daysOfWeek.indexOf(currentDay)
              
              if (currentIndex !== -1 && currentIndex < daysOfWeek.length - 1) {
                // Move to next day in the same week
                const nextDay = daysOfWeek[currentIndex + 1]
                currentDate = addDays(currentDate, nextDay - currentDay)
              } else {
                // Move to first day of next week
                const nextWeekFirstDay = daysOfWeek[0]
                const daysUntilNextWeek = (7 - currentDay) + nextWeekFirstDay
                currentDate = addDays(currentDate, daysUntilNextWeek)
              }
            }
          } else {
            // No specific days specified, just add weeks
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

  private isInputVague(transcript: string): boolean {
    const lower = transcript.toLowerCase()
    
    console.log('🔧 [VOICE] Checking if input is vague:', lower)
    
    // Check for vague patterns that should trigger clarification
    const vaguePatterns = [
      'regularly',
      'often',
      'sometimes',
      'sometime',
      'later',
      'when i have time',
      'on a day during the week',
      'this week',
      'next week'
    ]
    
    // These patterns are now handled with smart defaults, not considered vague
    const smartDefaultPatterns = [
      'every week',
      'every weekend', 
      'weekly',
      'monthly',
      'daily'
    ]
    
    const isVague = vaguePatterns.some(pattern => lower.includes(pattern))
    const hasSmartDefaults = smartDefaultPatterns.some(pattern => lower.includes(pattern))
    
    console.log('🔧 [VOICE] Vague pattern check result:', { 
      isVague, 
      hasSmartDefaults,
      matchedVaguePatterns: vaguePatterns.filter(pattern => lower.includes(pattern)),
      matchedSmartDefaults: smartDefaultPatterns.filter(pattern => lower.includes(pattern))
    })
    
    // Only consider truly vague patterns as vague, not smart default patterns
    return isVague && !hasSmartDefaults
  }

  private generateClarifyingQuestions(transcript: string, result: any): string[] {
    const lower = transcript.toLowerCase()
    const questions: string[] = []
    
    // Analyze what's already provided vs what's missing
    const hasTime = /(?:at|by|before|after)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)/i.test(transcript) ||
                    /(?:morning|afternoon|evening|night)/i.test(transcript) ||
                    /(?:eleven|twelve|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(transcript)
    
    const hasDay = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month))/i.test(transcript)
    
    const hasAction = /(?:meeting|appointment|call|task|reminder|event)/i.test(transcript)
    
    const hasLocation = /(?:restaurant|place|location|where|at\s+the|in\s+the)/i.test(transcript)
    
    const hasRecurrence = /(?:every|weekly|daily|monthly|repeat|recurring)/i.test(transcript)
    
    console.log('🔧 [VOICE] Analyzing input for missing details:', {
      transcript,
      hasTime,
      hasDay,
      hasAction,
      hasLocation,
      hasRecurrence
    })
    
    // Only ask for details that are actually missing
    if (!hasTime) {
      questions.push('What specific time?')
    }
    
    if (!hasDay) {
      if (hasRecurrence) {
        questions.push('Which day(s) of the week?')
      } else {
        questions.push('Which day?')
      }
    }
    
    if (hasRecurrence && !hasTime) {
      questions.push('How often should this repeat?')
    }
    
    // Only ask for location if it's relevant (e.g., going somewhere, eating out)
    if (!hasLocation && (lower.includes('go to') || lower.includes('eat') || lower.includes('visit') || lower.includes('meet'))) {
      questions.push('Where should this happen?')
    }
    
    // If we have all the essential details, don't ask unnecessary questions
    if (questions.length === 0 && hasTime && hasDay && hasAction) {
      console.log('🔧 [VOICE] All essential details provided - no clarification questions needed')
      return []
    }
    
    return questions
  }

  private hasSufficientDetails(transcript: string): boolean {
    const lower = transcript.toLowerCase()
    
    // Check for specific time
    const hasTime = /(?:at|by|before|after)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)/i.test(transcript) ||
                    /(?:morning|afternoon|evening|night)/i.test(transcript) ||
                    /(?:eleven|twelve|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(transcript)
    
    // Check for specific day
    const hasDay = /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month))/i.test(transcript)
    
    // Check for specific action
    const hasAction = /(?:meeting|appointment|call|task|reminder|event)/i.test(transcript)
    
    // If we have time, day, and action, that's sufficient for most cases
    if (hasTime && hasDay && hasAction) {
      console.log('🔧 [VOICE] Input has sufficient details (time, day, action):', { hasTime, hasDay, hasAction })
      return true
    }
    
    // For recurring tasks, we need more specific details
    const hasRecurrence = /(?:every|weekly|daily|monthly|repeat|recurring)/i.test(transcript)
    if (hasRecurrence) {
      // Recurring tasks need more specific details
      if (hasTime && hasDay) {
        console.log('🔧 [VOICE] Recurring task has sufficient details (time, day):', { hasTime, hasDay, hasRecurrence })
        return true
      }
    }
    
    console.log('🔧 [VOICE] Input lacks sufficient details:', { hasTime, hasDay, hasAction, hasRecurrence })
    return false
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
