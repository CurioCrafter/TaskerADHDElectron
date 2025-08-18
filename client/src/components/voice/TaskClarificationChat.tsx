'use client'

import { useState, useEffect } from 'react'
import { TaskProposal, ChatMessage } from '@/types/task.types'

interface TaskClarificationChatProps {
  questions: string[]
  proposals: TaskProposal[]
  onResponse: (response: string, proposalId: string) => Promise<void>
  onComplete: () => void
}

export function TaskClarificationChat({ 
  questions, 
  proposals, 
  onResponse, 
  onComplete 
}: TaskClarificationChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    // Initialize with first question
    if (questions.length > 0) {
      setMessages([{
        type: 'ai',
        content: questions[0],
        timestamp: new Date()
      }])
    }
  }, [questions])

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return
    
    const userInput = input.trim()
    setInput('')
    setIsProcessing(true)
    
    try {
      // Add user message
      const userMessage: ChatMessage = {
        type: 'user',
        content: userInput,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, userMessage])
      
      // Process response
      const currentProposal = proposals[currentQuestionIndex]
      if (currentProposal) {
        await onResponse(userInput, currentProposal.proposalId)
      }
      
      // Move to next question or complete
      if (currentQuestionIndex < questions.length - 1) {
        const nextQuestionIndex = currentQuestionIndex + 1
        setCurrentQuestionIndex(nextQuestionIndex)
        
        // Add next AI question
        const nextQuestionMessage: ChatMessage = {
          type: 'ai',
          content: questions[nextQuestionIndex],
          timestamp: new Date()
        }
        setMessages(prev => [...prev, nextQuestionMessage])
      } else {
        // All questions answered
        const completionMessage: ChatMessage = {
          type: 'ai',
          content: 'Perfect! I have enough information now. Here\'s the perfectly formatted task I\'m going to create:',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, completionMessage])
        
        // Wait a moment then complete
        setTimeout(() => {
          onComplete()
        }, 1500)
      }
    } catch (error) {
      console.error('Failed to process response:', error)
      
      // Add error message
      const errorMessage: ChatMessage = {
        type: 'ai',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const skipQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      const nextQuestionIndex = currentQuestionIndex + 1
      setCurrentQuestionIndex(nextQuestionIndex)
      
      const skipMessage: ChatMessage = {
        type: 'ai',
        content: `Skipped. Next question: ${questions[nextQuestionIndex]}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, skipMessage])
    } else {
      onComplete()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            💬 Task Clarification Chat
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Question {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  msg.type === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
                <p className={`text-xs mt-1 ${
                  msg.type === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Processing...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your answer..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isProcessing}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
            <button
              onClick={skipQuestion}
              disabled={isProcessing}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Skip
            </button>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
