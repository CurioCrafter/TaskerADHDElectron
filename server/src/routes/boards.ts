import express from 'express';
import { z } from 'zod';
import { prisma } from '../index';

const router = express.Router();

// Validation schemas
const CreateBoardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.enum(['PERSONAL', 'PROJECT', 'TEAM', 'TEMPLATE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(),
  columns: z.array(z.string()).optional()
});

const UpdateBoardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  type: z.enum(['PERSONAL', 'PROJECT', 'TEAM', 'TEMPLATE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional()
});

const CreateColumnSchema = z.object({
  name: z.string().min(1).max(50),
  position: z.number().int().min(0).optional()
});

// GET /api/boards - Get user's boards
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.id;

    const boards = await prisma.board.findMany({
      where: {
        members: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true
              }
            }
          }
        },
        columns: {
          orderBy: {
            position: 'asc'
          },
          include: {
            tasks: {
              orderBy: {
                position: 'asc'
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
            }
          }
        },
        _count: {
          select: {
            columns: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json({ boards });
  } catch (error) {
    console.error('Get boards error:', error);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// GET /api/boards/:boardId - Get specific board
router.get('/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user!.id;

    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        members: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true
              }
            }
          }
        },
        columns: {
          orderBy: {
            position: 'asc'
          },
          include: {
            tasks: {
              orderBy: {
                position: 'asc'
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
            }
          }
        }
      }
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    res.json({ board });
  } catch (error) {
    console.error('Get board error:', error);
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

// POST /api/boards - Create new board
router.post('/', async (req, res) => {
  try {
    const validatedData = CreateBoardSchema.parse(req.body);
    const { 
      name, 
      description,
      type = 'PERSONAL',
      priority = 'MEDIUM',
      status = 'ACTIVE',
      dueDate,
      tags = [],
      metadata,
      columns = ['Inbox', 'To Do', 'Doing', 'Done']
    } = validatedData;
    
    const userId = req.user!.id;

    // Create columns data based on type
    const columnsData = columns.map((col: string, idx: number) => ({
      name: col,
      position: idx
    }));

    const board = await prisma.board.create({
      data: {
        name,
        description,
        type,
        priority,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags,
        metadata,
        ownerId: userId,
        columns: {
          create: columnsData
        },
        members: {
          create: {
            userId: userId,
            role: 'OWNER'
          }
        }
      },
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true
              }
            }
          }
        },
        columns: {
          orderBy: {
            position: 'asc'
          }
        }
      }
    });

    res.status(201).json({ board });
  } catch (error) {
    console.error('Create board error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid board data',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to create board' });
  }
});

// PATCH /api/boards/:boardId - Update board
router.patch('/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user!.id;
    const data = UpdateBoardSchema.parse(req.body);

    // Check if user has edit access
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
      return res.status(403).json({ error: 'Access denied' });
    }

    // Convert dueDate string to Date if provided
    const updateData = {
      ...data,
      ...(data.dueDate && { dueDate: new Date(data.dueDate) })
    };

    const board = await prisma.board.update({
      where: { id: boardId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true
              }
            }
          }
        }
      }
    });

    res.json({ board });
  } catch (error) {
    console.error('Update board error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid board data',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to update board' });
  }
});

// DELETE /api/boards/:boardId - Delete board
router.delete('/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    const userId = req.user!.id;

    // Check if user is owner
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        ownerId: userId
      }
    });

    if (!board) {
      return res.status(403).json({ error: 'Only board owners can delete boards' });
    }

    await prisma.board.delete({
      where: { id: boardId }
    });

    res.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error('Delete board error:', error);
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

// POST /api/boards/:boardId/columns - Create column
router.post('/:boardId/columns', async (req, res) => {
  try {
    const { boardId } = req.params;
    const { name, position } = CreateColumnSchema.parse(req.body);
    const userId = req.user!.id;

    // Check if user has edit access
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
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get next position if not provided
    let finalPosition = position;
    if (finalPosition === undefined) {
      const lastColumn = await prisma.column.findFirst({
        where: { boardId },
        orderBy: { position: 'desc' }
      });
      finalPosition = (lastColumn?.position ?? -1) + 1;
    }

    const column = await prisma.column.create({
      data: {
        name,
        boardId,
        position: finalPosition
      }
    });

    res.status(201).json({ column });
  } catch (error) {
    console.error('Create column error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid column data',
        details: error.errors 
      });
    }
    
    res.status(500).json({ error: 'Failed to create column' });
  }
});

export default router;
