'use client'

import { useState, useEffect, useRef } from 'react'
import { useVoiceStore } from '@/stores/voice'
import { useSettingsStore } from '@/stores/settings'
import { VoiceCaptureService } from '@/services/voice-capture'
import { TaskShaper } from '@/services/llm/task-shaper'
import { VoiceCalendarIntegration, VoiceCalendarResult } from '@/services/llm/voice-calendar-integration'
import { VoiceCalendarModal } from './voice-calendar-modal'
import { TaskProposalModal } from './task-proposal-modal'
import { TaskClarificationChat } from './task-clarification-chat'
import { toast } from 'react-hot-toast'
import type { TaskShapingResult } from '@/services/llm/task-shaper'

interface VoiceCaptureModalProps {
  isOpen: boolean
  onClose: () => void
  boardId?: string
  useStaging?: boolean
}

interface WordWithConfidence {
  text: string
  confidence?: number
  start?: number
  end?: number
}

export function VoiceCaptureModal({ isOpen, onClose, boardId, useStaging = false }: VoiceCaptureModalProps) {
  const {
    isInitialized,
    isConnected,
    isRecording,
    audioLevel,
    transcript,
    interimTranscript,
    confidence,
    words,
    config,
    currentSession,
    initialize,
    start,
    stop
  } = useVoiceStore()
  
  const [initError, setInitError] = useState<string | null>(null)
  const [showMetrics, setShowMetrics] = useState(false)
  const [taskProposals, setTaskProposals] = useState<TaskShapingResult | null>(null)
  const [showProposals, setShowProposals] = useState(false)
  const [calendarProposals, setCalendarProposals] = useState<VoiceCalendarResult | null>(null)
  const [showCalendarProposals, setShowCalendarProposals] = useState(false)
  const [isShaping, setIsShaping] = useState(false)
  const [localInitialized, setLocalInitialized] = useState(false)
  
  // Clarification chat state
  const [showClarificationChat, setShowClarificationChat] = useState(false)
  const [clarificationQuestions, setClarificationQuestions] = useState<string[]>([])

  // Combined initialization state - define early to avoid circular dependency
  const isActuallyInitialized = isInitialized || localInitialized

  // Initialize when modal opens
  useEffect(() => {
    if (isOpen && !isActuallyInitialized) {
      initializeServices()
    }
  }, [isOpen, isActuallyInitialized])

  // Reset local state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLocalInitialized(false)
      setInitError(null)
    }
  }, [isOpen])

  // Debug: Monitor isInitialized state changes
  useEffect(() => {
    console.log('🔍 Voice modal - isInitialized changed to:', isInitialized, 'localInitialized:', localInitialized, 'combined:', isActuallyInitialized)
  }, [isInitialized, localInitialized, isActuallyInitialized])

  // Debug: Monitor useStaging and task proposals
  useEffect(() => {
    if (showProposals) {
      console.log('🔧 [VOICE_CAPTURE] TaskProposalModal opened with useStaging:', useStaging)
    }
  }, [showProposals, useStaging])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      // Disable voice capture when clarification chat is open
      if (showClarificationChat) {
        if (e.code === 'Escape') {
          handleClose()
        }
        return
      }
      
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey && isActuallyInitialized) {
        e.preventDefault()
        if (isRecording) {
          handleStopRecording()
        } else {
          handleStartRecording()
        }
      } else if (e.code === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [isOpen, isRecording, isActuallyInitialized, showClarificationChat])

  const initializeServices = async () => {
    try {
      setInitError(null)
      console.log('🔄 Starting voice services initialization...')
      
      // Check if we have API keys first
      const deepgramKey = localStorage.getItem('deepgram_api_key')
      const openaiKey = localStorage.getItem('openai_api_key')
      
      if (!deepgramKey) {
        if (openaiKey) {
          throw new Error('Voice capture requires a Deepgram API key. OpenAI Realtime API is not yet supported in the browser.')
        } else {
          throw new Error('Voice capture requires a Deepgram API key. Please configure it in Settings to get started.')
        }
      }
      
      await initialize()
      console.log('🎤 Voice services ready')
      
      // Update local state to trigger re-render
      setLocalInitialized(true)
      setInitError(null)
      
      // Force a small delay to ensure state updates propagate
      setTimeout(() => {
        const currentState = useVoiceStore.getState()
        console.log('🔄 Component state check - Store isInitialized:', currentState.isInitialized)
        console.log('🔄 Component state check - Store isConnected:', currentState.isConnected)
        console.log('🔄 Component state check - localInitialized:', localInitialized)
      }, 100)
    } catch (error) {
      console.error('🚨 Voice initialization failed:', error)
      
      // Provide user-friendly error messages
      let userError = 'Unknown error'
      if (error instanceof Error) {
        if (error.message.includes('Deepgram') || error.message.includes('API key')) {
          userError = error.message
        } else if (error.message.includes('microphone') || error.message.includes('getUserMedia')) {
          userError = 'Microphone access is required. Please grant permission in your browser.'
        } else if (error.message.includes('worklet') || error.message.includes('AudioWorklet')) {
          userError = 'Audio processing not supported. Please try a different browser (Chrome/Edge recommended).'
        } else {
          userError = error.message
        }
      }
      
      setInitError(userError)
      setLocalInitialized(false)
    }
  }



  const handleStartRecording = async () => {
    if (!isActuallyInitialized) {
      const deepgramKey = localStorage.getItem('deepgram_api_key')
      if (!deepgramKey) {
        toast.error('Deepgram API key required for voice capture. Click "Configure API Keys" below.')
      } else {
        toast.error('Voice services not initialized - check browser console for details')
      }
      return
    }
    
    try {
      console.log('🎤 Attempting to start recording...')
      await start()
      console.log('✅ Recording started successfully')
      toast.success('Voice recording started 🎤')
    } catch (error) {
      console.error('Failed to start recording:', error)
      toast.error(`Failed to start recording: ${error}`)
    }
  }

  const handleStopRecording = async () => {
    try {
      await stop()
      toast.success('Voice recording stopped')
      
      // Don't auto-process - let user decide when to shape into tasks
      // The transcript will be displayed and user can click "Shape into Tasks" button
    } catch (error) {
      console.error('Failed to stop recording:', error)
      toast.error('Failed to stop recording')
    }
  }

  // Enhanced: Analyze transcript into detailed tasks first, with clarification only as fallback
  const handleAnalyzeTask = async () => {
    if (!transcript.trim()) {
      toast.error('Please provide some input first!')
      return
    }

    const openaiKey = localStorage.getItem('openai_api_key') || localStorage.getItem('openai_key')
    if (!openaiKey) {
      toast.error('OpenAI API key not found. Please configure in Settings.')
      return
    }

    setIsShaping(true)
    try {
      // Quick sanity check of the API key
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${openaiKey}` }
      })
      if (!testResponse.ok) {
        throw new Error(`API key test failed: ${testResponse.status}`)
      }

      // Use enhanced task generation with detailed prompting
      const enhancedResult = await generateDetailedTasks(transcript, openaiKey)
      console.log('🔧 [VOICE] Enhanced AI result:', enhancedResult)

      if (enhancedResult.tasks && enhancedResult.tasks.length > 0) {
        // Ensure all tasks have complete details and normalize fields
        const enrichedTasks = enhancedResult.tasks.map((task: any) => enrichTaskWithDefaults(task, transcript))

        // Normalize to our TaskProposal shape
        const mappedTasks = enrichedTasks.map((t: any) => ({
          id: t.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: String(t.title || '').trim(),
          summary: t.summary || undefined,
          priority: t.priority as any,
          energy: t.energy as any,
          dueAt: t.dueAt ? new Date(t.dueAt).toISOString() : undefined,
          estimateMin: typeof t.estimateMin === 'number' ? t.estimateMin : undefined,
          labels: Array.isArray(t.labels) ? t.labels.slice(0, 8) : [],
          subtasks: Array.isArray(t.subtasks) ? t.subtasks.slice(0, 12) : [],
          confidence: typeof t.confidence === 'number' ? Math.max(0, Math.min(1, t.confidence)) : 0.85,
          reasoning: t.reasoning || `AI-generated task from voice input: "${transcript}"`,
          isRepeatable: !!t.isRepeatable,
          // Normalize repeat pattern to lower-case to match our type
          repeatPattern: t.repeatPattern ? String(t.repeatPattern).toLowerCase() : undefined,
          repeatInterval: t.repeatInterval || undefined,
          repeatDays: Array.isArray(t.repeatDays) ? t.repeatDays : undefined,
          repeatEndDate: t.repeatEndDate ? new Date(t.repeatEndDate).toISOString() : undefined,
          repeatCount: t.repeatCount || undefined,
          parentTaskId: t.parentTaskId || undefined,
          nextDueDate: t.nextDueDate ? new Date(t.nextDueDate).toISOString() : undefined
        }))

        setTaskProposals({
          tasks: mappedTasks,
          processingTime: 0
        })
        setShowProposals(true)
        toast.success(`✅ Generated ${mappedTasks.length} detailed task${mappedTasks.length > 1 ? 's' : ''}!`)
      } else {
        // Only fall back to clarification if absolutely no tasks could be generated
        const questions = generateSmartQuestions(transcript)
        setClarificationQuestions(questions)
        setShowClarificationChat(true)
        toast.success('🤔 Need more details to create the perfect task!')
      }
    } catch (error: any) {
      console.error('Task analysis failed:', error)
      toast.error(`Failed to analyze tasks: ${error?.message || error}`)
    } finally {
      setIsShaping(false)
    }
  }

  // Call OpenAI to generate detailed tasks with strict JSON output
  const generateDetailedTasks = async (inputTranscript: string, openaiKey: string) => {
    const prompt = `You are an expert ADHD-friendly task assistant. Convert this voice input into detailed, actionable tasks.\n\nCRITICAL: Always generate complete, detailed tasks with ALL fields populated. Never create bare-minimum tasks.\n\nInput: "${inputTranscript}"\n\nRULES:\n1. Extract or intelligently infer ALL task details\n2. Create actionable titles with clear verbs\n3. Generate helpful descriptions and context\n4. Assign appropriate priority based on urgency cues\n5. Estimate realistic time requirements\n6. Set energy levels based on task complexity\n7. Add relevant labels/tags\n8. Create subtasks for complex items\n9. Detect recurring patterns ("every", "daily", "weekly")\n10. Set due dates when timing is mentioned\n\nPRIORITY MAPPING:\n- "urgent", "asap", "critical" → URGENT\n- "important", "soon", "this week" → HIGH  \n- "regular", "normal", "when possible" → MEDIUM\n- "someday", "eventually", "low priority" → LOW\n\nENERGY MAPPING:\n- Creative work, complex thinking, important decisions → HIGH\n- Focused work, analysis, planning → MEDIUM\n- Admin tasks, email, quick calls → LOW\n\nTIME ESTIMATION:\n- "quick", "briefly" → 5-15 minutes\n- "short" → 15-30 minutes\n- Normal tasks → 30-60 minutes\n- "long", "detailed" → 60+ minutes\n\nReturn detailed JSON with this structure:\n{\n  "tasks": [{\n    "id": "generated-uuid",\n    "title": "Clear, actionable title with verb",\n    "summary": "Detailed description with context and specifics",\n    "priority": "LOW|MEDIUM|HIGH|URGENT",\n    "energy": "LOW|MEDIUM|HIGH",\n    "estimateMin": number,\n    "dueAt": "ISO date string or null",\n    "isRepeatable": boolean,\n    "repeatPattern": "DAILY|WEEKLY|MONTHLY|null",\n    "labels": ["category", "context", "energy"],\n    "subtasks": ["specific step 1", "specific step 2"],\n    "confidence": 0.8-1.0,\n    "reasoning": "Why these details were chosen"\n  }],\n  "metadata": {\n    "totalTasks": number,\n    "averageConfidence": number,\n    "processingNotes": "Any important observations"\n  }\n}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `Please convert this to detailed tasks: "${inputTranscript}"` }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API call failed: ${response.status}`)
    }

    const data = await response.json()
    try {
      const result = JSON.parse(data.choices?.[0]?.message?.content || '{"tasks": []}')
      return result
    } catch (e) {
      console.error('Failed parsing OpenAI JSON:', e, data)
      return { tasks: [] }
    }
  }

  // Fill in any missing details and auto-label tasks
  const enrichTaskWithDefaults = (task: any, originalTranscript: string) => {
    const enriched: any = { ...task }

    if (!enriched.id) {
      enriched.id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    if (!enriched.title || String(enriched.title).trim() === '') {
      enriched.title = originalTranscript.trim()
    }

    if (!enriched.summary) {
      enriched.summary = `Task created from voice input: "${originalTranscript}"`
    }

    const lower = originalTranscript.toLowerCase()

    if (!enriched.priority) {
      if (/(urgent|asap|critical)/.test(lower)) enriched.priority = 'URGENT'
      else if (/(important|soon|this week)/.test(lower)) enriched.priority = 'HIGH'
      else if (/(later|eventually|someday)/.test(lower)) enriched.priority = 'LOW'
      else enriched.priority = 'MEDIUM'
    }

    if (!enriched.energy) {
      if (/(creative|think|plan|design)/.test(lower)) enriched.energy = 'HIGH'
      else if (/(quick|email|call|admin)/.test(lower)) enriched.energy = 'LOW'
      else enriched.energy = 'MEDIUM'
    }

    if (!enriched.estimateMin) {
      if (/(quick|brief)/.test(lower)) enriched.estimateMin = 15
      else if (/(long|detailed)/.test(lower)) enriched.estimateMin = 90
      else enriched.estimateMin = 45
    }

    if (!Array.isArray(enriched.labels)) enriched.labels = []
    if (/(work|office|project)/.test(lower)) enriched.labels.push('work')
    if (/(personal|home|house)/.test(lower)) enriched.labels.push('personal')
    if (/(health|exercise|gym)/.test(lower)) enriched.labels.push('health')
    if (/(meeting|call)/.test(lower)) enriched.labels.push('communication')
    enriched.labels.push(`${String(enriched.energy).toLowerCase()}-energy`)

    if (!Array.isArray(enriched.subtasks)) {
      enriched.subtasks = []
      if (enriched.estimateMin > 60) {
        const base = String(enriched.title).toLowerCase()
        if (/(project|plan)/.test(base)) {
          enriched.subtasks = ['Research and gather information', 'Create initial outline', 'Develop detailed plan', 'Review and finalize']
        } else if (/(meeting|presentation)/.test(base)) {
          enriched.subtasks = ['Prepare materials', 'Schedule participants', 'Conduct session', 'Follow up on action items']
        }
      }
    }

    if (!enriched.confidence) enriched.confidence = 0.85

    if (enriched.isRepeatable === undefined) {
      enriched.isRepeatable = /(every|daily|weekly|monthly)/.test(lower)
    }

    if (enriched.isRepeatable && !enriched.repeatPattern) {
      if (/daily/.test(lower)) enriched.repeatPattern = 'DAILY'
      else if (/(weekly|every week)/.test(lower)) enriched.repeatPattern = 'WEEKLY'
      else if (/(monthly|every month)/.test(lower)) enriched.repeatPattern = 'MONTHLY'
      else enriched.repeatPattern = 'WEEKLY'
    }

    return enriched
  }

  // Generate smart questions when we truly cannot produce tasks
  const generateSmartQuestions = (input: string) => {
    const qs: string[] = []
    const lower = input.toLowerCase()
    if (lower.length < 5 || !lower.includes(' ')) qs.push('Can you provide more details about what you want to accomplish?')
    if (!/(when|time|day|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/.test(lower)) {
      qs.push('When would you like to complete this task?')
    }
    if (/(every|repeat)/.test(lower)) qs.push('How often should this task repeat?')
    return qs.slice(0, 2)
  }

  const handleShapeIntoTasks = async () => {
    if (!transcript.trim()) {
      toast.error('No transcript to process')
      return
    }

    const openaiKey = localStorage.getItem('openai_api_key')
    if (!openaiKey) {
      toast.error('OpenAI API key required. Please configure in Settings.')
      return
    }

    setIsShaping(true)
    try {
      // First, test the API key
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${openaiKey}` }
      })
      
      if (!testResponse.ok) {
        throw new Error(`API key test failed: ${testResponse.status}`)
      }

      // Process with voice calendar integration first
      const cal = new VoiceCalendarIntegration(openaiKey)
      // Use a higher confidence threshold for "Analyze Tasks" to make it the default high-confidence option
      const clarifyThreshold = 0.2 // Lower threshold means AI will be more confident by default
      
      const result = await cal.processVoiceInput(transcript, clarifyThreshold)
      
      // Debug: log what the AI returned
      console.log('🔧 [VOICE] AI result:', {
        intent: result.intent,
        confidence: result.confidence,
        tasks: result.tasks?.length || 0,
        clarifyingQuestions: result.clarifyingQuestions?.length || 0
      })
      
      // Debug: log clarification decision
      console.log('🔧 [VOICE] Clarification decision:', {
        intent: result.intent,
        confidence: result.confidence,
        clarifyThreshold,
        needsClarification: result.intent === 'needs_clarification',
        lowConfidence: result.confidence && result.confidence < clarifyThreshold,
        willShowChat: result.intent === 'needs_clarification' || (result.confidence && result.confidence < clarifyThreshold)
      })
      
      // Debug: log what we're about to do
      console.log('🔧 [VOICE] Action decision:', {
        showClarificationChat: result.intent === 'needs_clarification' || (result.confidence && result.confidence < clarifyThreshold),
        showCalendarProposals: result.calendarEvents && result.calendarEvents.length > 0,
        showTaskProposals: result.tasks && result.tasks.length > 0
      })
      
      // For "Analyze Tasks" button, we want to generate tasks directly
      // Only show clarification chat if the AI explicitly needs it
      if (result.intent === 'needs_clarification' || (result.confidence && result.confidence < clarifyThreshold)) {
        console.log('🔧 [VOICE] AI needs clarification, opening chat')
        const questions = result.clarifyingQuestions || [
          'What specific time should this task be done? (e.g., "6pm", "morning", "after lunch")',
          'Which day(s) of the week should this task repeat? (e.g., "every Monday", "weekends only")',
          'How often should this task repeat? (e.g., "daily", "weekly", "monthly")',
          'What is the specific location or context for this task? (e.g., "at home", "at work", "at the gym")',
          'What priority level should this task have? (Low, Medium, High, or Urgent)',
          'How much energy will this task require? (Low energy = easy, High energy = challenging)',
          'Are there any specific labels or categories for this task? (e.g., "work", "personal", "health", "finance")'
        ]
        setClarificationQuestions(questions)
        setShowClarificationChat(true)
        console.log('🔧 [VOICE] Clarification chat state set:', { questions, showClarificationChat: true })
        toast.success('🤔 Let\'s get the details right for your perfectly formatted task!')
        return
      }

      // If we have a clear result, show it with high confidence
      if (result.calendarEvents && result.calendarEvents.length > 0) {
        setCalendarProposals(result)
        setShowCalendarProposals(true)
        toast.success('✅ Calendar events generated!')
      } else if (result.tasks && result.tasks.length > 0) {
        // Boost confidence for "Analyze Tasks" - this is the default high-confidence option
        const boostedConfidence = Math.max(result.confidence || 0.8, 0.9)
        
        // Map VoiceCalendarResult tasks to TaskShapingResult format with ALL repeatable fields
        const mappedTasks = result.tasks.map(task => ({
          id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: task.title,
          summary: task.summary,
          priority: task.priority,
          energy: task.energy,
          dueAt: task.dueAt,
          estimateMin: task.estimateMin,
          labels: [], // VoiceCalendarResult doesn't have labels
          subtasks: [], // VoiceCalendarResult doesn't have subtasks
          confidence: boostedConfidence,
          reasoning: `AI-generated task from voice input: "${transcript}"`,
          isRepeatable: task.isRepeatable || false,
          // Map ALL repeatable fields
          repeatPattern: task.repeatPattern,
          repeatInterval: task.repeatInterval,
          repeatDays: task.repeatDays,
          repeatEndDate: task.repeatEndDate,
          repeatCount: task.repeatCount,
          parentTaskId: task.parentTaskId,
          nextDueDate: task.nextDueDate
        }))
        
        console.log('🔧 [VOICE] Mapped tasks with repeatable fields:', mappedTasks)
        
        setTaskProposals({
          tasks: mappedTasks,
          processingTime: Date.now() - Date.now()
        })
        setShowProposals(true)
        toast.success('✅ Tasks analyzed and ready!')
      } else {
        // If no tasks or calendar events, but no clarification needed, create a basic task
        const basicTask = {
          id: `basic-${Date.now()}`,
          title: transcript.trim(),
          summary: `Task created from voice input: "${transcript.trim()}"`,
          priority: 'MEDIUM' as const,
          confidence: 0.9,
          isRepeatable: false,
          dueAt: undefined,
          labels: [],
          subtasks: []
        }
        
        setTaskProposals({
          tasks: [basicTask],
          processingTime: Date.now() - Date.now()
        })
        setShowProposals(true)
        toast.success('✅ Basic task created from your input!')
      }
    } catch (error) {
      console.error('Task shaping failed:', error)
      let errorMessage = 'Failed to generate tasks'
      
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          errorMessage = 'Invalid or missing OpenAI API key'
        } else if (error.message.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded. Please try again later.'
        } else if (error.message.includes('quota')) {
          errorMessage = 'API quota exceeded. Please check your OpenAI account.'
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection.'
        } else {
          errorMessage = error.message
        }
      }
      
      toast.error(errorMessage)
    } finally {
      setIsShaping(false)
    }
  }

  const handleClose = () => {
    if (isRecording) {
      stop()
    }
    onClose()
  }

  const renderWordsWithConfidence = (words: WordWithConfidence[], text: string) => {
    if (!words || words.length === 0) {
      return <span>{text}</span>
    }

    return (
      <span>
        {words.map((word, index) => {
          const confidenceLevel = word.confidence || 1
          const isLowConfidence = confidenceLevel < 0.85
          
          return (
            <span
              key={index}
              className={`${isLowConfidence ? 'underline decoration-wavy decoration-red-400' : ''}`}
              title={word.confidence ? `Confidence: ${Math.round(confidenceLevel * 100)}%` : undefined}
            >
              {word.text}
              {index < words.length - 1 ? ' ' : ''}
            </span>
          )
        })}
      </span>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              🎤 Voice Capture
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Provider: {config.provider} • Space to start/stop • ESC to close
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600 dark:text-gray-300">Engine</label>
              <select
                className="text-xs bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1"
                value={config.provider}
                onChange={(e) => {
                  const provider = e.target.value as any
                  if (provider === 'openai') {
                    toast('OpenAI Realtime is experimental; Deepgram recommended for now')
                  }
                  useVoiceStore.getState().updateConfig({ provider })
                }}
              >
                <option value="deepgram">Deepgram (recommended)</option>
                <option value="openai">OpenAI (experimental)</option>
              </select>
            </div>
            <button
              onClick={handleClose}
              className="btn-ghost p-2"
              aria-label="Close voice capture"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Initialization Error */}
          {initError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                ⚠️ Initialization Failed
              </h3>
              <p className="text-red-800 dark:text-red-200 text-sm mb-3">
                {initError}
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={initializeServices}
                  className="btn-primary btn-sm"
                >
                  Retry
                </button>
                <button
                  onClick={() => window.open('/settings', '_blank')}
                  className="btn-secondary btn-sm"
                >
                  Configure API Keys
                </button>
                <button
                  onClick={async () => {
                    console.log('🔍 Debug Info:')
                    console.log('Component isInitialized:', isInitialized)
                    console.log('Component isConnected:', isConnected)
                    console.log('Component isActuallyInitialized:', isActuallyInitialized)
                    console.log('Store state:', useVoiceStore.getState())
                    console.log('Deepgram key:', localStorage.getItem('deepgram_api_key') ? 'Present' : 'Missing')
                    console.log('OpenAI key:', localStorage.getItem('openai_api_key') ? 'Present' : 'Missing')
                    console.log('Browser support:', {
                      getUserMedia: !!navigator.mediaDevices?.getUserMedia,
                      AudioWorklet: !!window.AudioWorklet,
                      WebSocket: !!window.WebSocket
                    })
                    
                    // Test API key with HTTP request
                    const apiKey = localStorage.getItem('deepgram_api_key')
                    if (apiKey) {
                      console.log('🧪 Testing Deepgram API key...')
                      try {
                        const response = await fetch('https://api.deepgram.com/v1/projects', {
                          headers: {
                            'Authorization': `Token ${apiKey}`
                          }
                        })
                        console.log('🧪 API Test Response Status:', response.status)
                        if (response.ok) {
                          console.log('✅ API key is valid')
                        } else {
                          console.log('❌ API key rejected:', await response.text())
                        }
                      } catch (error) {
                        console.log('❌ API test failed:', error)
                      }
                    }
                  }}
                  className="btn-ghost btn-sm"
                >
                  Debug Info
                </button>
              </div>
            </div>
          )}

          {/* Setup Guide for when not initialized */}
          {!isActuallyInitialized && !initError && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">🎤</div>
              <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Voice Capture Setup Required
              </h3>
              <p className="text-blue-800 dark:text-blue-200 text-sm mb-4">
                To use voice capture, you need a Deepgram API key for real-time speech-to-text.
              </p>
              <div className="space-y-3">
                <div className="text-left bg-white dark:bg-gray-800 rounded-lg p-4 text-sm">
                  <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">Quick Setup:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700 dark:text-gray-300">
                    <li>Sign up at <a href="https://console.deepgram.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">console.deepgram.com</a> (free $200 credit)</li>
                    <li>Create an API key in your dashboard</li>
                    <li>Click "Configure API Keys" below to save it</li>
                    <li>Return here and click "Retry" to start voice capture</li>
                  </ol>
                </div>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={initializeServices}
                    className="btn-primary"
                  >
                    Retry Initialization
                  </button>
                  <button
                    onClick={() => window.open('/settings', '_blank')}
                    className="btn-secondary"
                  >
                    Configure API Keys
                  </button>
                  <button
                    onClick={() => {
                      // Force component re-render by checking current store state
                      const currentState = useVoiceStore.getState()
                      console.log('🔄 Force refresh - current store state:', currentState)
                      if (currentState.isInitialized) {
                        console.log('✅ Store shows initialized - forcing UI update')
                        // The component should automatically re-render when store changes
                      }
                    }}
                    className="btn-ghost btn-sm"
                  >
                    Refresh Status
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recording Interface */}
          {isActuallyInitialized && !initError && (
            <div className="space-y-6">
              {/* Status & Controls */}
              <div className="text-center space-y-4">
                {/* Status Badge */}
                <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                  isRecording 
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200' 
                    : isActuallyInitialized
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
                }`}>
                  {isRecording ? '🔴 Recording...' : isActuallyInitialized ? '🟢 Ready' : '⚪ Initializing...'}
                </div>

                {/* Large Push-to-Talk Button */}
                <button
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  disabled={!isActuallyInitialized}
                  className={`w-24 h-24 rounded-full flex items-center justify-center text-3xl transition-all duration-200 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg scale-110'
                      : 'bg-primary-500 hover:bg-primary-600 text-white shadow-md hover:shadow-lg'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  aria-label={isRecording ? 'Stop recording (Space)' : 'Start recording (Space)'}
                >
                  {isRecording ? '🛑' : '🎤'}
                </button>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {isRecording ? 'Press Space or click to stop' : 'Press Space or click to start'}
                </p>
              </div>

              {/* Audio Level Meter */}
              {isRecording && audioLevel && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Audio Level
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      RMS: {Math.round(audioLevel.rms * 100)}% • Peak: {Math.round(audioLevel.peak * 100)}%
                    </p>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div className="flex h-full">
                      {/* RMS Level */}
                      <div
                        className="bg-green-500 h-full transition-all duration-100"
                        style={{ width: `${audioLevel.rms * 100}%` }}
                      />
                      {/* Peak Level */}
                      <div
                        className="bg-yellow-400 h-full transition-all duration-50"
                        style={{ width: `${Math.max(0, (audioLevel.peak - audioLevel.rms) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Live Transcript */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Live Transcript
                  </h3>
                  <button
                    onClick={() => setShowMetrics(!showMetrics)}
                    className="btn-ghost btn-sm text-xs"
                  >
                    📊 {showMetrics ? 'Hide' : 'Show'} Metrics
                  </button>
                </div>
                
                {/* Final Transcript */}
                {transcript && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                    <div className="text-green-800 dark:text-green-200">
                      {renderWordsWithConfidence(words || [], transcript)}
                    </div>
                    {confidence && (
                      <div className="flex justify-between items-center mt-2 text-xs">
                        <span className="text-green-600 dark:text-green-400">
                          Overall Confidence: {Math.round(confidence * 100)}%
                        </span>
                        <span className="text-green-500 dark:text-green-400">
                          ✓ Final
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Interim Transcript */}
                {interimTranscript && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                    <div className="text-blue-800 dark:text-blue-200 italic">
                      {renderWordsWithConfidence(words || [], interimTranscript)}
                    </div>
                    <div className="flex justify-between items-center mt-2 text-xs">
                      <span className="text-blue-600 dark:text-blue-400">
                                            {confidence ? `Confidence: ${Math.round(confidence * 100)}%` : 'Processing...'}
                  </span>
                  <span className="text-blue-500 dark:text-blue-400">
                    ⏳ Interim
                  </span>
                </div>
              </div>
            )}

            {/* Task Shaping Actions */}
            {transcript && transcript.trim().length > 10 && !isRecording && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-purple-900 dark:text-purple-100">
                      🤖 Ready to create tasks from your voice?
                    </h4>
                    <p className="text-sm text-purple-700 dark:text-purple-200 mt-1">
                      Choose how you want to create your task: Get interactive details or let AI analyze directly
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        // Always open clarification chat with comprehensive questions
                        const questions = [
                          'What specific time should this task be done? (e.g., "6pm", "morning", "after lunch")',
                          'Which day(s) of the week should this task repeat? (e.g., "every Monday", "weekends only")',
                          'How often should this task repeat? (e.g., "daily", "weekly", "monthly")',
                          'What is the specific location or context for this task? (e.g., "at home", "at work", "at the gym")',
                          'What priority level should this task have? (Low, Medium, High, or Urgent)',
                          'How much energy will this task require? (Low energy = easy, High energy = challenging)',
                          'Are there any specific labels or categories for this task? (e.g., "work", "personal", "health", "finance")'
                        ]
                        setClarificationQuestions(questions)
                        setShowClarificationChat(true)
                        toast.success('Opening clarification chat to get task details!')
                      }}
                      className="btn-ghost flex items-center space-x-2 text-xs"
                      title="Get more details to create a perfect task"
                    >
                      💬 Get Task Details
                    </button>
                    <button
                      onClick={handleAnalyzeTask}
                      disabled={isShaping}
                      className="btn-primary flex items-center space-x-2"
                    >
                      {isShaping ? (
                        <>
                          <div className="spinner w-4 h-4"></div>
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <span>🎯</span>
                          <span>Analyze Tasks</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Placeholder */}
            {!transcript && !interimTranscript && (
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  {isRecording ? 'Listening... Start speaking to see your words appear here.' : 'Click the microphone to begin voice capture.'}
                </p>
              </div>
            )}

                {/* Metrics Panel */}
                {showMetrics && currentSession && (
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      📊 Session Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Provider:</span>
                        <span className="ml-1 font-mono">{config.provider}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                        <span className="ml-1 font-mono">{Math.round(currentSession.totalDuration / 1000)}s</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Chunks:</span>
                        <span className="ml-1 font-mono">{currentSession.transcriptChunks.length}</span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Model:</span>
                        <span className="ml-1 font-mono">{config.model}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading State */}
          {!isInitialized && !initError && (
            <div className="text-center py-8">
              <div className="spinner w-8 h-8 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">
                Initializing voice services...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 rounded-b-lg">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="mr-4">🔴 Low confidence words are underlined</span>
              <span>⌨️ Space: Record • ESC: Close</span>
            </div>
            <button
              onClick={handleClose}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Task Proposals Modal */}
      <TaskProposalModal
        isOpen={showProposals}
        onClose={() => {
          setShowProposals(false)
          setTaskProposals(null)
        }}
        proposals={taskProposals}
        transcript={transcript}
        useStaging={useStaging}
      />

      {/* Voice Calendar Modal */}
      <VoiceCalendarModal
        isOpen={showCalendarProposals}
        onClose={() => {
          setShowCalendarProposals(false)
          setCalendarProposals(null)
        }}
        proposals={calendarProposals}
        transcript={transcript}
        useStaging={useStaging}
      />

      {/* Clarification Chat Modal */}
      <TaskClarificationChat
        isOpen={showClarificationChat}
        onClose={() => {
          setShowClarificationChat(false)
          setClarificationQuestions([])
        }}
        originalTranscript={transcript}
        initialQuestions={clarificationQuestions}
        onTaskCreated={(task) => {
          // Handle the created task from the chat
          setTaskProposals({
            tasks: [task],
            processingTime: Date.now() - Date.now()
          })
          setShowProposals(true)
          setShowClarificationChat(false)
          setClarificationQuestions([])
        }}
      />
    </div>
  )
}
