// Deepgram STT Adapter - WebSocket streaming with interim/final results and confidence

import type { 
  STTAdapter, 
  STTConfig, 
  STTMetrics, 
  InterimCallback, 
  FinalCallback, 
  ErrorCallback,
  Word,
  TranscriptMeta 
} from '@/types/stt'

interface DeepgramResponse {
  channel: {
    alternatives: Array<{
      transcript: string
      confidence: number
      words?: Array<{
        word: string
        start: number
        end: number
        confidence: number
        punctuated_word?: string
      }>
    }>
  }
  is_final: boolean
  speech_final: boolean
  duration: number
  start: number
  metadata?: {
    request_id: string
    model_info: {
      name: string
      version: string
    }
  }
}

export class DeepgramAdapter implements STTAdapter {
  readonly name = 'deepgram'
  readonly supportsInterim = true
  readonly supportsConfidence = true
  readonly supportsWordTimestamps = true

  private ws: WebSocket | null = null
  private config: STTConfig
  private sessionStartTime = 0
  private keepAliveIntervalId: any = null
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
    this.metrics.sessionsCount++

    // First attempt: authenticate using Sec-WebSocket-Protocol header (browser-supported)
    const wsUrl = this.buildWebSocketUrl(false)
    console.log('🔗 Connecting to Deepgram WebSocket (protocol auth):', wsUrl)
    
