import { Task } from '@prisma/client';

// Calendar integration utilities for TaskerADHD

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  recurrence?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  taskId?: string;
}

export interface CalendarExport {
  events: CalendarEvent[];
  timezone: string;
  lastUpdated: Date;
}

/**
 * Convert TaskerADHD tasks to calendar events
 */
export function tasksToCalendarEvents(tasks: Task[], timezone = 'UTC'): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const task of tasks) {
    // Create event for scheduled tasks
    if (task.dueAt) {
      const event: CalendarEvent = {
        id: `task-due-${task.id}`,
        title: `📅 Due: ${task.title}`,
        description: task.summary ? `${task.summary}\n\nEstimate: ${task.estimateMin || 15}min` : `Estimate: ${task.estimateMin || 15}min`,
        start: new Date(task.dueAt),
        allDay: true,
        taskId: task.id
      };

      // Add priority indicator
      if (task.priority === 'URGENT') {
        event.title = `🚨 ${event.title}`;
      } else if (task.priority === 'HIGH') {
        event.title = `⚡ ${event.title}`;
      }

      events.push(event);
    }

    // Create time-blocked events for estimated tasks
    if (task.estimateMin && task.estimateMin > 0) {
      const scheduledTime = task.dueAt ? new Date(task.dueAt) : new Date();
      
      // If task has a due date, schedule it 1 hour before
      if (task.dueAt) {
        scheduledTime.setHours(scheduledTime.getHours() - 1);
      }

      const endTime = new Date(scheduledTime.getTime() + task.estimateMin * 60 * 1000);

      const timeBlockEvent: CalendarEvent = {
        id: `task-work-${task.id}`,
        title: `⚡ Work: ${task.title}`,
        description: task.summary || 'TaskerADHD work block',
        start: scheduledTime,
        end: endTime,
        allDay: false,
        taskId: task.id
      };

      events.push(timeBlockEvent);
    }
  }

  return events;
}

/**
 * Generate iCal format for calendar export
 */
export function generateICalendar(events: CalendarEvent[], timezone = 'UTC'): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskerADHD//TaskerADHD Calendar//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-TIMEZONE:${timezone}`,
    ''
  ];

  for (const event of events) {
    const eventStart = event.start.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const eventEnd = event.end 
      ? event.end.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
      : eventStart;

    icalContent.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@taskeradhd.app`,
      `DTSTAMP:${timestamp}`,
      `DTSTART${event.allDay ? ';VALUE=DATE' : ''}:${event.allDay ? eventStart.split('T')[0].replace(/[-]/g, '') : eventStart}`,
      `DTEND${event.allDay ? ';VALUE=DATE' : ''}:${event.allDay ? eventEnd.split('T')[0].replace(/[-]/g, '') : eventEnd}`,
      `SUMMARY:${event.title}`,
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      event.recurrence ? `RRULE:FREQ=${event.recurrence}` : '',
      'END:VEVENT',
      ''
    );
  }

  icalContent.push('END:VCALENDAR');

  return icalContent.filter(line => line !== '').join('\r\n');
}

/**
 * Smart scheduling algorithm for ADHD-friendly task placement
 */
export interface SchedulingPreferences {
  workingHours: { start: number; end: number }; // 24-hour format
  energyPeaks: number[]; // Hours when energy is highest
  breakDuration: number; // Minutes between tasks
  maxTasksPerDay: number;
  bufferTime: number; // Minutes to add to estimates
}

export function scheduleTasksOptimally(
  tasks: Task[], 
  preferences: SchedulingPreferences,
  startDate = new Date()
): Array<Task & { scheduledFor: Date }> {
  const scheduledTasks: Array<Task & { scheduledFor: Date }> = [];
  const currentDate = new Date(startDate);
  currentDate.setHours(preferences.workingHours.start, 0, 0, 0);

  // Sort tasks by priority and energy level
  const sortedTasks = [...tasks].sort((a, b) => {
    const priorityWeight = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const energyWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    
    const aScore = (priorityWeight[a.priority || 'MEDIUM'] || 0) + (energyWeight[a.energy || 'MEDIUM'] || 0);
    const bScore = (priorityWeight[b.priority || 'MEDIUM'] || 0) + (energyWeight[b.energy || 'MEDIUM'] || 0);
    
    return bScore - aScore;
  });

  let tasksScheduledToday = 0;

  for (const task of sortedTasks) {
    if (tasksScheduledToday >= preferences.maxTasksPerDay) {
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(preferences.workingHours.start, 0, 0, 0);
      tasksScheduledToday = 0;
    }

    const taskDuration = (task.estimateMin || 15) + preferences.bufferTime;
    const taskEndTime = new Date(currentDate.getTime() + taskDuration * 60 * 1000);

    // Check if task fits in working hours
    if (taskEndTime.getHours() > preferences.workingHours.end) {
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(preferences.workingHours.start, 0, 0, 0);
      tasksScheduledToday = 0;
    }

    // Prefer energy peaks for high-energy tasks
    if (task.energy === 'HIGH' && preferences.energyPeaks.length > 0) {
      const bestHour = preferences.energyPeaks.find(hour => 
        hour >= currentDate.getHours() && hour <= preferences.workingHours.end - 1
      );
      
      if (bestHour) {
        currentDate.setHours(bestHour, 0, 0, 0);
      }
    }

    scheduledTasks.push({
      ...task,
      scheduledFor: new Date(currentDate)
    });

    // Advance time for next task
    currentDate.setTime(currentDate.getTime() + taskDuration * 60 * 1000);
    currentDate.setTime(currentDate.getTime() + preferences.breakDuration * 60 * 1000);
    tasksScheduledToday++;
  }

  return scheduledTasks;
}

/**
 * Default ADHD-friendly scheduling preferences
 */
export const defaultSchedulingPreferences: SchedulingPreferences = {
  workingHours: { start: 9, end: 17 },
  energyPeaks: [10, 14], // 10 AM and 2 PM
  breakDuration: 15, // 15-minute breaks
  maxTasksPerDay: 5, // Don't overwhelm
  bufferTime: 5 // Add 5 minutes to each estimate
};
