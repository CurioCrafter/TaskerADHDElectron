import express from 'express';
import { z } from 'zod';
import { getPrisma } from '../index';
import { enqueueShaping } from '../services/queue';

const router = express.Router();

// Validation schemas
const ShapeTranscriptSchema = z.object({
  transcriptId: z.string().cuid(),
  boardId: z.string().cuid()
});

// POST /api/voice/transcripts/:id/shape - Enqueue transcript for AI shaping
router.post('/transcripts/:id/shape', async (req, res) => {
  try {
    const { id: transcriptId } = req.params;
    const { boardId } = ShapeTranscriptSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify transcript ownership
    const transcript = await getPrisma().transcript.findFirst({
      where: {
        id: transcriptId,
        userId: userId
      }
    });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    // Verify board access
    const boardMember = await getPrisma().boardMember.findFirst({
      where: {
        boardId,
        userId,
        role: {
          in: ['OWNER', 'EDITOR']
        }
      }
    });

    if (!boardMember) {
      return res.status(403).json({ error: 'Access denied to board' });
    }

    // Enqueue for AI processing
    const job = await enqueueShaping({
      transcriptId,
      boardId,
      userId
    });

    res.json({ 
      message: 'Transcript queued for shaping',
      jobId: job.id 
    });
  } catch (error) {
    console.error('Shape transcript error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to queue transcript for shaping' });
  }
});

// GET /api/voice/transcripts/:id - Get transcript
router.get('/transcripts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const transcript = await getPrisma().transcript.findFirst({
      where: {
        id,
        userId
      },
      include: {
        proposals: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    res.json({ transcript });
  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({ error: 'Failed to fetch transcript' });
  }
});

// GET /api/voice/transcripts - Get user's transcripts
router.get('/transcripts', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { limit = 50, offset = 0 } = req.query;

    const transcripts = await getPrisma().transcript.findMany({
      where: {
        userId
      },
      include: {
        proposals: {
          select: {
            id: true,
            status: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: Math.min(parseInt(limit as string), 100),
      skip: parseInt(offset as string)
    });

    res.json({ transcripts });
  } catch (error) {
    console.error('Get transcripts error:', error);
    res.status(500).json({ error: 'Failed to fetch transcripts' });
  }
});

// DELETE /api/voice/transcripts/:id - Delete transcript
router.delete('/transcripts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify ownership
    const transcript = await getPrisma().transcript.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    await getPrisma().transcript.delete({
      where: { id }
    });

    res.json({ message: 'Transcript deleted successfully' });
  } catch (error) {
    console.error('Delete transcript error:', error);
    res.status(500).json({ error: 'Failed to delete transcript' });
  }
});

export default router;
