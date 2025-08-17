// Voice Capture Service - Handles microphone access, audio processing, and level monitoring

export interface VoiceCaptureConfig {
  sampleRate: number
  channelCount: number
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  frameSize: number // Audio worklet frame size
}

export interface AudioLevelData {
  rms: number      // Root Mean Square level (0-1)
  peak: number     // Peak level (0-1)
  timestamp: number
}

export type AudioDataCallback = (pcmData: ArrayBuffer) => void
export type AudioLevelCallback = (levelData: AudioLevelData) => void
export type AudioErrorCallback = (error: Error) => void

export class VoiceCaptureService {
  private mediaStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private analyserNode: AnalyserNode | null = null
  private workletNode: AudioWorkletNode | null = null
  private gainNode: GainNode | null = null
  
  private config: VoiceCaptureConfig
  private isCapturing = false
  private animationFrameId: number | null = null
  
  // Callbacks
  private onAudioData: AudioDataCallback | null = null
  private onAudioLevel: AudioLevelCallback | null = null
  private onError: AudioErrorCallback | null = null

  constructor(config: Partial<VoiceCaptureConfig> = {}) {
    this.config = {
      sampleRate: 48000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      frameSize: 960, // 20ms at 48kHz
      ...config
    }
  }

  async initialize(): Promise<void> {
    try {
      // Request microphone permission with optimal settings
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.channelCount,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
          sampleRate: this.config.sampleRate
        },
        video: false
      })

      // Create audio context with optimal settings
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: 'interactive' // Optimize for low latency
      })

      // Create audio processing chain
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
      
      // Analyser for level monitoring
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 1024
      this.analyserNode.smoothingTimeConstant = 0.3
      
      // Gain node for volume control
      this.gainNode = this.audioContext.createGain()
      this.gainNode.gain.value = 1.0

      // Load PCM worklet
      await this.loadPCMWorklet()

      // Connect audio graph: source -> gain -> analyser -> worklet
      this.sourceNode.connect(this.gainNode)
      this.gainNode.connect(this.analyserNode)
      this.analyserNode.connect(this.workletNode!)

      console.log('🎤 Voice capture service initialized')
      console.log('📊 Audio context state:', this.audioContext.state)
      console.log('🔧 Configuration:', this.config)

    } catch (error) {
      console.error('🚨 Failed to initialize voice capture:', error)
      this.cleanup()
      throw new Error(`Voice capture initialization failed: ${error}`)
    }
  }

  async start(
    onAudioData: AudioDataCallback,
    onAudioLevel: AudioLevelCallback,
    onError: AudioErrorCallback
  ): Promise<void> {
    if (!this.audioContext || !this.workletNode || !this.analyserNode) {
      throw new Error('Voice capture not initialized')
    }

    if (this.isCapturing) {
      throw new Error('Voice capture already active')
    }

    this.onAudioData = onAudioData
    this.onAudioLevel = onAudioLevel
    this.onError = onError

    try {
      // Resume audio context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      // Set up worklet message handling
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'pcm') {
          this.onAudioData?.(event.data.data)
        }
      }

      // Start audio level monitoring
      this.startLevelMonitoring()
      
      this.isCapturing = true
      console.log('🎤 Voice capture started')

    } catch (error) {
      console.error('🚨 Failed to start voice capture:', error)
      this.onError?.(new Error(`Failed to start capture: ${error}`))
    }
  }

  stop(): void {
    if (!this.isCapturing) {
      return
    }

    // Stop level monitoring
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }

    // Clear worklet message handler
    if (this.workletNode) {
      this.workletNode.port.onmessage = null
    }

    this.isCapturing = false
    console.log('🎤 Voice capture stopped')
  }

  destroy(): void {
    this.stop()
    this.cleanup()
  }

  isActive(): boolean {
    return this.isCapturing
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext
  }

  // Adjust input gain (useful for very quiet/loud microphones)
  setGain(gain: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(2, gain)) // Clamp 0-2
    }
  }

  private async loadPCMWorklet(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('Audio context not available')
    }

    try {
      // Load the PCM worklet processor
      await this.audioContext.audioWorklet.addModule('/pcm-worklet.js')
      
      // Create worklet node
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-writer', {
        processorOptions: {
          frameSize: this.config.frameSize
        }
      })

    } catch (error) {
      console.error('🚨 Failed to load PCM worklet:', error)
      throw new Error(`PCM worklet loading failed: ${error}`)
    }
  }

  private startLevelMonitoring(): void {
    if (!this.analyserNode) return

    const bufferLength = this.analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const timeDataArray = new Uint8Array(bufferLength)

    const updateLevels = () => {
      if (!this.isCapturing || !this.analyserNode) return

      // Get frequency data for RMS calculation
      this.analyserNode.getByteFrequencyData(dataArray)
      
      // Get time domain data for peak calculation  
      this.analyserNode.getByteTimeDomainData(timeDataArray)

      // Calculate RMS level
      let rmsSum = 0
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = dataArray[i] / 255.0
        rmsSum += normalized * normalized
      }
      const rms = Math.sqrt(rmsSum / dataArray.length)

      // Calculate peak level
      let peak = 0
      for (let i = 0; i < timeDataArray.length; i++) {
        const sample = Math.abs(timeDataArray[i] - 128) / 128.0
        peak = Math.max(peak, sample)
      }

      // Send level data
      this.onAudioLevel?.({
        rms,
        peak,
        timestamp: Date.now()
      })

      this.animationFrameId = requestAnimationFrame(updateLevels)
    }

    updateLevels()
  }

  private cleanup(): void {
    // Stop any ongoing capture
    this.stop()

    // Disconnect and clean up audio nodes
    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect()
      this.analyserNode = null
    }

    if (this.gainNode) {
      this.gainNode.disconnect()
      this.gainNode = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    // Clear callbacks
    this.onAudioData = null
    this.onAudioLevel = null
    this.onError = null

    console.log('🎤 Voice capture service cleaned up')
  }
}
