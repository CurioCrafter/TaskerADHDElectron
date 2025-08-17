// STT (Speech-to-Text) interfaces and types

export interface Word {
  text: string
  start?: number // start time in seconds
  end?: number   // end time in seconds  
  confidence?: number // 0-1 confidence score
}

export interface TranscriptMeta {
  confidence?: number // overall utterance confidence
  words?: Word[]      // word-level breakdown
  isFinal?: boolean   // true for final results
  latency?: number    // processing latency in ms
  provider?: string   // which STT service provided this
}

export type InterimCallback = (text: string, meta: TranscriptMeta) => void
export type FinalCallback = (text: string, meta: TranscriptMeta) => void
export type ErrorCallback = (error: Error) => void

export interface STTAdapter {
  readonly name: string
  readonly supportsInterim: boolean
  readonly supportsConfidence: boolean
  readonly supportsWordTimestamps: boolean
  
  // Start streaming STT
  start(
    sessionId: string,
    onInterim: InterimCallback,
    onFinal: FinalCallback,
    onError: ErrorCallback
  ): Promise<void>
  
  // Send audio data (for WebSocket-based providers)
  push(pcmData: ArrayBuffer): void
  
  // Stop streaming
  stop(): Promise<void>
  
  // Get current status
  isConnected(): boolean
  
  // Get performance metrics
  getMetrics(): STTMetrics
}

export interface STTMetrics {
  totalLatency: number     // average end-to-end latency
  firstInterimLatency: number // time to first interim result
  finalResultLatency: number  // time to final result
  bytesProcessed: number
  sessionsCount: number
  errorRate: number
}

export interface STTConfig {
  provider: 'deepgram' | 'openai' | 'google' | 'azure' | 'aws' | 'whisper-local'
  apiKey?: string
  model?: string
  language?: string
  enableInterim: boolean
  enableConfidence: boolean
  enableWordTimestamps: boolean
  sampleRate: number
  encoding: 'pcm16' | 'opus' | 'webm'
  // Controls how quickly the provider finalizes an utterance (ms of silence)
  utteranceEndMs?: number
}

export interface TranscriptChunk {
  id: string
  text: string
  startTime: number
  endTime: number
  confidence?: number
  words?: Word[]
  isFinal: boolean
  provider: string
  sessionId: string
  createdAt: Date
}

export interface AudioSession {
  id: string
  userId: string
  startTime: Date
  endTime?: Date
  totalDuration: number
  transcriptChunks: TranscriptChunk[]
  config: STTConfig
  metrics: STTMetrics
}
