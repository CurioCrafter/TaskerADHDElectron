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
    
    // Common vague patterns that should always trigger clarification
    const vaguePatterns = [
      'every week',
      'every weekend', 
      'weekly',
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
    
    return vaguePatterns.some(pattern => lowerTranscript.includes(pattern))
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
      
      // ALWAYS ask for clarification if confidence is low or if the input seems vague
      const isVague = this.isInputVague(transcript)
      const needsClarification = result.confidence <= threshold || isVague || !result.calendarEvents || result.calendarEvents.length === 0
      
      if (needsClarification) {
        console.log('VoiceCalendarIntegration: Input needs clarification - confidence:', result.confidence, 'isVague:', isVague)
        
        // Generate clarifying questions
        const questions = this.generateClarifyingQuestions(transcript, result)
        
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
        const questions = [
          'What specific time?',
          'Which day(s) of the week?', 
          'How often should this repeat?',
          'Which restaurant or location?'
        ]
        
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

Analyze this voice input and determine:
1. What tasks need to be created (DEFAULT: create ONE task unless explicitly told to create multiple)
2. What calendar events need to be scheduled
3. Any recurring patterns mentioned
4. Whether the input is too vague and needs clarification

ALWAYS ASK CLARIFYING QUESTIONS FOR:
- Vague timing: "sometime this week", "on a day during the week", "later", "every weekend" (without specific time)
- Unclear recurrence: "regularly", "often", "sometimes", "every week" (without specific day/time)
- Missing specifics: "eat pizza" without time/day, "meeting" without details
- Non-specific plans: "I want to eat pizza every week" (What day? What time? Where?)
- Non-specific plans: "I want to go eat pizza every weekend" (What time? Which day of weekend? Where?)
- Conflicting information: "every weekend at 6pm" (Saturday or Sunday or both?)
- Generic recurring statements: "every week", "weekly" without specific day or time

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
  Task: isRepeatable: true, repeatPattern: "weekly", repeatInterval: 1, repeatDays: [0,6], repeatCount: 52
- "I want to eat pizza every week" → needs_clarification, confidence 0.2, questions: ["What day of the week?", "What time?", "Which restaurant or location?"]
- "I want to go eat pizza every weekend" → needs_clarification, confidence 0.2, questions: ["What time on the weekend?", "Saturday, Sunday, or both?", "Which restaurant?"]
- "Go to chick fil a on a day during the week" → needs_clarification, confidence 0.2, questions: ["Which day of the week?", "What time?"]
- "Daily standup at 9am weekdays" → ONE repeatable task + weekly calendar events (Mon-Fri 9am), confidence 0.95
  Task: isRepeatable: true, repeatPattern: "weekly", repeatInterval: 1, repeatDays: [1,2,3,4,5], repeatCount: 52
- "Review project every Monday morning at 9am" → ONE repeatable task + weekly calendar (Mondays 9am), confidence 0.9
  Task: isRepeatable: true, repeatPattern: "weekly", repeatInterval: 1, repeatDays: [1], repeatCount: 52

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
    
    // Check for vague patterns
    const vaguePatterns = [
      /every\s+week(?!\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))/i,
      /every\s+weekend(?!\s+at\s+\d)/i,
      /sometime\s+this\s+week/i,
      /on\s+a\s+day\s+during\s+the\s+week/i,
      /later/i,
      /regularly/i,
      /often/i,
      /sometimes/i
    ]
    
    return vaguePatterns.some(pattern => pattern.test(lower))
  }

  private generateClarifyingQuestions(transcript: string, result: any): string[] {
    const lower = transcript.toLowerCase()
    const questions: string[] = []
    
    if (lower.includes('every week') && !lower.includes('monday') && !lower.includes('tuesday') && !lower.includes('wednesday') && !lower.includes('thursday') && !lower.includes('friday') && !lower.includes('saturday') && !lower.includes('sunday')) {
      questions.push('Which specific day of the week?')
    }
    
    if (lower.includes('every weekend') && !lower.includes('at') && !lower.includes('pm') && !lower.includes('am')) {
      questions.push('What time on the weekend?')
      questions.push('Saturday, Sunday, or both days?')
    }
    
    if (lower.includes('sometime this week') || lower.includes('on a day during the week')) {
      questions.push('Which specific day?')
      questions.push('What time?')
    }
    
    if (!lower.includes('at') && !lower.includes('pm') && !lower.includes('am') && !lower.includes('morning') && !lower.includes('afternoon') && !lower.includes('evening')) {
      questions.push('What time?')
    }
    
    if (!lower.includes('where') && !lower.includes('restaurant') && !lower.includes('place') && !lower.includes('location')) {
      questions.push('Where should this happen?')
    }
    
    // Default questions if none specific
    if (questions.length === 0) {
      questions.push('What specific time?')
      questions.push('Which day(s) of the week?')
      questions.push('How often should this repeat?')
    }
    
    return questions
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
