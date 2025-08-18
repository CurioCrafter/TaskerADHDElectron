import express from 'express';
import { z } from 'zod';
import { getPrisma } from '../index';
import { 
  tasksToCalendarEvents, 
  generateICalendar, 
  scheduleTasksOptimally,
  defaultSchedulingPreferences,
  type SchedulingPreferences 
} from '../utils/calendar';

const router = express.Router();

// Validation schemas
const SchedulingPreferencesSchema = z.object({
  workingHours: z.object({
    start: z.number().min(0).max(23),
    end: z.number().min(0).max(23)
  }),
  energyPeaks: z.array(z.number().min(0).max(23)),
  breakDuration: z.number().min(5).max(60),
  maxTasksPerDay: z.number().min(1).max(20),
  bufferTime: z.number().min(0).max(30)
});

// GET /api/calendar/events - Get calendar events for tasks
router.get('/events', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { boardId, startDate, endDate, timezone = 'UTC' } = req.query;

    console.log('📅 Calendar events request:', { userId, boardId, startDate, endDate, timezone });

    // Build task query
    const where: any = {
      boardId: boardId as string,
      board: {
        members: {
          some: { userId }
        }
      }
    };

    // Add date filtering if provided
    if (startDate || endDate) {
      where.OR = [
        {
          dueAt: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined
          }
        },
        {
          createdAt: {
            gte: startDate ? new Date(startDate as string) : undefined,
            lte: endDate ? new Date(endDate as string) : undefined
          }
        }
      ];
    }

    // Fetch tasks
    const tasks = await getPrisma().task.findMany({
      where,
      include: {
        column: {
          select: { name: true }
        },
        labels: {
          include: {
            label: true
          }
        }
      },
      orderBy: [
        { dueAt: 'asc' },
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    console.log(`📅 Found ${tasks.length} tasks for calendar`);

    // Convert to calendar events
    const events = tasksToCalendarEvents(tasks, timezone as string);

    console.log(`📅 Generated ${events.length} calendar events`);

    res.json({
      events,
      meta: {
        totalTasks: tasks.length,
        totalEvents: events.length,
        timezone: timezone as string,
        dateRange: {
          start: startDate || null,
          end: endDate || null
        }
      }
    });

  } catch (error) {
    console.error('📅 ❌ Calendar events error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch calendar events',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/calendar/export/:boardId - Export board tasks as iCal
router.get('/export/:boardId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { boardId } = req.params;
    const { timezone = 'UTC' } = req.query;

    console.log('📅 Calendar export request:', { userId, boardId, timezone });

    // Check board access
    const board = await getPrisma().board.findFirst({
      where: {
        id: boardId,
        members: {
          some: { userId }
        }
      },
      include: {
        tasks: {
          include: {
            column: { select: { name: true } },
            labels: { include: { label: true } }
          },
          where: {
            OR: [
              { dueAt: { not: null } },
              { estimateMin: { gt: 0 } }
            ]
          }
        }
      }
    });

    if (!board) {
      return res.status(404).json({ error: 'Board not found or access denied' });
    }

    console.log(`📅 Exporting ${board.tasks.length} tasks from board "${board.name}"`);

    // Generate calendar events
    const events = tasksToCalendarEvents(board.tasks, timezone as string);
    
    // Generate iCal content
    const icalContent = generateICalendar(events, timezone as string);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${board.name}-tasks.ics"`);
    
    res.send(icalContent);

  } catch (error) {
    console.error('📅 ❌ Calendar export error:', error);
    res.status(500).json({ 
      error: 'Failed to export calendar',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/calendar/schedule - Smart schedule tasks
router.post('/schedule', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { boardId, preferences = defaultSchedulingPreferences, startDate } = req.body;

    console.log('📅 Smart scheduling request:', { userId, boardId, startDate });

    // Validate preferences
    const validatedPreferences = SchedulingPreferencesSchema.parse(preferences);

    // Get unscheduled tasks
    const tasks = await getPrisma().task.findMany({
      where: {
        boardId,
        board: {
          members: {
            some: { userId }
          }
        },
        column: {
          name: {
            in: ['Inbox', 'To Do', 'Backlog']
          }
        }
      },
      include: {
        column: { select: { name: true } }
      },
      orderBy: [
        { priority: 'desc' },
        { energy: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    console.log(`📅 Scheduling ${tasks.length} unscheduled tasks`);

    // Generate optimal schedule
    const scheduledTasks = scheduleTasksOptimally(
      tasks,
      validatedPreferences as SchedulingPreferences,
      startDate ? new Date(startDate) : new Date()
    );

    // Update tasks with scheduled times (optional - could be stored in metadata)
    const updates = scheduledTasks.map(task => ({
      id: task.id,
      scheduledFor: task.scheduledFor,
      estimatedDuration: (task.estimateMin || 15) + validatedPreferences.bufferTime
    }));

    console.log(`📅 Generated schedule for ${updates.length} tasks`);

    res.json({
      message: `Successfully scheduled ${updates.length} tasks`,
      scheduledTasks: updates,
      summary: {
        totalTasks: tasks.length,
        scheduledTasks: updates.length,
        preferences: validatedPreferences,
        dateRange: {
          start: updates[0]?.scheduledFor || null,
          end: updates[updates.length - 1]?.scheduledFor || null
        }
      }
    });

  } catch (error) {
    console.error('📅 ❌ Smart scheduling error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid scheduling preferences',
        details: error.errors 
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to schedule tasks',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/calendar/availability/:boardId - Check calendar availability
router.get('/availability/:boardId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const { boardId } = req.params;
    const { date, timezone = 'UTC' } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log('📅 Availability check:', { userId, boardId, date: targetDate.toISOString().split('T')[0] });

    // Get tasks scheduled for this day
    const scheduledTasks = await getPrisma().task.findMany({
      where: {
        boardId,
        board: {
          members: {
            some: { userId }
          }
        },
        dueAt: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        column: { select: { name: true } }
      },
      orderBy: { dueAt: 'asc' }
    });

    // Calculate workload
    const totalEstimatedMinutes = scheduledTasks.reduce((sum, task) => sum + (task.estimateMin || 15), 0);
    const urgentTasks = scheduledTasks.filter(task => task.priority === 'URGENT').length;
    const highEnergyTasks = scheduledTasks.filter(task => task.energy === 'HIGH').length;

    // Determine availability status
    let status: 'LIGHT' | 'MODERATE' | 'HEAVY' | 'OVERLOADED' = 'LIGHT';
    
    if (totalEstimatedMinutes > 480) { // 8 hours
      status = 'OVERLOADED';
    } else if (totalEstimatedMinutes > 360 || urgentTasks > 3) { // 6 hours or too many urgent
      status = 'HEAVY';
    } else if (totalEstimatedMinutes > 180 || highEnergyTasks > 2) { // 3 hours or too many high-energy
      status = 'MODERATE';
    }

    res.json({
      date: targetDate.toISOString().split('T')[0],
      availability: {
        status,
        totalTasks: scheduledTasks.length,
        totalEstimatedMinutes,
        urgentTasks,
        highEnergyTasks,
        recommendedCapacity: status === 'LIGHT' ? 'Can take on more tasks' : 
                            status === 'MODERATE' ? 'At good capacity' :
                            status === 'HEAVY' ? 'Near capacity limit' :
                            'Over capacity - consider rescheduling'
      },
      tasks: scheduledTasks.map(task => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        energy: task.energy,
        estimateMin: task.estimateMin,
        dueAt: task.dueAt,
        column: task.column.name
      }))
    });

  } catch (error) {
    console.error('📅 ❌ Availability check error:', error);
    res.status(500).json({ 
      error: 'Failed to check availability',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