    try {
      // Create WebSocket using subprotocols: ['token', <API_KEY>]
      this.ws = new WebSocket(wsUrl, ['token', this.config.apiKey || ''])
      
      this.ws.onopen = () => {
        console.log('🎤 Deepgram connection opened successfully')
        // KeepAlive to prevent idle disconnects
        this.keepAliveIntervalId = window.setInterval(() => {
          try {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
            }
          } catch (_) {}
        }, 5000)
      }
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data)
      }
      
      this.ws.onerror = (event) => {
        console.error('🚨 Deepgram WebSocket error:', event)
        this.metrics.errorRate++
        onError(new Error('Deepgram WebSocket error'))
      }
      
      this.ws.onclose = (event) => {
        console.log('🎤 Deepgram connection closed:', event.code, event.reason)
        if (this.keepAliveIntervalId) {
          clearInterval(this.keepAliveIntervalId)
          this.keepAliveIntervalId = null
        }
        if (event.code !== 1000) { // Not a clean close
          let errorMessage = `Deepgram connection closed unexpectedly (code: ${event.code})`
          
          // Provide specific error messages for common WebSocket error codes
          switch (event.code) {
            case 1006:
              errorMessage += '. This usually indicates a network issue, invalid API key, or server rejection.'
              break
            case 1002:
              errorMessage += '. Protocol error - check API key format and parameters.'
              break
            case 1003:
              errorMessage += '. Unsupported data type or encoding.'
              break
            case 1005:
              errorMessage += '. No status code was provided.'
              break
            default:
              if (event.reason) {
                errorMessage += `: ${event.reason}`
              }
          }
          
          onError(new Error(errorMessage))
        }
      }

      // Wait for connection to open
      await this.waitForConnection()
    } catch (error) {
      console.warn('⚠️ Protocol auth failed, retrying with access_token in URL...', error)
      this.metrics.errorRate++
      // Fallback: include access_token in URL for environments that don't forward subprotocols
      const wsUrlWithToken = this.buildWebSocketUrl(true)
      console.log('🔗 Connecting to Deepgram WebSocket (query token):', wsUrlWithToken.replace(/access_token=[^&]+/g, 'access_token=***'))

      // Reset and try again
      this.ws = new WebSocket(wsUrlWithToken)

      this.ws.onopen = () => {
        console.log('🎤 Deepgram connection opened successfully (query token)')
        this.keepAliveIntervalId = window.setInterval(() => {
          try {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({ type: 'KeepAlive' }))
            }
          } catch (_) {}
        }, 5000)
      }
      this.ws.onmessage = (event) => this.handleMessage(event.data)
      this.ws.onerror = (event) => {
        console.error('🚨 Deepgram WebSocket error (query token):', event)
        this.metrics.errorRate++
        onError(new Error('Deepgram WebSocket error'))
      }
      this.ws.onclose = (event) => {
        console.log('🎤 Deepgram connection closed (query token):', event.code, event.reason)
        if (this.keepAliveIntervalId) {
          clearInterval(this.keepAliveIntervalId)
          this.keepAliveIntervalId = null
        }
        if (event.code !== 1000) {
          let errorMessage = `Deepgram connection closed unexpectedly (code: ${event.code})`
          switch (event.code) {
            case 1006:
              errorMessage += '. This usually indicates a network issue, invalid API key, or server rejection.'
              break
            case 1002:
              errorMessage += '. Protocol error - check API key format and parameters.'
              break
            case 1003:
              errorMessage += '. Unsupported data type or encoding.'
              break
            case 1005:
              errorMessage += '. No status code was provided.'
              break
            default:
              if (event.reason) errorMessage += `: ${event.reason}`
          }
          onError(new Error(errorMessage))
        }
      }
      await this.waitForConnection()
    }
  }

  push(pcmData: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcmData)
      this.metrics.bytesProcessed += pcmData.byteLength
    }
  }

  async stop(): Promise<void> {
    if (this.ws) {
      // Send close frame to Deepgram
      this.ws.send(JSON.stringify({ type: 'CloseStream' }))
      
      // Close WebSocket connection
      this.ws.close(1000, 'Session ended')
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  getMetrics(): STTMetrics {
    return { ...this.metrics }
  }

  // Build WebSocket URL with optional token inclusion
  private buildWebSocketUrl(includeToken: boolean): string {
    const baseUrl = 'wss://api.deepgram.com/v1/listen'

    const params = new URLSearchParams({
      model: 'nova-2',
      encoding: 'linear16',
      sample_rate: '48000',
      channels: '1'
    })

    if (this.config.enableInterim) {
      params.set('interim_results', 'true')
    }

    // Make finalization less aggressive so we don't cut users off mid-thought
    if (typeof this.config.utteranceEndMs === 'number') {
      params.set('utterance_end_ms', String(this.config.utteranceEndMs))
    } else {
      // Default to a slightly longer pause tolerance
      params.set('utterance_end_ms', '2000')
    }

    if (includeToken && this.config.apiKey) {
      params.set('access_token', this.config.apiKey)
    }

    return `${baseUrl}?${params.toString()}`
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
      }, 5000)

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
      const response: DeepgramResponse = JSON.parse(data)
      
      if (!response.channel?.alternatives?.[0]) {
        return // Empty or invalid response
      }

      const alternative = response.channel.alternatives[0]
      const transcript = alternative.transcript.trim()
      
      if (!transcript) {
        return // Empty transcript
      }

      const now = Date.now()
      const latency = now - this.sessionStartTime

      // Track first interim latency
      if (!this.firstInterimReceived && !response.is_final) {
        this.metrics.firstInterimLatency = latency
        this.firstInterimReceived = true
      }

      // Convert Deepgram words to our format
      const words: Word[] = alternative.words?.map(word => ({
        text: word.punctuated_word || word.word,
        start: word.start,
        end: word.end,
        confidence: word.confidence
      })) || []

      const meta: TranscriptMeta = {
        confidence: alternative.confidence,
        words: words.length > 0 ? words : undefined,
        isFinal: response.is_final,
        latency,
        provider: 'deepgram'
      }

      if (response.is_final) {
        this.metrics.finalResultLatency = latency
        this.metrics.totalLatency = (this.metrics.totalLatency + latency) / 2 // rolling average
        this.onFinal?.(transcript, meta)
      } else {
        this.onInterim?.(transcript, meta)
      }

    } catch (error) {
      console.error('🚨 Error parsing Deepgram response:', error)
      this.metrics.errorRate++
      this.onError?.(new Error('Failed to parse STT response'))
    }
  }
}
