import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = express.Router();
const DEBUG_API = process.env.NODE_ENV === 'development' || process.env.DEBUG_API === 'true'

function apiDebugLog(label: string, data?: any) {
  // Only log if DEBUG_API environment variable is set
  if (process.env.DEBUG_API !== 'true') return
  
  try {
    // Avoid logging secrets
    const safe = data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data
    console.log(`[API DEBUG] ${label}:`, safe)
  } catch {
    console.log(`[API DEBUG] ${label}`)
  }
}

// Helper function to transform task data for frontend
const transformTaskForResponse = (task: any) => {
  return {
    ...task,
    repeatDays: task.repeatDays ? JSON.parse(task.repeatDays) : undefined
  };
};

// Validation schemas
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(1000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueAt: z.string().datetime().optional(),
  estimateMin: z.number().int().min(1).max(1440).optional(), // Max 24 hours
  columnId: z.string().cuid(),
  labels: z.array(z.string()).optional(),
  subtasks: z.array(z.string()).optional(),
  transcriptId: z.string().cuid().optional(),
  // Repeat fields
  isRepeatable: z.boolean().optional(),
  repeatPattern: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional(),
  repeatInterval: z.number().int().min(1).max(365).optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).optional(),
  repeatEndDate: z.string().datetime().optional(),
  repeatCount: z.number().int().min(1).max(1000).optional()
});

const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(1000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueAt: z.string().datetime().optional(),
  estimateMin: z.number().int().min(1).max(1440).optional(),
  labels: z.array(z.string()).optional(),
  // Repeat fields
  isRepeatable: z.boolean().optional(),
  repeatPattern: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional(),
  repeatInterval: z.number().int().min(1).max(365).optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).optional(),
  repeatEndDate: z.string().datetime().optional(),
  repeatCount: z.number().int().min(1).max(1000).optional()
});

const MoveTaskSchema = z.object({
  columnId: z.string().cuid(),
  position: z.number().int().min(0)
});

const CreateSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
  position: z.number().int().min(0).optional()
});

const UpdateSubtaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  done: z.boolean().optional(),
  position: z.number().int().min(0).optional()
});

// Helper function to check board access
async function checkBoardAccess(userId: string, boardId: string, requiredRole: string[] = ['OWNER', 'EDITOR', 'VIEWER']) {
  const boardMember = await prisma.boardMember.findFirst({
    where: {
      boardId,
      userId,
      role: {
        in: requiredRole as any[]
      }
    }
  });
  return !!boardMember;
}

