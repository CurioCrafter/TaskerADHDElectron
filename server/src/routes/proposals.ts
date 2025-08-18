import express from 'express';
import { z } from 'zod';
import { getPrisma } from '../index';

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

    const proposal = await getPrisma().proposal.findFirst({
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
    const proposal = await getPrisma().proposal.findFirst({
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

    // Get board with columns
    const board = await getPrisma().board.findUnique({
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

    console.log(`📋 Processing ${tasks.length} tasks for proposal ${id}`);
    console.log('📋 Available columns:', board.columns.map(c => ({ id: c.id, name: c.name })));
    
    // Create tasks in a transaction
    const createdTasks = await getPrisma().$transaction(async (tx) => {
      const taskResults = [];

      for (const [index, taskData] of tasks.entries()) {
        console.log(`📋 Processing task ${index + 1}:`, { 
          title: taskData.title, 
          columnName: (taskData as any).columnName,
          priority: taskData.priority 
        });
        
        // Determine target column by name (AI-suggested) or fallback to first column
        let targetColumnId: string | undefined;
        const suggestedColumnName = (taskData as any).columnName;
        
        if (suggestedColumnName) {
          const targetColumn = board.columns.find(col => 
            col.name.toLowerCase() === suggestedColumnName.toLowerCase()
          );
          if (targetColumn) {
            targetColumnId = targetColumn.id;
            console.log(`📋 ✅ Found column "${suggestedColumnName}" with ID ${targetColumnId}`);
          } else {
            console.log(`📋 ⚠️ Column "${suggestedColumnName}" not found, using fallback`);
          }
        }
        
        // Fallback to first column if no match found
        if (!targetColumnId) {
          targetColumnId = board.columns[0]?.id;
          console.log(`📋 Using fallback column: ${board.columns[0]?.name} (${targetColumnId})`);
        }

        if (!targetColumnId) {
          throw new Error(`No valid column found for task "${taskData.title}"`);
        }

        // Get next position in column
        const lastTask = await tx.task.findFirst({
          where: { columnId: targetColumnId },
          orderBy: { position: 'desc' }
        });
        const position = (lastTask?.position ?? -1) + 1;

        // Prepare task data with calendar integration
        const taskCreateData = {
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
        };

        console.log(`📋 Creating task in column ${targetColumnId}:`, {
          title: taskCreateData.title,
          columnId: taskCreateData.columnId,
          boardId: taskCreateData.boardId,
          dueAt: taskCreateData.dueAt
        });

        // Create task
        const task = await tx.task.create({
          data: taskCreateData,
          include: {
            subtasks: {
              orderBy: {
                position: 'asc'
              }
            },
            column: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        console.log(`📋 ✅ Task created successfully:`, { 
          id: task.id, 
          title: task.title, 
          columnName: task.column.name 
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

    console.log(`📋 ✅ Transaction completed. Created ${createdTasks.length} tasks successfully!`);

    // Fetch updated tasks with labels and column information
    const tasksWithLabels = await Promise.all(
      createdTasks.map(task => 
        getPrisma().task.findUnique({
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
            },
            column: {
              select: {
                id: true,
                name: true
              }
            }
          }
        })
      )
    );

    // Log final task placement for debugging
    tasksWithLabels.forEach((task, index) => {
      console.log(`📋 Final task ${index + 1}: "${task?.title}" → Column: ${task?.column.name}`);
    });

    res.json({ 
      message: `Proposal accepted and ${createdTasks.length} tasks created successfully!`,
      tasks: tasksWithLabels,
      proposal: {
        ...proposal,
        status: 'ACCEPTED'
      },
      debug: {
        totalTasks: createdTasks.length,
        columnPlacements: tasksWithLabels.map(task => ({
          title: task?.title,
          column: task?.column.name
        }))
      }
    });
  } catch (error) {
    console.error('📋 ❌ Accept proposal error:', error);
    
    // Enhanced error logging for debugging
    if (error instanceof Error) {
      console.error('📋 Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 5).join('\n')
      });
    }
    
    if (error instanceof z.ZodError) {
      console.error('📋 Validation error details:', error.errors);
      return res.status(400).json({ 
        error: 'Invalid task data',
        details: error.errors,
        debug: 'Check console for detailed validation errors'
      });
    }
    
    // Check for database constraint errors
    if (error instanceof Error) {
      if (error.message.includes('Column not found') || error.message.includes('columnId')) {
        return res.status(400).json({ 
          error: 'Column assignment error',
          message: error.message,
          debug: 'The AI tried to assign tasks to columns that don\'t exist on this board. Check console logs for details.'
        });
      }
      
      if (error.message.includes('foreign key constraint')) {
        return res.status(400).json({ 
          error: 'Database constraint error',
          message: 'Invalid board or column reference',
          debug: error.message
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to accept proposal',
      message: error instanceof Error ? error.message : 'Unknown error',
      debug: 'Check server console for detailed error information'
    });
  }
});

// POST /api/proposals/:id/reject - Reject proposal
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Get proposal and verify ownership
    const proposal = await getPrisma().proposal.findFirst({
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
    const updatedProposal = await getPrisma().proposal.update({
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

    const proposals = await getPrisma().proposal.findMany({
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
