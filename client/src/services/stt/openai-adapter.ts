// OpenAI Realtime API Adapter - WebSocket streaming with lower latency

import type { 
  STTAdapter, 
  STTConfig, 
  STTMetrics, 
  InterimCallback, 
  FinalCallback, 
  ErrorCallback,
  TranscriptMeta 
} from '@/types/stt'

interface OpenAIRealtimeEvent {
  type: string
  event_id?: string
  item?: {
    id: string
    type: string
    status: string
    role: string
    content?: Array<{
      type: string
      transcript?: string
    }>
  }
  delta?: {
    transcript?: string
  }
  response?: {
    id: string
    status: string
    output?: Array<{
      type: string
      content?: Array<{
        type: string
        transcript?: string
      }>
    }>
  }
}

export class OpenAIAdapter implements STTAdapter {
  readonly name = 'openai-realtime'
  readonly supportsInterim = true
  readonly supportsConfidence = false // OpenAI doesn't expose confidence scores
  readonly supportsWordTimestamps = false

  private ws: WebSocket | null = null
  private config: STTConfig
  private sessionStartTime = 0
  private metrics: STTMetrics = {
    totalLatency: 0,
    firstInterimLatency: 0,
    finalResultLatency: 0,
    bytesProcessed: 0,
    sessionsCount: 0,
    errorRate: 0
  }
  private onInterim: InterimCallback | null = null
  private onFinal: FinalCallback | null = null
  private onError: ErrorCallback | null = null
  private firstInterimReceived = false
  private currentTranscript = ''

  constructor(config: STTConfig) {
    this.config = config
  }

  async start(
    sessionId: string,
    onInterim: InterimCallback,
    onFinal: FinalCallback,
    onError: ErrorCallback
  ): Promise<void> {
    this.onInterim = onInterim
    this.onFinal = onFinal
    this.onError = onError
    this.sessionStartTime = Date.now()
    this.firstInterimReceived = false
    this.currentTranscript = ''
    this.metrics.sessionsCount++

    const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01'
    
    try {
      // Note: WebSocket constructor doesn't support headers in browser
      // We'll need to use query params or handle auth differently
      this.ws = new WebSocket(wsUrl)
      
      this.ws.onopen = () => {
        console.log('🎤 OpenAI Realtime connection opened')
        this.initializeSession()
      }
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      
      this.ws.onerror = (event) => {
        console.error('🚨 OpenAI Realtime WebSocket error:', event)
        this.metrics.errorRate++
        onError(new Error('OpenAI Realtime WebSocket error'))
      }
      
      this.ws.onclose = (event) => {
        console.log('🎤 OpenAI Realtime connection closed:', event.code, event.reason)
        if (event.code !== 1000) {
          onError(new Error(`OpenAI connection closed unexpectedly: ${event.reason}`))
        }
      }

      // Wait for connection to open
      await this.waitForConnection()
    } catch (error) {
      this.metrics.errorRate++
      throw new Error(`Failed to connect to OpenAI Realtime: ${error}`)
    }
  }

  push(pcmData: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Convert PCM to base64 for OpenAI
      const uint8Array = new Uint8Array(pcmData)
      let binaryString = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binaryString += String.fromCharCode(uint8Array[i])
      }
      const base64 = btoa(binaryString)
      
      const audioEvent = {
        type: 'input_audio_buffer.append',
        audio: base64
      }
      
      this.ws.send(JSON.stringify(audioEvent))
      this.metrics.bytesProcessed += pcmData.byteLength
    }
  }

  async stop(): Promise<void> {
    if (this.ws) {
      // Commit the audio buffer for final processing
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.commit'
      }))
      
      // Create response to get final transcript
      this.ws.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['text'],
          instructions: 'Please transcribe the audio you just received.'
        }
      }))
      
      // Wait a moment for final response, then close
      setTimeout(() => {
        this.ws?.close(1000, 'Session ended')
        this.ws = null
      }, 1000)
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  getMetrics(): STTMetrics {
    return { ...this.metrics }
  }

  private initializeSession(): void {
    if (!this.ws) return

    // Send authentication first
    const authEvent = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are a transcription assistant. Transcribe speech accurately with proper punctuation.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800
        }
      }
    }

    // Include API key in the session update for authentication
    if (this.config.apiKey) {
      (authEvent as any).api_key = this.config.apiKey
    }

    this.ws.send(JSON.stringify(authEvent))
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'))
        return
      }

      if (this.ws.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, 10000) // OpenAI can be slower to connect

      this.ws.addEventListener('open', () => {
        clearTimeout(timeout)
        resolve()
      }, { once: true })

      this.ws.addEventListener('error', () => {
        clearTimeout(timeout)
        reject(new Error('Connection failed'))
      }, { once: true })
    })
  }

  private handleMessage(data: string): void {
    try {
      const event: OpenAIRealtimeEvent = JSON.parse(data)
      const now = Date.now()
      const latency = now - this.sessionStartTime

      // Handle different event types
      switch (event.type) {
        case 'input_audio_buffer.speech_started':
          console.log('🎤 OpenAI detected speech start')
          break

        case 'input_audio_buffer.speech_stopped':
          console.log('🎤 OpenAI detected speech stop')
          // Trigger transcription
          this.ws?.send(JSON.stringify({
            type: 'input_audio_buffer.commit'
          }))
          break

        case 'conversation.item.input_audio_transcription.completed':
          // This is our transcription result
          const transcript = event.item?.content?.[0]?.transcript
          if (transcript) {
            this.handleTranscript(transcript, latency, true)
          }
          break

        case 'conversation.item.input_audio_transcription.failed':
          console.error('🚨 OpenAI transcription failed')
          this.metrics.errorRate++
          this.onError?.(new Error('Transcription failed'))
          break

        case 'response.audio_transcript.delta':
          // Interim transcript
          const delta = event.delta?.transcript
          if (delta) {
            this.currentTranscript += delta
            this.handleTranscript(this.currentTranscript, latency, false)
          }
          break

        case 'response.audio_transcript.done':
          // Final transcript from response
          if (this.currentTranscript) {
            this.handleTranscript(this.currentTranscript, latency, true)
            this.currentTranscript = ''
          }
          break

        case 'error':
          console.error('🚨 OpenAI Realtime error:', event)
          this.metrics.errorRate++
          this.onError?.(new Error('OpenAI Realtime API error'))
          break
      }

    } catch (error) {
      console.error('🚨 Error parsing OpenAI response:', error)
      this.metrics.errorRate++
      this.onError?.(new Error('Failed to parse STT response'))
    }
  }

  private handleTranscript(transcript: string, latency: number, isFinal: boolean): void {
    if (!transcript.trim()) return

    // Track first interim latency
    if (!this.firstInterimReceived && !isFinal) {
      this.metrics.firstInterimLatency = latency
      this.firstInterimReceived = true
    }

    const meta: TranscriptMeta = {
      confidence: undefined, // OpenAI doesn't provide confidence scores
      words: undefined,      // OpenAI doesn't provide word-level timing
      isFinal,
      latency,
      provider: 'openai-realtime'
    }

    if (isFinal) {
      this.metrics.finalResultLatency = latency
      this.metrics.totalLatency = (this.metrics.totalLatency + latency) / 2
      this.onFinal?.(transcript, meta)
    } else {
      this.onInterim?.(transcript, meta)
    }
  }
}
