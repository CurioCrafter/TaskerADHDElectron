import { create } from 'zustand'
import { VoiceCaptureService, AudioLevelData } from '@/services/voice-capture'
import { STTManager } from '@/services/stt/stt-manager'
import type { STTConfig, TranscriptMeta, AudioSession } from '@/types/stt'

interface VoiceState {
  // Connection & Recording state
  isInitialized: boolean
  isConnected: boolean
  isRecording: boolean
  
  // Audio levels
  audioLevel: AudioLevelData | null
  
  // Transcript data
  transcript: string
  interimTranscript: string
  confidence: number | null
  words: any[] | null
  
  // Session data
  currentSession: AudioSession | null
  
  // Services
  captureService: VoiceCaptureService | null
  sttManager: STTManager | null
  
  // Configuration
  config: STTConfig
  
  // Actions
  initialize: () => Promise<void>
  updateConfig: (config: Partial<STTConfig>) => void
  start: () => Promise<void>
  stop: () => Promise<void>
  destroy: () => void
  
  // Internal setters
  setInitialized: (initialized: boolean) => void
  setConnected: (connected: boolean) => void
  setRecording: (recording: boolean) => void
  setAudioLevel: (level: AudioLevelData | null) => void
  setTranscript: (transcript: string) => void
  setInterimTranscript: (transcript: string) => void
  setConfidence: (confidence: number | null) => void
  setWords: (words: any[] | null) => void
  setCurrentSession: (session: AudioSession | null) => void
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  // Initial state
  isInitialized: false,
  isConnected: false,
  isRecording: false,
  audioLevel: null,
  transcript: '',
  interimTranscript: '',
  confidence: null,
  words: null,
  currentSession: null,
  captureService: null,
  sttManager: null,
  
  // Default configuration - prioritize Deepgram for best experience
  config: {
    provider: 'deepgram',
    apiKey: '',
    model: 'nova-2',
    language: 'en-US',
    enableInterim: true,
    enableConfidence: true,
    enableWordTimestamps: true,
    sampleRate: 48000,
    encoding: 'pcm16',
    utteranceEndMs: 2000
  },

