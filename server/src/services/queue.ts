import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { getPrisma } from '../index';
import { shapeTranscriptWithAI } from './llm';

// Feature flag to disable Redis-backed queues (used when Redis is not available)
const disableRedis = process.env.DISABLE_REDIS === '1' || !process.env.REDIS_URL;

// Redis connection (optional)
let redis: IORedis | null = null;
if (!disableRedis) {
  redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableOfflineQueue: false
  });
}

// Job data interfaces
export interface ShapingJobData {
  transcriptId: string;
  boardId: string;
  userId: string;
}

// Create queues (optional)
export const shapingQueue: Queue<ShapingJobData> | null = !disableRedis && redis
  ? new Queue<ShapingJobData>('transcript-shaping', {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    })
  : null;

// Enqueue shaping job
export async function enqueueShaping(data: ShapingJobData): Promise<Job<ShapingJobData> | any> {
  if (!shapingQueue) {
    // Queues disabled: return a stub job; shaping can be triggered manually later if needed
    console.warn('enqueueShaping called but Redis/queues are disabled. Returning stub job.');
    return { id: 'queue-disabled', data };
  }
  return await shapingQueue.add('shape-transcript', data, {
    priority: 1,
    delay: 500 // Small delay to allow for final STT results
  });
}

// Worker for processing shaping jobs (optional)
const shapingWorker: Worker<ShapingJobData> | null = !disableRedis && redis
  ? new Worker<ShapingJobData>(
  'transcript-shaping',
  async (job: Job<ShapingJobData>) => {
    const { transcriptId, boardId, userId } = job.data;
    
    console.log(`🤖 Processing shaping job ${job.id} for transcript ${transcriptId}`);
    
    try {
      // Update job progress
      await job.updateProgress(10);

      // Fetch transcript
      const transcript = await getPrisma().transcript.findFirst({
        where: {
          id: transcriptId,
          userId
        }
      });

      if (!transcript) {
        throw new Error('Transcript not found');
      }

      if (!transcript.text || transcript.text.trim().length < 3) {
        throw new Error('Transcript text too short for processing');
      }

      await job.updateProgress(20);

      // Fetch board context
      const board = await getPrisma().board.findFirst({
        where: {
          id: boardId,
          members: {
            some: { userId }
          }
        },
        include: {
          columns: {
            orderBy: { position: 'asc' }
          }
        }
      });

      if (!board) {
        throw new Error('Board not found or access denied');
      }

      await job.updateProgress(30);

      // Fetch recent tasks for context
      const recentTasks = await getPrisma().task.findMany({
        where: {
          boardId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        },
        select: {
          title: true,
          labels: {
            include: {
              label: true
            }
          }
        },
        take: 20,
        orderBy: {
          createdAt: 'desc'
        }
      });

      await job.updateProgress(50);

      // Shape transcript with AI
      const shapedData = await shapeTranscriptWithAI({
        transcriptText: transcript.text,
        boardContext: {
          columns: board.columns.map(col => ({ id: col.id, name: col.name })),
          recentTasks: recentTasks.map(task => ({
            title: task.title,
            labels: task.labels.map(tl => tl.label.name)
          }))
        },
        userTimezone: 'UTC' // TODO: Get from user settings
      });

      await job.updateProgress(80);

      // Store proposal
      const proposal = await getPrisma().proposal.create({
        data: {
          transcriptId,
          json: {
            ...shapedData,
            boardId, // Include board context
            processedAt: new Date().toISOString(),
            confidence: transcript.confidence || 0.8
          },
          status: 'PENDING'
        }
      });

      await job.updateProgress(100);

      console.log(`✅ Shaping completed for transcript ${transcriptId}, proposal ${proposal.id}`);
      
      // Emit event to connected clients (via Socket.IO)
      const io = (global as any).socketIO;
      if (io) {
        io.to(userId).emit('proposal:ready', {
          proposalId: proposal.id,
          transcriptId,
          taskCount: shapedData.tasks?.length || 0
        });
      }

      return {
        proposalId: proposal.id,
        taskCount: shapedData.tasks?.length || 0
      };

    } catch (error) {
      console.error(`❌ Shaping failed for transcript ${transcriptId}:`, error);
      
      // Create failed proposal for tracking
      await getPrisma().proposal.create({
        data: {
          transcriptId,
          json: {
            error: error instanceof Error ? error.message : 'Unknown error',
            failedAt: new Date().toISOString()
          },
          status: 'REJECTED'
        }
      }).catch(dbError => {
        console.error('Failed to create error proposal:', dbError);
      });

      throw error;
    }
  },
  {
    connection: redis!,
    concurrency: 3, // Process up to 3 jobs simultaneously
    limiter: {
      max: 10, // Max 10 jobs per duration
      duration: 60000 // 1 minute
    }
  }
  )
  : null;

// Worker event handlers
if (shapingWorker) {
  shapingWorker.on('completed', (job) => {
    console.log(`✅ Shaping job ${job.id} completed successfully`);
  });

  shapingWorker.on('failed', (job, err) => {
    console.error(`❌ Shaping job ${job?.id} failed:`, err);
  });

  shapingWorker.on('stalled', (jobId) => {
    console.warn(`⚠️ Shaping job ${jobId} stalled`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (shapingWorker) {
    console.log('Shutting down queue workers...');
    await shapingWorker.close();
  }
  if (redis) {
    console.log('Closing Redis connection...');
    await redis.quit();
  }
});

process.on('SIGINT', async () => {
  if (shapingWorker) {
    console.log('Shutting down queue workers...');
    await shapingWorker.close();
  }
  if (redis) {
    console.log('Closing Redis connection...');
    await redis.quit();
  }
});

// Export for monitoring
export { shapingWorker, redis };
