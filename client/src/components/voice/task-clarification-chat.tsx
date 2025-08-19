'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { VoiceCalendarIntegration } from '@/services/llm/voice-calendar-integration'

interface TaskClarificationChatProps {
  isOpen: boolean
  onClose: () => void
  originalTranscript: string
  initialQuestions: string[]
  onTaskCreated: (task: any) => void
}

interface ChatMessage {
  id: string
  type: 'ai' | 'user'
  content: string
  timestamp: Date
  isQuestion?: boolean
}

export function TaskClarificationChat({ 
  isOpen, 
  onClose, 
  originalTranscript, 
  initialQuestions, 
  onTaskCreated 
}: TaskClarificationChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentTask, setCurrentTask] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debug: log props
  console.log('🔧 [CHAT] TaskClarificationChat props:', {
    isOpen,
    originalTranscript,
    initialQuestions: initialQuestions?.length || 0,
    onTaskCreated: !!onTaskCreated
  })

  // Initialize chat with AI questions
  useEffect(() => {
    console.log('🔧 [CHAT] useEffect triggered:', { isOpen, initialQuestionsLength: initialQuestions?.length || 0 })
    if (isOpen && initialQuestions.length > 0) {
      console.log('🔧 [CHAT] Setting up initial messages with questions:', initialQuestions)
      const aiMessages = initialQuestions.map((question, index) => ({
        id: `ai-${index}`,
        type: 'ai' as const,
        content: question,
        timestamp: new Date(),
        isQuestion: true
      }))
      
      setMessages([
        {
          id: 'ai-intro',
          type: 'ai',
          content: `Hi! I heard you say: "${originalTranscript}". Let me ask you some questions to understand exactly what you need so I can create the perfect task for you. Let's start with the basics:`,
          timestamp: new Date()
        },
        ...aiMessages
      ])
    }
  }, [isOpen, initialQuestions, originalTranscript])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsProcessing(true)

    try {
      // Get OpenAI key
      const openaiKey = localStorage.getItem('openai_api_key')
      if (!openaiKey) {
        throw new Error('OpenAI API key required')
      }

      // Process the conversation with AI
      const cal = new VoiceCalendarIntegration(openaiKey)
      
      // Build a comprehensive conversation context for better AI analysis
      const userResponses = messages
        .filter(m => m.type === 'user')
        .map(m => m.content)
        .join('\n')
      
      const fullConversation = `${originalTranscript}\n\nUser responses:\n${userResponses}\n\nLatest response: ${userMessage.content}`
      
      // Use a lower threshold for clarification chat to ensure we get detailed tasks
      const result = await cal.processVoiceInput(fullConversation, 0.1)
      
      // Debug: log what the AI returned
      console.log('🔧 [CHAT] AI result:', {
        intent: result.intent,
        confidence: result.confidence,
        tasks: result.tasks?.length || 0,
        clarifyingQuestions: result.clarifyingQuestions?.length || 0
      })

      // Check if we have enough information to create a task
      // The AI should be able to edit and refine the task based on conversation
      const hasEnoughInfo = userResponses.split('\n').filter(r => r.trim()).length >= 1 && 
                           result.confidence && result.confidence > 0.6

      if (hasEnoughInfo && result.tasks && result.tasks.length > 0) {
        // We have enough information to create the task
        const task = result.tasks[0]
        
        // Enhance the task with any missing details from the conversation
        const enhancedTask = enhanceTaskWithConversation(task, originalTranscript, messages, userMessage.content)
        
        setCurrentTask(enhancedTask)
        
        const aiMessage: ChatMessage = {
          id: `ai-success-${Date.now()}`,
          type: 'ai',
          content: `Great! I think I have enough information now. Here's what I understand:\n\n**${enhancedTask.title}**\n${enhancedTask.summary || ''}\n\nDue: ${enhancedTask.dueAt ? new Date(enhancedTask.dueAt).toLocaleDateString() : 'No due date'}\nPriority: ${enhancedTask.priority || 'Medium'}\n${enhancedTask.isRepeatable ? '🔄 This will be a repeatable task' : ''}\n\nDoes this look right? If so, click "Create Perfect Task" below. If you want to add more details or make changes, just keep chatting with me! I can edit the task as we go.`,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, aiMessage])
        toast.success('✅ Task is ready! Review and create, or keep chatting to refine it further!')
      } else if (userResponses.split('\n').filter(r => r.trim()).length >= 1) {
        // We have some information but need more - let's build a partial task
        const partialTask = buildPartialTaskFromConversation(originalTranscript, messages, userMessage.content)
        setCurrentTask(partialTask)
        
        const aiMessage: ChatMessage = {
          id: `ai-partial-${Date.now()}`,
          type: 'ai',
          content: `I'm building your task! Here's what I have so far:\n\n**${partialTask.title}**\n${partialTask.summary || ''}\n\nDue: ${partialTask.dueAt ? new Date(partialTask.dueAt).toLocaleDateString() : 'No due date'}\nPriority: ${partialTask.priority || 'Medium'}\n\nI still need a bit more information to make it perfect. Keep chatting with me!`,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, aiMessage])
        toast.success('🔄 Building your task! Keep providing details...')
      } else {
        // Still need more information - ask follow-up questions
        // The AI can adapt these questions based on what you've already told us
        const followUpQuestions = (result.clarifyingQuestions || [
          'What specific time should this task be done? (e.g., "6pm", "morning", "after lunch")',
          'Which day(s) of the week should this task repeat? (e.g., "every Monday", "weekends only")',
          'How often should this task repeat? (e.g., "daily", "weekly", "monthly")',
          'What is the specific location or context for this task? (e.g., "at home", "at work", "at the gym")',
          'What priority level should this task have? (Low, Medium, High, or Urgent)',
          'How much energy will this task require? (Low energy = easy, High energy = challenging)',
          'Are there any specific labels or categories for this task? (e.g., "work", "personal", "health", "finance")'
        ]).slice(0, 2) // Ask 2 questions at a time to avoid overwhelming
        
        const aiMessages = followUpQuestions.map((question: string, index: number) => ({
          id: `ai-followup-${Date.now()}-${index}`,
          type: 'ai' as const,
          content: question,
          timestamp: new Date(),
          isQuestion: true
        }))

        setMessages(prev => [...prev, ...aiMessages])
        toast('🤔 Thanks! Let me ask a few more questions to get this perfect. Feel free to elaborate on any of these!')
      }
    } catch (error) {
      console.error('Chat processing failed:', error)
      
      const errorMessage: ChatMessage = {
        id: `ai-error-${Date.now()}`,
        type: 'ai',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or rephrase your response.`,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
      toast.error('Failed to process response')
    } finally {
      setIsProcessing(false)
    }
  }

  // Function to build a partial task from conversation context
  const buildPartialTaskFromConversation = (originalTranscript: string, messages: ChatMessage[], latestResponse: string): any => {
    const partialTask: any = {
      id: `partial-${Date.now()}`,
      title: originalTranscript.trim(),
      summary: `Task being built from voice input: "${originalTranscript.trim()}"`,
      priority: 'MEDIUM' as const,
      energy: 'MEDIUM' as const,
      dueAt: undefined as any,
      isRepeatable: false,
      labels: [],
      subtasks: [],
      confidence: 0.7
    }
    
    // Extract day information from conversation if available
    const dayMatch = extractDayFromConversation(originalTranscript, messages, latestResponse)
    if (dayMatch) {
      partialTask.dueAt = dayMatch
    }
    
    // Extract time information if available
    const timeMatch = extractTimeFromConversation(originalTranscript, messages, latestResponse)
    if (timeMatch && partialTask.dueAt) {
      const currentDate = partialTask.dueAt instanceof Date ? partialTask.dueAt : new Date(partialTask.dueAt)
      const [hours, minutes] = timeMatch.split(':').map(Number)
      currentDate.setHours(hours, minutes, 0, 0)
      partialTask.dueAt = currentDate.toISOString()
    }
    
    return partialTask
  }

  // Function to enhance task with conversation context and fill missing details
  // This function can be called multiple times as the AI refines the task
  const enhanceTaskWithConversation = (task: any, originalTranscript: string, messages: ChatMessage[], latestResponse: string): any => {
    const enhancedTask = { ...task }
    
    // Robust combined parse from full conversation (handles "next monday 5pm", etc.)
    const fullText = `${originalTranscript} ${messages.map(m => m.content).join(' ')} ${latestResponse}`
    try {
      const parsedIso = parseUserTimeInput(fullText)
      if (parsedIso) {
        enhancedTask.dueAt = parsedIso
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse user time input:', e)
    }
    
    // If still no ISO dueAt, try simple day/time extraction as fallback
    if (!enhancedTask.dueAt) {
      const dayMatch = extractDayFromConversation(originalTranscript, messages, latestResponse)
      if (dayMatch) {
        enhancedTask.dueAt = dayMatch
      }
    }
    if (!enhancedTask.dueAt) {
      // Default fallback: tomorrow at 9am
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      enhancedTask.dueAt = d.toISOString()
    } else if (!String(enhancedTask.dueAt).includes('T')) {
      const timeMatch = extractTimeFromConversation(originalTranscript, messages, latestResponse)
      if (timeMatch) {
        const [hours, minutes] = timeMatch.split(':').map(Number)
        const base = new Date(String(enhancedTask.dueAt))
        if (!isNaN(base.getTime())) {
          base.setHours(hours, minutes, 0, 0)
          enhancedTask.dueAt = base.toISOString()
        }
      }
    }
    
    // Ensure all required fields are present
    if (!enhancedTask.id) enhancedTask.id = `enhanced-${Date.now()}`
    if (!enhancedTask.title) enhancedTask.title = originalTranscript.trim()
    if (!enhancedTask.summary) enhancedTask.summary = `Task created from voice input: "${originalTranscript.trim()}"`
    if (!enhancedTask.priority) enhancedTask.priority = 'MEDIUM'
    if (!enhancedTask.confidence) enhancedTask.confidence = 0.9
    if (!enhancedTask.isRepeatable) enhancedTask.isRepeatable = false
    if (!enhancedTask.labels) enhancedTask.labels = []
    if (!enhancedTask.subtasks) enhancedTask.subtasks = []
    
    return enhancedTask
  }

  // Parse natural phrases like "next monday 5pm", "tomorrow at 8", "friday evening"
  const parseUserTimeInput = (text: string): string | null => {
    const lower = text.toLowerCase()
    const now = new Date()

    // Day keywords
    const dayMap: Record<string, number> = {
      sunday: 0, sun: 0,
      monday: 1, mon: 1,
      tuesday: 2, tue: 2, tues: 2,
      wednesday: 3, wed: 3,
      thursday: 4, thu: 4, thurs: 4,
      friday: 5, fri: 5,
      saturday: 6, sat: 6
    }

    // Time phrases
    const timeRegex = /(\b\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(morning|afternoon|evening|night|noon|midday)\b/

    const pickNext = (weekday: number): Date => {
      const d = new Date(now)
      const diff = (weekday - d.getDay() + 7) % 7
      d.setDate(d.getDate() + (diff === 0 ? 7 : diff)) // always next occurrence
      d.setHours(9, 0, 0, 0)
      return d
    }

    const setTime = (d: Date, match: RegExpMatchArray): Date => {
      let hh = 9
      let mm = 0
      if (match[1]) {
        hh = parseInt(match[1])
        mm = match[2] ? parseInt(match[2]) : 0
        const ap = match[3]?.toLowerCase()
        if (ap === 'pm' && hh !== 12) hh += 12
        if (ap === 'am' && hh === 12) hh = 0
      } else if (match[4]) {
        const named = match[4]
        if (named === 'morning') { hh = 9; mm = 0 }
        else if (named === 'afternoon') { hh = 14; mm = 0 }
        else if (named === 'evening') { hh = 18; mm = 0 }
        else if (named === 'night') { hh = 20; mm = 0 }
        else if (named === 'noon' || named === 'midday') { hh = 12; mm = 0 }
      }
      d.setHours(hh, mm, 0, 0)
      return d
    }

    // Handle today/tomorrow
    if (/(\btoday\b)/.test(lower)) {
      const d = new Date(now)
      const m = lower.match(timeRegex)
      setTime(d, m as any || [])
      return isNaN(d.getTime()) ? null : d.toISOString()
    }
    if (/(\btomorrow\b)/.test(lower)) {
      const d = new Date(now)
      d.setDate(d.getDate() + 1)
      const m = lower.match(timeRegex)
      setTime(d, m as any || [])
      return isNaN(d.getTime()) ? null : d.toISOString()
    }

    // Handle "next <weekday>" or just weekday
    const nextMatch = lower.match(/next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/)
    if (nextMatch) {
      const weekday = dayMap[nextMatch[1]]
      const d = pickNext(weekday)
      const m = lower.match(timeRegex)
      if (m) setTime(d, m)
      return d.toISOString()
    }
    const dayOnly = lower.match(/\b(sun|sunday|mon|monday|tue|tues|tuesday|wed|wednesday|thu|thurs|thursday|fri|friday|sat|saturday)\b/)
    if (dayOnly) {
      const weekday = dayMap[dayOnly[1]]
      // If same day mentioned, choose next occurrence to avoid past times
      const d = pickNext(weekday)
      const m = lower.match(timeRegex)
      if (m) setTime(d, m)
      return d.toISOString()
    }

    // Direct time today/tomorrow default
    const directTime = lower.match(timeRegex)
    if (directTime) {
      const d = new Date(now)
      setTime(d, directTime)
      // If time already passed today, move to tomorrow
      if (d.getTime() <= now.getTime()) {
        d.setDate(d.getDate() + 1)
      }
      return d.toISOString()
    }

    return null
  }

  // Helper function to extract day information from conversation
  const extractDayFromConversation = (originalTranscript: string, messages: ChatMessage[], latestResponse: string): string | null => {
    const allText = `${originalTranscript} ${messages.map(m => m.content).join(' ')} ${latestResponse}`.toLowerCase()
    
    // Look for specific days
    const dayPatterns = [
      { pattern: /(monday|mon)/i, day: 1 },
      { pattern: /(tuesday|tues)/i, day: 2 },
      { pattern: /(wednesday|wed)/i, day: 3 },
      { pattern: /(thursday|thurs)/i, day: 4 },
      { pattern: /(friday|fri)/i, day: 5 },
      { pattern: /(saturday|sat)/i, day: 6 },
      { pattern: /(sunday|sun)/i, day: 0 },
      { pattern: /(today)/i, day: new Date().getDay() },
      { pattern: /(tomorrow)/i, day: (new Date().getDay() + 1) % 7 }
    ]
    
    for (const { pattern, day } of dayPatterns) {
      if (pattern.test(allText)) {
        const targetDate = new Date()
        const currentDay = targetDate.getDay()
        const daysToAdd = (day - currentDay + 7) % 7
        targetDate.setDate(targetDate.getDate() + daysToAdd)
        return targetDate.toISOString()
      }
    }
    
    return null
  }

  // Helper function to extract time information from conversation
  const extractTimeFromConversation = (originalTranscript: string, messages: ChatMessage[], latestResponse: string): string | null => {
    const allText = `${originalTranscript} ${messages.map(m => m.content).join(' ')} ${latestResponse}`.toLowerCase()
    
    // Look for time patterns
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,  // 2:30 PM
      /(\d{1,2})\s*(am|pm)/i,          // 2 PM
      /(\d{1,2}):(\d{2})/i,            // 14:30
      /(\d{1,2})\s*o'clock/i,          // 2 o'clock
    ]
    
    for (const pattern of timePatterns) {
      const match = allText.match(pattern)
      if (match) {
        let hours = parseInt(match[1])
        let minutes = match[2] ? parseInt(match[2]) : 0
        
        // Handle AM/PM
        if (match[3]) {
          const ampm = match[3].toLowerCase()
          if (ampm === 'pm' && hours !== 12) hours += 12
          if (ampm === 'am' && hours === 12) hours = 0
        }
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      }
    }
    
    return null
  }

  const handleCreateTask = () => {
    if (currentTask) {
      onTaskCreated(currentTask)
      onClose()
      toast.success('🎯 Perfect task created successfully!')
    }
  }

  // Function to allow AI to edit the task during conversation
  const handleAIEditTask = (updatedTask: any) => {
    setCurrentTask(updatedTask)
    toast.success('✅ Task updated based on our conversation!')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              💬 Task Clarification Chat
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Let's get the details right for your perfectly formatted task
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-2"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.isQuestion && (
                  <div className="mt-2 text-xs opacity-75">
                    💭 Please provide details for this question
                  </div>
                )}
                <div className="text-xs opacity-60 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div className="spinner w-4 h-4"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    AI is analyzing your input to create a perfect task...
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {currentTask ? (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
                <p className="text-sm text-green-800 dark:text-green-200">
                  ✅ Ready to create perfectly formatted task: <strong>{currentTask.title}</strong>
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateTask}
                  className="btn-primary flex-1"
                >
                  🎯 Create Perfect Task
                </button>
                <button
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Tell me more details or ask me to modify the task..."
                className="input flex-1"
                disabled={isProcessing}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isProcessing}
                className="btn-primary"
              >
                {isProcessing ? (
                  <div className="spinner w-4 h-4"></div>
                ) : (
                  'Send'
                )}
              </button>
              {currentTask && (
                <button
                  onClick={() => {
                    const aiMessage: ChatMessage = {
                      id: `ai-task-preview-${Date.now()}`,
                      type: 'ai',
                      content: `Here's the current task state:\n\n**${currentTask.title}**\n${currentTask.summary || ''}\n\nDue: ${currentTask.dueAt ? new Date(currentTask.dueAt).toLocaleDateString() : 'No due date'}\nPriority: ${currentTask.priority || 'Medium'}\n${currentTask.isRepeatable ? '🔄 This will be a repeatable task' : ''}\n\nWhat would you like me to change or add?`,
                      timestamp: new Date()
                    }
                    setMessages(prev => [...prev, aiMessage])
                  }}
                  className="btn-ghost text-xs"
                  title="Show current task state"
                >
                  📋 Show Task
                </button>
              )}
              <button
                onClick={() => {
                  // Show what the AI has gathered so far
                  const currentUserResponses = messages
                    .filter(m => m.type === 'user')
                    .map(m => m.content)
                    .join('\n')
                  const aiMessage: ChatMessage = {
                    id: `ai-progress-${Date.now()}`,
                    type: 'ai',
                    content: `Let me show you what I've gathered so far:\n\n**Original:** "${originalTranscript}"\n**Your responses:** ${currentUserResponses || 'None yet'}\n\nI'm working on building a complete task with all the details. Keep chatting with me to add more information!`,
                    timestamp: new Date()
                  }
                  setMessages(prev => [...prev, aiMessage])
                }}
                className="btn-ghost text-xs"
                title="Show AI progress"
              >
                🔍 Show Progress
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
