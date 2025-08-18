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
          content: `I need more details about: "${originalTranscript}". Please answer these questions:`,
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
      const fullConversation = `${originalTranscript}\n\nUser responses:\n${messages
        .filter(m => m.type === 'user')
        .map(m => m.content)
        .join('\n')}\n\nLatest response: ${userMessage.content}`

      const result = await cal.processVoiceInput(fullConversation, 0.3)

      if (result.intent === 'needs_clarification') {
        // Still needs more clarification
        const followUpQuestions = result.clarifyingQuestions || [
          'Can you provide more specific details?',
          'What else should I know about this?'
        ]

        const aiMessages = followUpQuestions.map((question, index) => ({
          id: `ai-followup-${Date.now()}-${index}`,
          type: 'ai' as const,
          content: question,
          timestamp: new Date(),
          isQuestion: true
        }))

        setMessages(prev => [...prev, ...aiMessages])
        toast('🤔 Need a bit more information...')
      } else {
        // We have enough information to create the task
        if (result.tasks && result.tasks.length > 0) {
          const task = result.tasks[0]
          setCurrentTask(task)
          
          const aiMessage: ChatMessage = {
            id: `ai-success-${Date.now()}`,
            type: 'ai',
            content: `Perfect! I have enough information now. Here's what I'm going to create:\n\n**${task.title}**\n${task.summary || ''}\n\nDue: ${task.dueAt ? new Date(task.dueAt).toLocaleDateString() : 'No due date'}\nPriority: ${task.priority || 'Medium'}\n${task.isRepeatable ? '🔄 This will be a repeatable task' : ''}`,
            timestamp: new Date()
          }

          setMessages(prev => [...prev, aiMessage])
          toast.success('✅ Ready to create task!')
        } else {
          throw new Error('No task generated from conversation')
        }
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

  const handleCreateTask = () => {
    if (currentTask) {
      onTaskCreated(currentTask)
      onClose()
      toast.success('Task created successfully!')
    }
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
              Let's get the details right for your task
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
                    💭 Please answer this question
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
                    AI is thinking...
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
                  ✅ Ready to create task: <strong>{currentTask.title}</strong>
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateTask}
                  className="btn-primary flex-1"
                >
                  🎯 Create Task
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
                placeholder="Type your answer here..."
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