// GET /api/tasks - Get tasks with filters
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      boardId,
      energy,
      priority,
      dueDate,
      today,
      quickWins
    } = req.query;

    if (!boardId) {
      return res.status(400).json({ error: 'boardId is required' });
    }

    // Check access
    const hasAccess = await checkBoardAccess(userId, boardId as string);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build filters
    const filters: any = {
      boardId: boardId as string
    };

    if (energy) {
      filters.energy = energy;
    }

    if (priority) {
      filters.priority = priority;
    }

    if (dueDate) {
      const date = new Date(dueDate as string);
      filters.dueAt = {
        gte: new Date(date.setHours(0, 0, 0, 0)),
        lt: new Date(date.setHours(23, 59, 59, 999))
      };
    }

    if (today === 'true') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      
      filters.OR = [
        { dueAt: { gte: todayStart, lte: todayEnd } },
        { priority: 'URGENT' },
        { 
          column: { 
            name: { in: ['Doing', 'To Do'] }
          }
        }
      ];
    }

    if (quickWins === 'true') {
      filters.AND = [
        { energy: 'LOW' },
        { estimateMin: { lte: 30 } }
      ];
    }

    const tasks = await prisma.task.findMany({
      where: filters,
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
      },
      orderBy: [
        { priority: 'desc' },
        { dueAt: 'asc' },
        { position: 'asc' }
      ]
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks - Create task
router.post('/', async (req, res) => {
  try {
    apiDebugLog('POST /api/tasks incoming body', req.body)
    const data = CreateTaskSchema.parse(req.body);
    const userId = req.user!.id;
    apiDebugLog('POST /api/tasks user', { userId })

    // Get column to verify board access
    const column = await prisma.column.findUnique({
      where: { id: data.columnId },
      include: { board: true }
    });

    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    // Check access
    const hasAccess = await checkBoardAccess(userId, column.boardId, ['OWNER', 'EDITOR']);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get next position in column
    const lastTask = await prisma.task.findFirst({
      where: { columnId: data.columnId },
      orderBy: { position: 'desc' }
    });
    const position = (lastTask?.position ?? -1) + 1;

    // Create task
    const task = await prisma.task.create({
      data: {
        title: data.title,
        summary: data.summary,
        priority: data.priority,
        energy: data.energy,
        dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
        estimateMin: data.estimateMin,
        position,
        boardId: column.boardId,
        columnId: data.columnId,
        createdById: userId,
        transcriptId: data.transcriptId,
        // Repeat fields
        isRepeatable: data.isRepeatable || false,
        repeatPattern: data.repeatPattern,
        repeatInterval: data.repeatInterval,
        repeatDays: data.repeatDays ? JSON.stringify(data.repeatDays) : undefined,
        repeatEndDate: data.repeatEndDate ? new Date(data.repeatEndDate) : undefined,
        repeatCount: data.repeatCount,
        subtasks: data.subtasks ? {
          create: data.subtasks.map((title, idx) => ({
            title,
            position: idx
          }))
        } : undefined
      },
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
    });
    apiDebugLog('POST /api/tasks created task', { id: task.id, title: task.title })

    // Handle labels if provided
    if (data.labels && data.labels.length > 0) {
      for (const labelName of data.labels) {
        // Find or create label
        let label = await prisma.label.findUnique({
          where: { name: labelName }
        });
        
        if (!label) {
          label = await prisma.label.create({
            data: { name: labelName }
          });
        }

        // Link task to label
        await prisma.taskLabel.create({
          data: {
            taskId: task.id,
            labelId: label.id
          }
        }).catch(() => {
          // Ignore duplicate key errors
        });
      }

      // Fetch updated task with labels
      const updatedTask = await prisma.task.findUnique({
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
      });

      return res.status(201).json({ task: transformTaskForResponse(updatedTask) });
    }

    res.status(201).json({ task: transformTaskForResponse(task) });
  } catch (error) {
    console.error('Create task error:', error);
    apiDebugLog('POST /api/tasks error', { message: (error as any)?.message, stack: (error as any)?.stack })
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid task data',
        details: error.errors 
      });
    }
    res.status(500).json({ error: 'Failed to create task', details: (error as any)?.message });
  }
});

// PATCH /api/tasks/:taskId - Update task
router.patch('/:taskId', async (req, res) => {
  try {
    apiDebugLog('PATCH /api/tasks/:taskId incoming', { params: req.params, body: req.body })
    const { taskId } = req.params;
    const data = UpdateTaskSchema.parse(req.body);
    const userId = req.user!.id;

    // Get task to verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { column: { include: { board: true } } }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check access
    const hasAccess = await checkBoardAccess(userId, task.column.board.id, ['OWNER', 'EDITOR']);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Extract labels from data to handle separately
    const { labels, repeatDays, ...updateData } = data;
    
    // Update task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...updateData,
        dueAt: updateData.dueAt ? new Date(updateData.dueAt) : undefined,
        repeatEndDate: updateData.repeatEndDate ? new Date(updateData.repeatEndDate) : undefined,
        repeatDays: repeatDays ? JSON.stringify(repeatDays) : undefined
      },
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
    });
    apiDebugLog('PATCH /api/tasks/:taskId updated', { id: updatedTask.id })

    // Handle labels update
    if (data.labels !== undefined) {
      // Remove existing labels
      await prisma.taskLabel.deleteMany({
        where: { taskId }
      });

      // Add new labels
      for (const labelName of data.labels) {
        let label = await prisma.label.findUnique({
          where: { name: labelName }
        });
        
        if (!label) {
          label = await prisma.label.create({
            data: { name: labelName }
          });
        }

        await prisma.taskLabel.create({
          data: {
            taskId,
            labelId: label.id
          }
        }).catch(() => {
          // Ignore duplicate key errors
        });
      }

      // Fetch updated task with new labels
      const finalTask = await prisma.task.findUnique({
        where: { id: taskId },
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
      });

      return res.json({ task: transformTaskForResponse(finalTask) });
    }

    res.json({ task: transformTaskForResponse(updatedTask) });
  } catch (error) {
    console.error('Update task error:', error);
    apiDebugLog('PATCH /api/tasks/:taskId error', { message: (error as any)?.message, stack: (error as any)?.stack })
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid task data',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to update task', details: (error as any)?.message });
  }
});

