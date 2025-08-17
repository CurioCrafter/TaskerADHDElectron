import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = express.Router();

// Validation schemas
const AcceptProposalSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1).max(200),
    summary: z.string().max(1000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    dueAt: z.string().datetime().optional(),
    estimateMin: z.number().int().min(1).max(1440).optional(),
    labels: z.array(z.string()).optional(),
    subtasks: z.array(z.string()).optional(),
    columnId: z.string().cuid().optional() // Optional, will use first column if not provided
  }))
});

// GET /api/proposals/:id - Get proposal
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const proposal = await prisma.proposal.findFirst({
      where: {
        id,
        transcript: {
          userId // Ensure user owns the transcript
        }
      },
      include: {
        transcript: {
          select: {
            id: true,
            text: true,
            confidence: true,
            createdAt: true
          }
        }
      }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    res.json({ proposal });
  } catch (error) {
    console.error('Get proposal error:', error);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// POST /api/proposals/:id/accept - Accept proposal and create tasks
router.post('/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const { tasks } = AcceptProposalSchema.parse(req.body);

    // Get proposal and verify ownership
    const proposal = await prisma.proposal.findFirst({
      where: {
        id,
        transcript: {
          userId
        }
      },
      include: {
        transcript: true
      }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ error: 'Proposal has already been processed' });
    }

    // Get board from proposal context (assuming it's stored in the JSON)
    const proposalData = proposal.json as any;
    const boardId = proposalData.boardId;

    if (!boardId) {
      return res.status(400).json({ error: 'No board context found in proposal' });
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
      return res.status(403).json({ error: 'Access denied to board' });
    }

    // Get board with columns
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        columns: {
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Create tasks in a transaction
    const createdTasks = await prisma.$transaction(async (tx) => {
      const taskResults = [];

      for (const taskData of tasks) {
        // Determine target column
        let targetColumnId = taskData.columnId;
        if (!targetColumnId) {
          // Use first column (usually "Inbox")
          targetColumnId = board.columns[0]?.id;
        }

        if (!targetColumnId) {
          throw new Error('No valid column found for task');
        }

        // Get next position in column
        const lastTask = await tx.task.findFirst({
          where: { columnId: targetColumnId },
          orderBy: { position: 'desc' }
        });
        const position = (lastTask?.position ?? -1) + 1;

        // Create task
        const task = await tx.task.create({
          data: {
            title: taskData.title,
            summary: taskData.summary,
            priority: taskData.priority,
            energy: taskData.energy,
            dueAt: taskData.dueAt ? new Date(taskData.dueAt) : undefined,
            estimateMin: taskData.estimateMin,
            position,
            boardId,
            columnId: targetColumnId,
            createdById: userId,
            transcriptId: proposal.transcript.id,
            subtasks: taskData.subtasks ? {
              create: taskData.subtasks.map((title, idx) => ({
                title,
                position: idx
              }))
            } : undefined
          },
          include: {
            subtasks: {
              orderBy: {
                position: 'asc'
              }
            }
          }
        });

        // Handle labels
        if (taskData.labels && taskData.labels.length > 0) {
          for (const labelName of taskData.labels) {
            // Find or create label
            let label = await tx.label.findUnique({
              where: { name: labelName }
            });
            
            if (!label) {
              label = await tx.label.create({
                data: { name: labelName }
              });
            }

            // Link task to label
            await tx.taskLabel.create({
              data: {
                taskId: task.id,
                labelId: label.id
              }
            }).catch(() => {
              // Ignore duplicate key errors
            });
          }
        }

        taskResults.push(task);
      }

      // Mark proposal as accepted
      await tx.proposal.update({
        where: { id },
        data: { status: 'ACCEPTED' }
      });

      return taskResults;
    });

    // Fetch updated tasks with labels
    const tasksWithLabels = await Promise.all(
      createdTasks.map(task => 
        prisma.task.findUnique({
          where: { id: task.id },
          include: {
            labels: {
              include: {
                label: true
              }
            },
            subtasks: {
              orderBy: {
                position: 'asc'
              }
            }
          }
        })
      )
    );

    res.json({ 
      message: 'Proposal accepted and tasks created',
      tasks: tasksWithLabels,
      proposal: {
        ...proposal,
        status: 'ACCEPTED'
      }
    });
  } catch (error) {
    console.error('Accept proposal error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid task data',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to accept proposal' });
  }
});

// POST /api/proposals/:id/reject - Reject proposal
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Get proposal and verify ownership
    const proposal = await prisma.proposal.findFirst({
      where: {
        id,
        transcript: {
          userId
        }
      }
    });

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    if (proposal.status !== 'PENDING') {
      return res.status(400).json({ error: 'Proposal has already been processed' });
    }

    // Mark proposal as rejected
    const updatedProposal = await prisma.proposal.update({
      where: { id },
      data: { status: 'REJECTED' }
    });

    res.json({ 
      message: 'Proposal rejected',
      proposal: updatedProposal
    });
  } catch (error) {
    console.error('Reject proposal error:', error);
    res.status(500).json({ error: 'Failed to reject proposal' });
  }
});

// GET /api/proposals - Get user's proposals
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { 
      status,
      limit = 50, 
      offset = 0 
    } = req.query;

    const filters: any = {
      transcript: {
        userId
      }
    };

    if (status) {
      filters.status = status;
    }

    const proposals = await prisma.proposal.findMany({
      where: filters,
      include: {
        transcript: {
          select: {
            id: true,
            text: true,
            confidence: true,
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

    res.json({ proposals });
  } catch (error) {
    console.error('Get proposals error:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

export default router;