  // Initialize voice services
  initialize: async () => {
    const { config } = get()
    
    try {
      // Get API key from localStorage - try multiple sources
      const deepgramKey = typeof window !== 'undefined' ? localStorage.getItem('deepgram_api_key') : null
      const openaiKey = typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : null 
      const apiKey = deepgramKey || openaiKey || config.apiKey

      if (!apiKey) {
        const errorMsg = 'No API key found. Please configure your Deepgram or OpenAI API key in Settings.'
        console.warn('🔑 ' + errorMsg)
        throw new Error(errorMsg)
      }

      // Determine provider - prefer Deepgram for now
      let provider: 'deepgram' | 'openai' = 'deepgram'
      if (!deepgramKey && openaiKey) {
        // For now, recommend Deepgram since OpenAI Realtime has browser auth complexities
        throw new Error('OpenAI Realtime API is not yet fully supported. Please configure a Deepgram API key for the best experience.')
      }
      
      if (!deepgramKey) {
        throw new Error('Deepgram API key is required. Please configure it in Settings.')
      }

      console.log(`🔧 Initializing voice services with ${provider}...`)

      // Update config with API key and provider
      const finalConfig = { ...config, apiKey: deepgramKey, provider }

      // Initialize voice capture service first
      console.log('🎤 Initializing voice capture service...')
      const captureService = new VoiceCaptureService({
        sampleRate: finalConfig.sampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      })

      await captureService.initialize()
      console.log('✅ Voice capture service initialized')

      // Initialize STT manager
      console.log(`🤖 Initializing STT manager with ${provider}...`)
      const sttManager = new STTManager(finalConfig)
      await sttManager.initialize()
      console.log('✅ STT manager initialized')

      set({ 
        captureService, 
        sttManager, 
        isInitialized: true,
        isConnected: sttManager.isConnected(),
        config: finalConfig
      })

      console.log('🎉 Voice services initialized successfully!')
      console.log('🔧 Provider:', provider)
      console.log('🔧 API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'None')
      console.log('🔧 Capabilities:', sttManager.getCapabilities())

    } catch (error) {
      console.error('🚨 Voice services initialization failed:', error)
      set({ isInitialized: false, isConnected: false })
      
      // Provide more specific error information
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          console.error('💡 Solution: Go to Settings and configure your API key')
        } else if (error.message.includes('microphone') || error.message.includes('getUserMedia')) {
          console.error('💡 Solution: Grant microphone permission in your browser')
        } else if (error.message.includes('AudioWorklet') || error.message.includes('worklet')) {
          console.error('💡 Solution: Make sure pcm-worklet.js is accessible at /pcm-worklet.js')
        }
      }
      
      throw error
    }
  },

  // Update configuration
  updateConfig: (newConfig) => {
    const { config } = get()
    const updatedConfig = { ...config, ...newConfig }
    set({ config: updatedConfig })
    
    // If STT manager exists, update its config too
    const { sttManager } = get()
    if (sttManager) {
      sttManager.updateConfig(newConfig)
    }
  },

  // Start recording
  start: async () => {
    const { captureService, sttManager, isInitialized } = get()
    
    if (!isInitialized) {
      // Try to initialize first
      try {
        await get().initialize()
      } catch (error) {
        throw new Error(`Cannot start recording: ${error}`)
      }
    }

    const { captureService: cs, sttManager: sm } = get()
    if (!cs || !sm) {
      throw new Error('Voice services not properly initialized')
    }

    try {
      // Clear previous session data
      set({ 
        transcript: '', 
        interimTranscript: '', 
        confidence: null,
        words: null,
        currentSession: null
      })

      // Start STT session
      const sessionId = await sm.startSession(
        'dev-user-1', // TODO: Get from auth store
        
        // Interim callback - accumulate into running text for smoother feel
        (text: string, meta: TranscriptMeta) => {
          const { interimTranscript: prevInterim } = get()
          const combined = text // keep last interim only to avoid jitter; provider streams full hypothesis
          set({ 
            interimTranscript: combined,
            confidence: meta.confidence || null,
            words: meta.words || null
          })
        },
        
        // Final callback - append to cumulative transcript; don't clear existing
        (text: string, meta: TranscriptMeta) => {
          const { transcript: prev } = get()
          const separator = prev && !prev.endsWith('.') && !prev.endsWith('!') && !prev.endsWith('?') ? '. ' : ' '
          const appended = (prev ? prev + separator : '') + text
          set({ 
            transcript: appended.trim(),
            // keep interimTranscript empty until next interim arrives
            interimTranscript: '',
            confidence: meta.confidence || null,
            words: meta.words || null
          })
        },
        
        // Error callback
        (error: Error) => {
          console.error('🚨 STT Error:', error)
          set({ isRecording: false })
        }
      )

      // Start voice capture
      await cs.start(
        // Audio data callback
        (pcmData: ArrayBuffer) => {
          sm.pushAudio(pcmData)
        },
        
        // Audio level callback
        (levelData: AudioLevelData) => {
          set({ audioLevel: levelData })
        },
        
        // Error callback
        (error: Error) => {
          console.error('🚨 Voice Capture Error:', error)
          set({ isRecording: false })
        }
      )

      set({ 
        isRecording: true,
        isConnected: sm.isConnected(),
        currentSession: sm.getCurrentSession()
      })

      console.log('🎤 Voice recording started, session:', sessionId)

    } catch (error) {
      console.error('🚨 Failed to start recording:', error)
      set({ isRecording: false })
      throw error
    }
  },

  // Stop recording
  stop: async () => {
    const { captureService, sttManager } = get()
    
    try {
      // Stop voice capture
      if (captureService) {
        captureService.stop()
      }

      // Stop STT session and get final session data
      let finalSession = null
      if (sttManager) {
        finalSession = await sttManager.stopSession()
      }

      set({ 
        isRecording: false,
        audioLevel: null,
        currentSession: finalSession
      })

      console.log('🎤 Voice recording stopped')
      if (finalSession) {
        console.log('📊 Final session:', finalSession)
      }

    } catch (error) {
      console.error('🚨 Error stopping recording:', error)
      set({ isRecording: false, audioLevel: null })
    }
  },

  // Destroy services
  destroy: () => {
    const { captureService, sttManager } = get()
    
    if (captureService) {
      captureService.destroy()
    }
    
    set({ 
      captureService: null,
      sttManager: null,
      isInitialized: false,
      isConnected: false,
      isRecording: false,
      audioLevel: null,
      transcript: '',
      interimTranscript: '',
      confidence: null,
      words: null,
      currentSession: null
    })

    console.log('🎤 Voice services destroyed')
  },

  // Internal setters
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  setConnected: (connected) => set({ isConnected: connected }),
  setRecording: (recording) => set({ isRecording: recording }),
  setAudioLevel: (level) => set({ audioLevel: level }),
  setTranscript: (transcript) => set({ transcript }),
  setInterimTranscript: (transcript) => set({ interimTranscript: transcript }),
  setConfidence: (confidence) => set({ confidence }),
  setWords: (words) => set({ words }),
  setCurrentSession: (session) => set({ currentSession: session })
}))