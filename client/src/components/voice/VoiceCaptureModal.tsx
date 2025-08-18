'use client'

import { useState, useCallback, useEffect } from 'react'
import { TaskAIService } from '@/services/ai/TaskAIService'
import { DeepgramAdapter } from '@/services/stt/DeepgramAdapter'
import { TaskClarificationChat } from './TaskClarificationChat'
import { TaskProposalCard } from './TaskProposalCard'
import { TaskProposal, Task } from '@/types/task.types'
import { toast } from 'react-hot-toast'

interface VoiceCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  onTasksCreated: (tasks: Task[]) => void
}

export function VoiceCaptureModal({ isOpen, onClose, onTasksCreated }: VoiceCaptureModalProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [proposals, setProposals] = useState<TaskProposal[]>([])
  const [showChat, setShowChat] = useState(false)
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [deepgramAdapter, setDeepgramAdapter] = useState<DeepgramAdapter | null>(null)
  const [aiService, setAiService] = useState<TaskAIService | null>(null)

  // Initialize services
  useEffect(() => {
    const deepgramKey = localStorage.getItem('deepgram_api_key') || process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY
    const openaiKey = localStorage.getItem('openai_api_key') || process.env.NEXT_PUBLIC_OPENAI_API_KEY

    if (deepgramKey && openaiKey) {
      setDeepgramAdapter(new DeepgramAdapter({ apiKey: deepgramKey }))
      setAiService(new TaskAIService(openaiKey, deepgramKey))
    } else {
      toast.error('Please configure your API keys in settings first')
    }
  }, [])

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  const startRecording = useCallback(async () => {
    if (!deepgramAdapter) {
      toast.error('Deepgram service not initialized')
      return
    }

    try {
      await deepgramAdapter.startRecording()
      setIsRecording(true)
      setRecordingTime(0)
      setTranscript('')
      toast.success('Recording started')
    } catch (error) {
      console.error('Failed to start recording:', error)
      toast.error('Failed to start recording. Please check microphone permissions.')
    }
  }, [deepgramAdapter])

  const stopRecording = useCallback(async () => {
    if (!deepgramAdapter) return

    try {
      const audioBlob = deepgramAdapter.stopRecording()
      setIsRecording(false)
      
      // Process the audio
      await processAudio(audioBlob)
    } catch (error) {
      console.error('Failed to stop recording:', error)
      toast.error('Failed to process recording')
    }
  }, [deepgramAdapter])

  const processAudio = async (audioBlob: Blob) => {
    if (!aiService) {
      toast.error('AI service not initialized')
      return
    }

    setIsProcessing(true)
    try {
      const result = await aiService.processVoiceInput(audioBlob)
      
      if (result.status === 'ERROR') {
        toast.error(result.error || 'Failed to process audio')
        return
      }

      if (result.status === 'NEEDS_CLARIFICATION') {
        setClarificationQuestions(result.clarificationQuestions || [])
        setProposals(result.proposals)
        setShowChat(true)
        toast.success('Clarification needed for your tasks')
      } else {
        setProposals(result.proposals)
        toast.success(`Generated ${result.proposals.length} task(s)`)
      }
    } catch (error) {
      console.error('Audio processing failed:', error)
      toast.error('Failed to process audio. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAnalyzeTask = async () => {
    if (!transcript.trim()) {
      toast.error('Please provide some text to analyze')
      return
    }

    if (!aiService) {
      toast.error('AI service not initialized')
      return
    }

    setIsProcessing(true)
    try {
      // Create a dummy audio blob from text input
      const dummyBlob = new Blob([transcript], { type: 'text/plain' })
      const result = await aiService.processVoiceInput(dummyBlob)
      
      if (result.status === 'ERROR') {
        toast.error(result.error || 'Failed to analyze text')
        return
      }

      if (result.status === 'NEEDS_CLARIFICATION') {
        setClarificationQuestions(result.clarificationQuestions || [])
        setProposals(result.proposals)
        setShowChat(true)
        toast.success('Clarification needed for your tasks')
      } else {
        setProposals(result.proposals)
        toast.success(`Generated ${result.proposals.length} task(s)`)
      }
    } catch (error) {
      console.error('Text analysis failed:', error)
      toast.error('Failed to analyze text. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleChatResponse = async (response: string, proposalId: string) => {
    if (!aiService) return

    try {
      const proposal = proposals.find(p => p.proposalId === proposalId)
      if (!proposal) return

      const updatedProposal = await aiService.clarifyTask(proposal, response)
      setProposals(prev => prev.map(p => 
        p.proposalId === proposalId ? updatedProposal : p
      ))

      // Check if more clarification needed
      if (!updatedProposal.needsClarification) {
        setShowChat(false)
      }
    } catch (error) {
      console.error('Failed to process clarification:', error)
      toast.error('Failed to process your response')
    }
  }

  const handleProposalEdit = (updated: TaskProposal) => {
    setProposals(prev => prev.map(p => 
      p.id === updated.id ? updated : p
    ))
  }

  const handleProposalDelete = (id: string) => {
    setProposals(prev => prev.filter(p => p.id !== id))
  }

  const handleApproveProposals = async () => {
    // Filter out proposals that still need clarification
    const readyProposals = proposals.filter(p => !p.needsClarification)
    
    if (readyProposals.length === 0) {
      toast.error('No tasks ready to create. Please complete clarification first.')
      return
    }

    try {
      // Convert proposals to tasks
      const tasks: Task[] = readyProposals.map(proposal => ({
        ...proposal,
        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date()
      }))

      await onTasksCreated(tasks)
      toast.success(`Successfully created ${tasks.length} task(s)`)
      onClose()
    } catch (error) {
      console.error('Failed to create tasks:', error)
      toast.error('Failed to create tasks')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            🎤 Voice Task Capture
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Recording Interface */}
        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="mb-4">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl transition-all ${
                  isRecording 
                    ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRecording ? '⏹️' : '🎤'}
              </button>
            </div>
            
            {isRecording && (
              <div className="text-lg font-medium text-red-600 dark:text-red-400">
                Recording: {formatTime(recordingTime)}
              </div>
            )}
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {isRecording ? 'Click to stop recording' : 'Click to start recording'}
            </p>
          </div>

          {/* Transcript Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What would you like to do?
            </label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Speak or type your tasks here... (e.g., 'I need to buy groceries every week' or 'Review project proposal by Friday')"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              disabled={isRecording || isProcessing}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4">
            <button
              onClick={handleAnalyzeTask}
              disabled={!transcript.trim() || isProcessing || isRecording}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>🤖</span>
                  <span>Analyze Tasks</span>
                </>
              )}
            </button>
          </div>

          {/* Task Proposals */}
          {proposals.length > 0 && !showChat && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Generated Tasks ({proposals.length})
                </h4>
                <button
                  onClick={handleApproveProposals}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  ✅ Create All Tasks
                </button>
              </div>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {proposals.map(proposal => (
                  <TaskProposalCard
                    key={proposal.proposalId}
                    proposal={proposal}
                    onEdit={handleProposalEdit}
                    onDelete={handleProposalDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clarification Chat */}
        {showChat && (
          <TaskClarificationChat
            questions={clarificationQuestions}
            proposals={proposals}
            onResponse={handleChatResponse}
            onComplete={() => {
              setShowChat(false)
              toast.success('Clarification complete! Review your tasks below.')
            }}
          />
        )}
      </div>
    </div>
  )
}
