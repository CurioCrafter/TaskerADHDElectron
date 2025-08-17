// STT Manager - Coordinates different STT adapters and provides unified interface

import type { 
  STTAdapter, 
  STTConfig, 
  STTMetrics, 
  InterimCallback, 
  FinalCallback, 
  ErrorCallback,
  TranscriptChunk,
  AudioSession
} from '@/types/stt'

import { DeepgramAdapter } from './deepgram-adapter'
import { OpenAIAdapter } from './openai-adapter'

export class STTManager {
  private adapter: STTAdapter | null = null
  private config: STTConfig
  private currentSession: AudioSession | null = null
  private transcriptChunks: TranscriptChunk[] = []
  private sessionStartTime = 0

  constructor(config: STTConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    // Create adapter based on provider
    switch (this.config.provider) {
      case 'deepgram':
        this.adapter = new DeepgramAdapter(this.config)
        break
      case 'openai':
        // OpenAI Realtime API has complex browser authentication - temporarily disabled
        throw new Error('OpenAI Realtime API is not yet fully supported in browsers. Please use Deepgram for now.')
        // this.adapter = new OpenAIAdapter(this.config)
        break
      default:
        throw new Error(`Unsupported STT provider: ${this.config.provider}`)
    }

    console.log(`🎤 STT Manager initialized with ${this.adapter.name} adapter`)
  }

  async startSession(
    userId: string,
    onInterim: InterimCallback,
    onFinal: FinalCallback,
    onError: ErrorCallback
  ): Promise<string> {
    if (!this.adapter) {
      throw new Error('STT Manager not initialized')
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.sessionStartTime = Date.now()
    this.transcriptChunks = []

    // Create session record
    this.currentSession = {
      id: sessionId,
      userId,
      startTime: new Date(),
      totalDuration: 0,
      transcriptChunks: [],
      config: this.config,
      metrics: this.adapter.getMetrics()
    }

    // Wrap callbacks to collect transcript chunks
    const wrappedOnInterim: InterimCallback = (text, meta) => {
      const chunk: TranscriptChunk = {
        id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text,
        startTime: Date.now() - this.sessionStartTime,
        endTime: Date.now() - this.sessionStartTime,
        confidence: meta.confidence,
        words: meta.words,
        isFinal: false,
        provider: this.adapter!.name,
        sessionId,
        createdAt: new Date()
      }
      
      // Replace last interim chunk or add new one
      const lastChunk = this.transcriptChunks[this.transcriptChunks.length - 1]
      if (lastChunk && !lastChunk.isFinal) {
        this.transcriptChunks[this.transcriptChunks.length - 1] = chunk
      } else {
        this.transcriptChunks.push(chunk)
      }

      onInterim(text, meta)
    }

    const wrappedOnFinal: FinalCallback = (text, meta) => {
      const chunk: TranscriptChunk = {
        id: `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        text,
        startTime: Date.now() - this.sessionStartTime,
        endTime: Date.now() - this.sessionStartTime,
        confidence: meta.confidence,
        words: meta.words,
        isFinal: true,
        provider: this.adapter!.name,
        sessionId,
        createdAt: new Date()
      }

      // Replace last chunk if it was interim, otherwise add new
      const lastChunk = this.transcriptChunks[this.transcriptChunks.length - 1]
      if (lastChunk && !lastChunk.isFinal && lastChunk.text.trim() === text.trim()) {
        this.transcriptChunks[this.transcriptChunks.length - 1] = chunk
      } else {
        this.transcriptChunks.push(chunk)
      }

      onFinal(text, meta)
    }

    await this.adapter.start(sessionId, wrappedOnInterim, wrappedOnFinal, onError)
    
    console.log(`🎤 STT session started: ${sessionId}`)
    return sessionId
  }

  pushAudio(pcmData: ArrayBuffer): void {
    if (!this.adapter) {
      throw new Error('STT Manager not initialized')
    }
    
    this.adapter.push(pcmData)
  }

  async stopSession(): Promise<AudioSession | null> {
    if (!this.adapter || !this.currentSession) {
      return null
    }

    await this.adapter.stop()
    
    // Finalize session
    this.currentSession.endTime = new Date()
    this.currentSession.totalDuration = Date.now() - this.sessionStartTime
    this.currentSession.transcriptChunks = [...this.transcriptChunks]
    this.currentSession.metrics = this.adapter.getMetrics()

    const session = this.currentSession
    this.currentSession = null
    this.transcriptChunks = []

    console.log(`🎤 STT session stopped: ${session.id}`)
    console.log(`📊 Session metrics:`, session.metrics)
    
    return session
  }

  isConnected(): boolean {
    return this.adapter?.isConnected() || false
  }

  getMetrics(): STTMetrics | null {
    return this.adapter?.getMetrics() || null
  }

  getCurrentSession(): AudioSession | null {
    return this.currentSession
  }

  getTranscriptChunks(): TranscriptChunk[] {
    return [...this.transcriptChunks]
  }

  // Get full transcript text from chunks
  getFullTranscript(): string {
    const texts: string[] = []
    for (const chunk of this.transcriptChunks) {
      if (chunk.text && chunk.text.trim().length > 0) {
        // If last text ends without punctuation and new chunk does not start with capital, add space without extra period
        texts.push(chunk.text.trim())
      }
    }
    return texts.join(' ').replace(/\s+/g, ' ').trim()
  }

  // Update configuration
  updateConfig(newConfig: Partial<STTConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('🎤 STT configuration updated:', this.config)
  }

  // Get supported features for current adapter
  getCapabilities(): {
    supportsInterim: boolean
    supportsConfidence: boolean
    supportsWordTimestamps: boolean
  } | null {
    if (!this.adapter) return null
    
    return {
      supportsInterim: this.adapter.supportsInterim,
      supportsConfidence: this.adapter.supportsConfidence,
      supportsWordTimestamps: this.adapter.supportsWordTimestamps
    }
  }
}
