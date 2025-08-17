import { Writable } from 'stream';

// STT Provider interface
export interface STTProvider {
  createStream(options: STTStreamOptions): STTStream;
}

export interface STTStreamOptions {
  onInterim: (text: string, confidence?: number) => void;
  onFinal: (text: string, confidence?: number) => void;
  onError: (error: string) => void;
  language?: string;
  sampleRate?: number;
}

export interface STTStream extends Writable {
  // Additional methods if needed
}

// Mock STT Provider for development
class MockSTTProvider implements STTProvider {
  createStream(options: STTStreamOptions): STTStream {
    return new MockSTTStream(options);
  }
}

class MockSTTStream extends Writable implements STTStream {
  private options: STTStreamOptions;
  private buffer: Buffer[] = [];
  private isProcessing = false;
  
  // Mock phrases for demonstration
  private mockPhrases = [
    "Remember to call Sam about the invoice",
    "Buy AC filter 14x20x1", 
    "Write 2-page syllabus summary by Friday morning",
    "Schedule 25 minutes to clean the inbox",
    "Email Dr Patel about letter of recommendation",
    "Update project timeline and send to team",
    "Review budget proposal and provide feedback",
    "Book dentist appointment for next week",
    "Prepare presentation for client meeting",
    "Order office supplies from vendor",
    "Fix bug in authentication module",
    "Call mom about weekend plans"
  ];

  constructor(options: STTStreamOptions) {
    super();
    this.options = options;
  }

  _write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.buffer.push(chunk);
    
    if (!this.isProcessing) {
      this.isProcessing = true;
      this.processAudio();
    }
    
    callback();
  }

  private async processAudio() {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (this.buffer.length === 0) {
      this.isProcessing = false;
      return;
    }

    // Clear buffer for this processing cycle
    this.buffer = [];

    // Simulate interim results
    const randomPhrase = this.mockPhrases[Math.floor(Math.random() * this.mockPhrases.length)];
    const words = randomPhrase.split(' ');
    
    // Send interim results word by word
    for (let i = 1; i <= words.length; i++) {
      const partialText = words.slice(0, i).join(' ');
      const confidence = 0.6 + (i / words.length) * 0.3; // Increasing confidence
      
      this.options.onInterim(partialText, confidence);
      
      // Small delay between words
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Send final result
    this.options.onFinal(randomPhrase, 0.95);
    
    this.isProcessing = false;
  }

  _final(callback: (error?: Error | null) => void) {
    // Process any remaining buffer
    if (this.buffer.length > 0) {
      this.processAudio().then(() => callback()).catch(callback);
    } else {
      callback();
    }
  }
}

// OpenAI Whisper Provider (for production)
class OpenAISTTProvider implements STTProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  createStream(options: STTStreamOptions): STTStream {
    return new OpenAISTTStream(this.apiKey, options);
  }
}

class OpenAISTTStream extends Writable implements STTStream {
  private apiKey: string;
  private options: STTStreamOptions;
  private audioBuffer: Buffer[] = [];
  private processingTimeout?: NodeJS.Timeout;

  constructor(apiKey: string, options: STTStreamOptions) {
    super();
    this.apiKey = apiKey;
    this.options = options;
  }

  _write(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.audioBuffer.push(chunk);
    
    // Debounce processing to avoid too many API calls
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
    
    this.processingTimeout = setTimeout(() => {
      this.processWithOpenAI();
    }, 1000); // Process every 1 second of accumulated audio
    
    callback();
  }

  private async processWithOpenAI() {
    if (this.audioBuffer.length === 0) return;

    try {
      // Combine all audio chunks
      const audioData = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];

      // Create form data for OpenAI API
      const formData = new FormData();
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.text) {
        // OpenAI Whisper doesn't provide interim results, so we send final immediately
        this.options.onFinal(result.text.trim(), 0.9);
      }

    } catch (error) {
      console.error('OpenAI STT error:', error);
      this.options.onError(`Speech recognition failed: ${error}`);
    }
  }

  _final(callback: (error?: Error | null) => void) {
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
    }
    
    // Process any remaining audio
    if (this.audioBuffer.length > 0) {
      this.processWithOpenAI().then(() => callback()).catch(callback);
    } else {
      callback();
    }
  }
}

// Factory function to create STT provider
function createSTTProvider(): STTProvider {
  const provider = process.env.STT_PROVIDER || 'mock';
  
  switch (provider) {
    case 'openai':
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn('OpenAI API key not found, falling back to mock STT');
        return new MockSTTProvider();
      }
      return new OpenAISTTProvider(apiKey);
    
    case 'mock':
    default:
      return new MockSTTProvider();
  }
}

// Export the main function to create STT streams
export function createSTTStream(options: STTStreamOptions): STTStream {
  const provider = createSTTProvider();
  return provider.createStream(options);
}
