export interface DeepgramConfig {
  apiKey: string
  model?: string
  language?: string
  smartFormat?: boolean
  punctuate?: boolean
  diarize?: boolean
  interimResults?: boolean
}

export interface TranscriptionResult {
  transcript: string
  confidence: number
  isFinal: boolean
  words?: Array<{
    word: string
    confidence: number
    start: number
    end: number
  }>
}

export class DeepgramAdapter {
  private config: DeepgramConfig
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private isRecording = false

  constructor(config: DeepgramConfig) {
    this.config = {
      model: 'nova-2',
      language: 'en-US',
      smartFormat: true,
      punctuate: true,
      diarize: true,
      interimResults: true,
      ...config
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      this.audioChunks = []
      this.isRecording = true
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      this.mediaRecorder.start(1000) // Collect data every second
      
    } catch (error) {
      console.error('Failed to start recording:', error)
      throw new Error('Failed to access microphone. Please check permissions.')
    }
  }

  /**
   * Stop recording and get audio data
   */
  stopRecording(): Blob {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error('Recording not started')
    }
    
    this.mediaRecorder.stop()
    this.isRecording = false
    
    // Stop all tracks
    this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    
    // Create final audio blob
    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
    this.audioChunks = []
    
    return audioBlob
  }

  /**
   * Transcribe audio blob
   */
  async transcribe(audioBlob: Blob): Promise<TranscriptionResult> {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      
      const queryParams = new URLSearchParams({
        model: this.config.model!,
        language: this.config.language!,
        smart_format: this.config.smartFormat!.toString(),
        punctuate: this.config.punctuate!.toString(),
        diarize: this.config.diarize!.toString(),
        interim_results: this.config.interimResults!.toString()
      })
      
      const response = await fetch(`https://api.deepgram.com/v1/listen?${queryParams}`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.config.apiKey}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Deepgram API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      
      // Extract the best result
      const result = data.results?.channels?.[0]?.alternatives?.[0]
      if (!result) {
        throw new Error('No transcription results received')
      }

      return {
        transcript: result.transcript || '',
        confidence: result.confidence || 0,
        isFinal: true,
        words: result.words?.map((word: any) => ({
          word: word.word,
          confidence: word.confidence,
          start: word.start,
          end: word.end
        }))
      }
      
    } catch (error) {
      console.error('Transcription failed:', error)
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Stream transcription with real-time results
   */
  async streamTranscription(
    onInterimResult: (result: TranscriptionResult) => void,
    onFinalResult: (result: TranscriptionResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Create WebSocket connection for real-time streaming
      // Note: Browser WebSocket API doesn't support headers, so we'll need to use URL params or handle auth differently
      const wsUrl = `wss://api.deepgram.com/v1/listen?token=${encodeURIComponent(this.config.apiKey)}`
      const ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        console.log('Deepgram WebSocket connected')
        
        // Start recording and streaming
        this.mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        })
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data)
          }
        }
        
        this.mediaRecorder.start(250) // Stream every 250ms for real-time feel
      }
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'Results') {
            const result = data.channel?.alternatives?.[0]
            if (result) {
              const transcriptionResult: TranscriptionResult = {
                transcript: result.transcript || '',
                confidence: result.confidence || 0,
                isFinal: result.is_final || false,
                words: result.words?.map((word: any) => ({
                  word: word.word,
                  confidence: word.confidence,
                  start: word.start,
                  end: word.end
                }))
              }
              
              if (transcriptionResult.isFinal) {
                onFinalResult(transcriptionResult)
              } else {
                onInterimResult(transcriptionResult)
              }
            }
          }
        } catch (parseError) {
          console.error('Failed to parse WebSocket message:', parseError)
        }
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError(new Error('WebSocket connection failed'))
      }
      
      ws.onclose = () => {
        console.log('Deepgram WebSocket closed')
        if (this.mediaRecorder) {
          this.mediaRecorder.stop()
        }
        stream.getTracks().forEach(track => track.stop())
      }
      
    } catch (error) {
      console.error('Streaming transcription failed:', error)
      onError(error instanceof Error ? error : new Error('Unknown error'))
    }
  }

  /**
   * Check if recording is active
   */
  isRecordingActive(): boolean {
    return this.isRecording
  }

  /**
   * Get recording status
   */
  getRecordingStatus(): 'idle' | 'recording' | 'processing' {
    if (this.isRecording) return 'recording'
    if (this.audioChunks.length > 0) return 'processing'
    return 'idle'
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop())
    }
    this.isRecording = false
    this.audioChunks = []
  }
}
