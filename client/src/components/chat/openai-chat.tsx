'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { useBoardStore } from '@/stores/board'
import { useStagingStore } from '@/stores/staging'
import type { TaskPriority, EnergyLevel } from '@/types'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  functionCall?: {
    name: string
    arguments: any
    result?: any
  }
}

interface OpenAIChatProps {
  isOpen: boolean
  onClose: () => void
}

export function OpenAIChat({ isOpen, onClose }: OpenAIChatProps) {
  const { currentBoard } = useBoardStore()
  const { addToStaging } = useStagingStore()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'I am your TaskerADHD assistant. I can help you with the application, debug issues, create tasks, and answer questions about your code environment. I can actually create tasks in your board when you ask me to! How can I help you today?',
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load API key from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key')
    if (savedApiKey) {
      setApiKey(savedApiKey)
    }
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const saveApiKey = (key: string) => {
    localStorage.setItem('openai_api_key', key)
    setApiKey(key)
    toast.success('OpenAI API key saved!')
  }

  // Function definitions for AI to call
  const availableFunctions = {
    createTask: async (args: {
      title: string
      summary?: string
      priority?: TaskPriority
      energy?: EnergyLevel
      estimateMin?: number
      dueAt?: string
      labels?: string[]
    }) => {
      try {
        if (!currentBoard) {
          return { success: false, message: 'No board selected' }
        }

        // Send task to staging for intelligent processing
        addToStaging({
          title: args.title,
          summary: args.summary || '',
          priority: args.priority,
          energy: args.energy,
          estimateMin: args.estimateMin,
          dueAt: args.dueAt,
          labels: args.labels || [],
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          position: 0,
          
          // Staging-specific metadata
          source: 'ai_chat',
          confidence: 0.85, // AI-generated tasks have high confidence
          suggestedImprovements: [],
          relatedTasks: [],
          suggestedLabels: args.labels || [],
          detectedCategory: 'work' // Default category
        })

        toast.success(`📥 Task "${args.title}" sent to staging for review!`)
        return { success: true, message: `Successfully staged task "${args.title}" - check Staging area to approve` }
      } catch (error) {
        console.error('Task staging error:', error)
        return { success: false, message: `Error staging task: ${error}` }
      }
    },

    createMultipleTasks: async (args: { tasks: Array<{
      title: string
      summary?: string
      priority?: TaskPriority
      energy?: EnergyLevel
      estimateMin?: number
      dueAt?: string
      labels?: string[]
    }> }) => {
      try {
        console.log(`🔧 Staging ${args.tasks.length} tasks via AI...`)
        
        if (!currentBoard) {
          console.error('🚨 No current board for multiple task creation')
          return { success: false, message: 'No board selected' }
        }

        const results = []
        
        // Send all tasks to staging for intelligent processing
        for (let index = 0; index < args.tasks.length; index++) {
          const taskData = args.tasks[index]
          console.log(`🔧 Staging task ${index + 1}/${args.tasks.length}: ${taskData.title}`)
          
          try {
            addToStaging({
              title: taskData.title,
              summary: taskData.summary || '',
              priority: taskData.priority,
              energy: taskData.energy,
              estimateMin: taskData.estimateMin,
              dueAt: taskData.dueAt,
              labels: taskData.labels || [],
              subtasks: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              position: 0,
              
              // Staging-specific metadata
              source: 'ai_chat',
              confidence: 0.85, // AI-generated tasks have high confidence
              suggestedImprovements: [],
              relatedTasks: [],
              suggestedLabels: taskData.labels || [],
              detectedCategory: 'work' // Default category
            })
            
            console.log(`✅ Task staged: ${taskData.title}`)
            results.push({ success: true, title: taskData.title })
          } catch (error) {
            console.error(`🚨 Failed to stage task: ${taskData.title}`, error)
            results.push({ success: false, title: taskData.title, error: 'Staging failed' })
          }
        }
        
        const successCount = results.filter(r => r.success).length
        console.log(`🔧 Staged ${successCount}/${args.tasks.length} tasks successfully`)
        
        if (successCount > 0) {
          toast.success(`📥 Sent ${successCount} of ${args.tasks.length} tasks to staging!`)
          toast('💡 Check the Staging area to review and approve your tasks', { duration: 4000 })
        } else {
          toast.error('❌ Failed to stage any tasks')
        }
        
        return { 
          success: successCount > 0, 
          results,
          message: `Successfully staged ${successCount} of ${args.tasks.length} tasks - check Staging area to approve`
        }
      } catch (error) {
        console.error('🚨 Multiple task staging error:', error)
        toast.error('❌ Error staging multiple tasks')
        return { success: false, message: `Error staging tasks: ${error}` }
      }
    }
  }

  const getSystemContext = () => {
    return `You are TaskerADHD Assistant, helping with an ADHD-friendly task management application.

Current Application Context:
- Application: TaskerADHD - ADHD-first Jira-like task management system
- Frontend: Next.js 14 with TypeScript, Tailwind CSS, Zustand for state management
- Backend: Node.js Express server with Socket.IO for real-time features
- Database: PostgreSQL with Prisma ORM
- Features: Voice-to-task conversion, Kanban boards, drag-and-drop, themes
- Current page: Dashboard with task management
- User: Development user with bypass authentication
- Current board: ${currentBoard?.name || 'Default Board'}
- Available columns: ${currentBoard?.columns?.map(c => c.name).join(', ') || 'Inbox, To Do, Doing, Done'}

IMPORTANT: You can actually create tasks using the provided functions. When users ask you to create tasks, use the createTask or createMultipleTasks functions.

Task Creation Guidelines:
- Use priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
- Use energy: 'LOW' | 'MEDIUM' | 'HIGH' 
- estimateMin should be realistic (5-120 minutes)
- Break large tasks into smaller subtasks when possible
- Use ADHD-friendly task names (clear, action-oriented)

You can help with:
1. Creating actual tasks in the user's board
2. Debugging application issues
3. Explaining how features work
4. Suggesting improvements
5. Code analysis and recommendations
6. ADHD-friendly UX suggestions

Be concise, practical, and focus on ADHD-friendly solutions. When creating tasks, always confirm what you've created.`
  }

  const sendMessage = async () => {
    if (!input.trim() || !apiKey) {
      if (!apiKey) {
        toast.error('Please enter your OpenAI API key first')
      }
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: getSystemContext()
            },
            ...messages.filter(m => m.role !== 'system').slice(-10).map(m => ({
              role: m.role,
              content: m.content
            })),
            {
              role: 'user',
              content: userMessage.content
            }
          ],
          functions: [
            {
              name: 'createTask',
              description: 'Create a single task in the TaskerADHD board',
              parameters: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Clear, action-oriented task title'
                  },
                  summary: {
                    type: 'string',
                    description: 'Optional brief description of the task'
                  },
                  priority: {
                    type: 'string',
                    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
                    description: 'Task priority level'
                  },
                  energy: {
                    type: 'string',
                    enum: ['LOW', 'MEDIUM', 'HIGH'],
                    description: 'Energy level required for this task'
                  },
                  estimateMin: {
                    type: 'number',
                    description: 'Estimated time in minutes (5-120)'
                  },
                  dueAt: {
                    type: 'string',
                    description: 'Due date in ISO format (optional)'
                  },
                  labels: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional labels/tags for the task'
                  }
                },
                required: ['title']
              }
            },
            {
              name: 'createMultipleTasks',
              description: 'Create multiple tasks at once in the TaskerADHD board',
              parameters: {
                type: 'object',
                properties: {
                  tasks: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Clear, action-oriented task title' },
                        summary: { type: 'string', description: 'Optional brief description' },
                        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
                        energy: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
                        estimateMin: { type: 'number', description: 'Estimated time in minutes' },
                        dueAt: { type: 'string', description: 'Due date in ISO format' },
                        labels: { type: 'array', items: { type: 'string' } }
                      },
                      required: ['title']
                    }
                  }
                },
                required: ['tasks']
              }
            }
          ],
          function_call: 'auto',
          max_tokens: 1000,
          temperature: 0.7
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const choice = data.choices[0]
      
      // Handle function call
      if (choice.message.function_call) {
        const functionName = choice.message.function_call.name
        const functionArgs = JSON.parse(choice.message.function_call.arguments)
        
        // Execute the function
        const functionResult = await availableFunctions[functionName as keyof typeof availableFunctions](functionArgs)
        
        // Create function call message
        const functionMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `🤖 Executing: ${functionName}`,
          timestamp: new Date(),
          functionCall: {
            name: functionName,
            arguments: functionArgs,
            result: functionResult
          }
        }
        
        setMessages(prev => [...prev, functionMessage])
        
        // Send function result back to get final response
        const followUpResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: getSystemContext()
              },
              ...messages.filter(m => m.role !== 'system').slice(-8).map(m => ({
                role: m.role,
                content: m.content
              })),
              {
                role: 'user',
                content: userMessage.content
              },
              {
                role: 'assistant',
                content: null,
                function_call: choice.message.function_call
              },
              {
                role: 'function',
                name: functionName,
                content: JSON.stringify(functionResult)
              }
            ],
            max_tokens: 500,
            temperature: 0.7
          })
        })
        
        const followUpData = await followUpResponse.json()
        
        const finalMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: followUpData.choices[0].message.content,
          timestamp: new Date()
        }
        
        setMessages(prev => [...prev, finalMessage])
      } else {
        // Regular text response
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: choice.message.content,
          timestamp: new Date()
        }

        setMessages(prev => [...prev, assistantMessage])
      }
      
    } catch (error) {
      console.error('Chat error:', error)
      toast.error('Failed to send message. Check your API key and connection.')
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your OpenAI API key and try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'system',
        content: 'Chat cleared. I am your TaskerADHD assistant. How can I help you?',
        timestamp: new Date()
      }
    ])
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            🤖 TaskerADHD Assistant
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={clearChat}
              className="btn-ghost p-2"
              title="Clear chat"
            >
              🗑️
            </button>
            <button
              onClick={onClose}
              className="btn-ghost p-2"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
        </div>

        {/* API Key Setup */}
        {!apiKey && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700">
            <p className="text-amber-800 dark:text-amber-200 text-sm mb-2">
              🔑 Enter your OpenAI API key to start chatting:
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="sk-..."
                className="input flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    saveApiKey((e.target as HTMLInputElement).value)
                  }
                }}
              />
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="password"]') as HTMLInputElement
                  if (input?.value) {
                    saveApiKey(input.value)
                  }
                }}
                className="btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : message.role === 'system'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    : message.functionCall
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-gray-900 dark:text-gray-100'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm">
                  {message.content}
                </div>
                
                {/* Function Call Display */}
                {message.functionCall && (
                  <div className="mt-3 pt-2 border-t border-green-200 dark:border-green-700">
                    <div className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">
                      🔧 Function: {message.functionCall.name}
                    </div>
                    
                    {/* Function Arguments */}
                    <div className="text-xs text-green-700 dark:text-green-300 mb-2">
                      <strong>Parameters:</strong>
                      <pre className="mt-1 bg-green-100 dark:bg-green-800/20 p-2 rounded text-xs overflow-x-auto">
                        {JSON.stringify(message.functionCall.arguments, null, 2)}
                      </pre>
                    </div>
                    
                    {/* Function Result */}
                    <div className="text-xs">
                      <strong className="text-green-800 dark:text-green-200">Result:</strong>
                      <div className={`mt-1 p-2 rounded text-xs ${
                        message.functionCall.result?.success
                          ? 'bg-green-100 dark:bg-green-800/20 text-green-800 dark:text-green-200'
                          : 'bg-red-100 dark:bg-red-800/20 text-red-800 dark:text-red-200'
                      }`}>
                        {message.functionCall.result?.success ? '✅' : '❌'} {message.functionCall.result?.message}
                        
                        {/* Show created tasks if multiple */}
                        {message.functionCall.result?.results && (
                          <div className="mt-2">
                            {message.functionCall.result.results.map((result: any, idx: number) => (
                              <div key={idx} className="text-xs">
                                {result.success ? '✅' : '❌'} {result.title}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div
                  className={`text-xs mt-1 opacity-70 ${
                    message.role === 'user' ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="spinner w-4 h-4"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Assistant is thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me to create tasks, debug issues, or get help with TaskerADHD..."
              className="input flex-1 min-h-[40px] max-h-32 resize-none"
              disabled={!apiKey || isLoading}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !apiKey || isLoading}
              className="btn-primary px-6"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
