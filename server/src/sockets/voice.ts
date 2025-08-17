import { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../index';
import { createSTTStream } from '../services/stt';
import { enqueueShaping } from '../services/queue';

interface VoiceSessionData {
  transcriptId?: string;
  boardId?: string;
  sttStream?: any;
  accumulatedText: string;
}

export function setupVoiceSocket(io: SocketIOServer) {
  const voiceNamespace = io.of('/voice');

  voiceNamespace.use(async (socket, next) => {
    // Auth middleware already applied in main server
    next();
  });

  voiceNamespace.on('connection', (socket) => {
    console.log(`🎤 Voice client connected: ${socket.id}`);
    
    const sessionData: VoiceSessionData = {
      accumulatedText: ''
    };

    // Voice session start
    socket.on('voice:start', async (data: { boardId: string }) => {
      try {
        const { boardId } = data;
        const userId = socket.data.userId;

        console.log(`🎙️ Voice session started for user ${userId}, board ${boardId}`);

        // Verify board access
        const boardMember = await prisma.boardMember.findFirst({
          where: {
            boardId,
            userId,
            role: {
              in: ['OWNER', 'EDITOR']
            }
          }
        });

        if (!boardMember) {
          socket.emit('voice:error', { error: 'Access denied to board' });
          return;
        }

        // Create transcript record
        const transcript = await prisma.transcript.create({
          data: {
            userId,
            text: '',
            confidence: 0
          }
        });

        sessionData.transcriptId = transcript.id;
        sessionData.boardId = boardId;
        sessionData.accumulatedText = '';

        // Create STT stream
        sessionData.sttStream = createSTTStream({
          onInterim: (text: string, confidence?: number) => {
            socket.emit('transcript:interim', { 
              text, 
              confidence,
              transcriptId: transcript.id 
            });
          },
          onFinal: async (text: string, confidence?: number) => {
            console.log(`📝 Final transcript: "${text}" (confidence: ${confidence})`);
            
            // Accumulate text
            sessionData.accumulatedText += (sessionData.accumulatedText ? ' ' : '') + text;

            // Update transcript in database
            await prisma.transcript.update({
              where: { id: transcript.id },
              data: { 
                text: sessionData.accumulatedText,
                confidence: confidence || 0.8
              }
            });

            socket.emit('transcript:final', { 
              text: sessionData.accumulatedText,
              confidence,
              transcriptId: transcript.id 
            });
          },
          onError: (error: string) => {
            console.error('STT Error:', error);
            socket.emit('voice:error', { error });
          }
        });

        socket.emit('voice:started', { 
          transcriptId: transcript.id,
          sessionId: socket.id 
        });

      } catch (error) {
        console.error('Voice start error:', error);
        socket.emit('voice:error', { error: 'Failed to start voice session' });
      }
    });

    // Audio chunk received
    socket.on('voice:chunk', (audioData: ArrayBuffer) => {
      if (sessionData.sttStream) {
        try {
          // Convert ArrayBuffer to Buffer and send to STT
          const buffer = Buffer.from(audioData);
          sessionData.sttStream.write(buffer);
        } catch (error) {
          console.error('Audio chunk processing error:', error);
          socket.emit('voice:error', { error: 'Audio processing failed' });
        }
      }
    });

    // Voice session stop
    socket.on('voice:stop', async () => {
      try {
        console.log(`🛑 Voice session stopped for ${socket.id}`);

        if (sessionData.sttStream) {
          sessionData.sttStream.end();
          sessionData.sttStream = undefined;
        }

        socket.emit('voice:stopped', { 
          transcriptId: sessionData.transcriptId,
          finalText: sessionData.accumulatedText
        });

        // Auto-trigger AI shaping if we have enough text
        if (sessionData.transcriptId && sessionData.boardId && sessionData.accumulatedText.length > 10) {
          console.log(`🤖 Auto-triggering AI shaping for transcript ${sessionData.transcriptId}`);
          
          try {
            const job = await enqueueShaping({
              transcriptId: sessionData.transcriptId,
              boardId: sessionData.boardId,
              userId: socket.data.userId
            });

            socket.emit('proposal:queued', { 
              jobId: job.id,
              transcriptId: sessionData.transcriptId
            });
          } catch (error) {
            console.error('Auto-shaping error:', error);
            socket.emit('voice:error', { error: 'Failed to process transcript with AI' });
          }
        }

      } catch (error) {
        console.error('Voice stop error:', error);
        socket.emit('voice:error', { error: 'Failed to stop voice session' });
      }
    });

    // Manual AI shaping request
    socket.on('proposal:shape', async (data: { transcriptId: string; boardId: string }) => {
      try {
        const { transcriptId, boardId } = data;
        const userId = socket.data.userId;

        // Verify transcript ownership
        const transcript = await prisma.transcript.findFirst({
          where: {
            id: transcriptId,
            userId
          }
        });

        if (!transcript) {
          socket.emit('voice:error', { error: 'Transcript not found' });
          return;
        }

        // Verify board access
        const boardMember = await prisma.boardMember.findFirst({
          where: {
            boardId,
            userId,
            role: {
              in: ['OWNER', 'EDITOR']
            }
          }
        });

        if (!boardMember) {
          socket.emit('voice:error', { error: 'Access denied to board' });
          return;
        }

        const job = await enqueueShaping({
          transcriptId,
          boardId,
          userId
        });

        socket.emit('proposal:queued', { 
          jobId: job.id,
          transcriptId 
        });

      } catch (error) {
        console.error('Manual shaping error:', error);
        socket.emit('voice:error', { error: 'Failed to process transcript with AI' });
      }
    });

    // Client disconnection
    socket.on('disconnect', () => {
      console.log(`👋 Voice client disconnected: ${socket.id}`);
      
      // Cleanup STT stream
      if (sessionData.sttStream) {
        try {
          sessionData.sttStream.end();
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
}