// POST /api/tasks/:taskId/move - Move task to different column/position
router.post('/:taskId/move', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { columnId, position } = MoveTaskSchema.parse(req.body);
    const userId = req.user!.id;

    // Get task and verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { column: { include: { board: true } } }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check access
    const hasAccess = await checkBoardAccess(userId, task.column.board.id, ['OWNER', 'EDITOR']);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify target column exists and is in same board
    const targetColumn = await prisma.column.findUnique({
      where: { id: columnId }
    });

    if (!targetColumn || targetColumn.boardId !== task.column.board.id) {
      return res.status(400).json({ error: 'Invalid target column' });
    }

    // Update task position and column
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        columnId,
        position
      },
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
    });

    res.json({ task: updatedTask });
  } catch (error) {
    console.error('Move task error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid move data',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to move task' });
  }
});

// DELETE /api/tasks/:taskId - Delete task
router.delete('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user!.id;

    // Get task to verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { column: { include: { board: true } } }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Check access
    const hasAccess = await checkBoardAccess(userId, task.column.board.id, ['OWNER', 'EDITOR']);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.task.delete({
      where: { id: taskId }
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Subtask routes

// POST /api/tasks/:taskId/subtasks - Create subtask
router.post('/:taskId/subtasks', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, position } = CreateSubtaskSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify task access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { column: { include: { board: true } } }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const hasAccess = await checkBoardAccess(userId, task.column.board.id, ['OWNER', 'EDITOR']);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const lastSubtask = await prisma.subtask.findFirst({
        where: { taskId },
        orderBy: { position: 'desc' }
      });
      finalPosition = (lastSubtask?.position ?? -1) + 1;
    }

    const subtask = await prisma.subtask.create({
      data: {
        title,
        taskId,
        position: finalPosition
      }
    });

    res.status(201).json({ subtask });
  } catch (error) {
    console.error('Create subtask error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid subtask data',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to create subtask' });
  }
});

// PATCH /api/tasks/:taskId/subtasks/:subtaskId - Update subtask
router.patch('/:taskId/subtasks/:subtaskId', async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const data = UpdateSubtaskSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { column: { include: { board: true } } }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const hasAccess = await checkBoardAccess(userId, task.column.board.id, ['OWNER', 'EDITOR']);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const subtask = await prisma.subtask.update({
      where: { 
        id: subtaskId,
        taskId // Ensure subtask belongs to this task
      },
      data
    });

    res.json({ subtask });
  } catch (error) {
    console.error('Update subtask error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid subtask data',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to update subtask' });
  }
});

// DELETE /api/tasks/:taskId/subtasks/:subtaskId - Delete subtask
router.delete('/:taskId/subtasks/:subtaskId', async (req, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const userId = req.user!.id;

    // Verify access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { column: { include: { board: true } } }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const hasAccess = await checkBoardAccess(userId, task.column.board.id, ['OWNER', 'EDITOR']);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.subtask.delete({
      where: { 
        id: subtaskId,
        taskId // Ensure subtask belongs to this task
      }
    });

    res.json({ message: 'Subtask deleted successfully' });
  } catch (error) {
    console.error('Delete subtask error:', error);
    res.status(500).json({ error: 'Failed to delete subtask' });
  }
});

export default router;
