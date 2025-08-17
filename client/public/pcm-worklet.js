// PCM Worklet for real-time audio processing
// Converts 32-bit float audio to 16-bit PCM for streaming to STT services

class PCMWriter extends AudioWorkletProcessor {
  constructor(options) {
    super(options);
    this.frameSize = options.processorOptions?.frameSize || 960; // 20ms at 48kHz
    this.buffer = [];
    this.sampleCount = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const channel = input[0]; // mono channel
    
    if (!channel || channel.length === 0) {
      return true; // Keep processor alive
    }

    // Convert 32-bit float [-1, 1] to 16-bit signed integer
    const pcmBuffer = new ArrayBuffer(channel.length * 2);
    const pcmView = new DataView(pcmBuffer);
    
    for (let i = 0; i < channel.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit
      const sample = Math.max(-1, Math.min(1, channel[i]));
      const pcmSample = Math.round(sample * 0x7FFF);
      pcmView.setInt16(i * 2, pcmSample, true); // little-endian
    }

    // Send PCM data to main thread
    this.port.postMessage({
      type: 'pcm',
      data: pcmBuffer,
      sampleRate: sampleRate,
      timestamp: currentTime
    }, [pcmBuffer]); // Transfer ownership

    this.sampleCount += channel.length;
    
    return true; // Keep processor alive
  }
}

// Register the processor
registerProcessor('pcm-writer', PCMWriter);
