import { Task } from '../types'

export class DemoDataService {
  private demoTasks: Map<string, Task[]> = new Map()
  
  /**
   * Initialize demo data for a board
   */
  async initializeDemoData(boardId: string): Promise<void> {
    const demoTasks = [
      {
        id: 'demo_1',
        title: 'Daily Standup',
        description: 'Team daily standup meeting to discuss progress and blockers',
        priority: 'HIGH' as const,
        energy: 'LOW' as const,
        status: 'TODO' as const,
        dueDate: this.getDateFromNow(0), // Today
        estimatedMinutes: 15,
        labels: ['work', 'meeting', 'daily'],
        isRepeating: true,
        repeatPattern: 'DAILY' as const,
        repeatInterval: 1,
        repeatDays: [1, 2, 3, 4, 5], // Weekdays
        repeatEndDate: this.getDateFromNow(365), // 1 year from now
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        boardId,
        columnId: 'default',
        confidence: 0.9,
        aiGenerated: true
      },
      {
        id: 'demo_2',
        title: 'Weekly Review',
        description: 'Review progress and plan next week',
        priority: 'MEDIUM' as const,
        energy: 'MEDIUM' as const,
        status: 'TODO' as const,
        dueDate: this.getDateFromNow(7), // Next week
        estimatedMinutes: 60,
        labels: ['work', 'planning', 'weekly'],
        isRepeating: true,
        repeatPattern: 'WEEKLY' as const,
        repeatInterval: 1,
        repeatDays: [1], // Monday
        repeatEndDate: this.getDateFromNow(365),
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        boardId,
        columnId: 'default',
        confidence: 0.8,
        aiGenerated: true
      },
      {
        id: 'demo_3',
        title: 'Monthly Budget Review',
        description: 'Review monthly expenses and budget',
        priority: 'MEDIUM' as const,
        energy: 'LOW' as const,
        status: 'TODO' as const,
        dueDate: this.getDateFromNow(30), // Next month
        estimatedMinutes: 45,
        labels: ['personal', 'finance', 'monthly'],
        isRepeating: true,
        repeatPattern: 'MONTHLY' as const,
        repeatInterval: 1,
        repeatEndDate: this.getDateFromNow(365),
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        boardId,
        columnId: 'default',
        confidence: 0.7,
        aiGenerated: true
      },
      {
        id: 'demo_4',
        title: 'Grocery Shopping',
        description: 'Weekly grocery shopping trip',
        priority: 'MEDIUM' as const,
        energy: 'LOW' as const,
        status: 'TODO' as const,
        dueDate: this.getDateFromNow(3), // This weekend
        estimatedMinutes: 90,
        labels: ['personal', 'shopping', 'weekly'],
        isRepeating: true,
        repeatPattern: 'WEEKLY' as const,
        repeatInterval: 1,
        repeatDays: [0, 6], // Weekend
        repeatEndDate: this.getDateFromNow(365),
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        boardId,
        columnId: 'default',
        confidence: 0.8,
        aiGenerated: true
      },
      {
        id: 'demo_5',
        title: 'Project Deadline',
        description: 'Important project milestone that needs attention',
        priority: 'URGENT' as const,
        energy: 'HIGH' as const,
        status: 'TODO' as const,
        dueDate: this.getDateFromNow(5), // This week
        estimatedMinutes: 240,
        labels: ['work', 'project', 'deadline'],
        isRepeating: false,
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        boardId,
        columnId: 'default',
        confidence: 0.9,
        aiGenerated: true
      },
      {
        id: 'demo_6',
        title: 'Exercise Routine',
        description: 'Daily exercise and fitness routine',
        priority: 'HIGH' as const,
        energy: 'MEDIUM' as const,
        status: 'TODO' as const,
        dueDate: this.getDateFromNow(0), // Today
        estimatedMinutes: 45,
        labels: ['personal', 'health', 'fitness'],
        isRepeating: true,
        repeatPattern: 'DAILY' as const,
        repeatInterval: 1,
        repeatDays: [0, 1, 2, 3, 4, 5, 6], // Every day
        repeatEndDate: this.getDateFromNow(365),
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        boardId,
        columnId: 'default',
        confidence: 0.8,
        aiGenerated: true
      }
    ]
    
    this.demoTasks.set(boardId, demoTasks)
  }
  
  /**
   * Purge all demo tasks from a board
   */
  async purgeDemoTasks(boardId: string): Promise<void> {
    try {
      // Remove from memory
      this.demoTasks.delete(boardId)
      
      // This would also remove from the database
      // await this.db.tasks.deleteMany({
      //   where: {
      //     boardId,
      //     isDemo: true
      //   }
      // })
      
      console.log(`Purged demo tasks for board ${boardId}`)
    } catch (error) {
      console.error(`Failed to purge demo tasks for board ${boardId}:`, error)
      throw new Error('Failed to purge demo tasks')
    }
  }
  
  /**
   * Get demo tasks for a board
   */
  async getDemoTasks(boardId: string): Promise<Task[]> {
    if (!this.demoTasks.has(boardId)) {
      await this.initializeDemoData(boardId)
    }
    return this.demoTasks.get(boardId) || []
  }
  
  /**
   * Check if demo tasks exist for a board
   */
  async hasDemoTasks(boardId: string): Promise<boolean> {
    const tasks = await this.getDemoTasks(boardId)
    return tasks.length > 0
  }
  
  /**
   * Reset demo tasks flag (allow recreation)
   */
  async resetDemoTasksFlag(boardId: string): Promise<void> {
    // This would reset the flag in the database
    // For now, just remove from memory
    this.demoTasks.delete(boardId)
    console.log(`Reset demo tasks flag for board ${boardId}`)
  }
  
  /**
   * Get demo task statistics
   */
  async getDemoTaskStats(boardId: string): Promise<{
    total: number
    repeating: number
    urgent: number
    highPriority: number
  }> {
    const tasks = await this.getDemoTasks(boardId)
    
    return {
      total: tasks.length,
      repeating: tasks.filter(t => t.isRepeating).length,
      urgent: tasks.filter(t => t.priority === 'URGENT').length,
      highPriority: tasks.filter(t => t.priority === 'HIGH' || t.priority === 'URGENT').length
    }
  }
  
  /**
   * Export demo tasks for backup
   */
  async exportDemoTasks(boardId: string): Promise<string> {
    const tasks = await this.getDemoTasks(boardId)
    return JSON.stringify({
      boardId,
      exportedAt: new Date().toISOString(),
      taskCount: tasks.length,
      tasks
    }, null, 2)
  }
  
  /**
   * Import demo tasks from backup
   */
  async importDemoTasks(boardId: string, backupData: string): Promise<void> {
    try {
      const data = JSON.parse(backupData)
      if (data.boardId === boardId && Array.isArray(data.tasks)) {
        this.demoTasks.set(boardId, data.tasks)
        console.log(`Imported ${data.tasks.length} demo tasks for board ${boardId}`)
      } else {
        throw new Error('Invalid backup data format')
      }
    } catch (error) {
      console.error(`Failed to import demo tasks for board ${boardId}:`, error)
      throw new Error('Failed to import demo tasks')
    }
  }
  
  /**
   * Helper: Get date from now
   */
  private getDateFromNow(days: number): Date {
    const date = new Date()
    date.setDate(date.getDate() + days)
    return date
  }
  
  /**
   * Helper: Get next occurrence date for recurring tasks
   */
  private getNextOccurrence(
    currentDate: Date,
    pattern: string,
    interval: number,
    repeatDays?: number[]
  ): Date {
    const nextDate = new Date(currentDate)
    
    switch (pattern) {
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + interval)
        break
        
      case 'WEEKLY':
        if (repeatDays && repeatDays.length > 0) {
          let daysToAdd = 1
          while (daysToAdd <= 7) {
            nextDate.setDate(nextDate.getDate() + 1)
            if (repeatDays.includes(nextDate.getDay())) {
              break
            }
            daysToAdd++
          }
        } else {
          nextDate.setDate(nextDate.getDate() + (7 * interval))
        }
        break
        
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + interval)
        break
        
      default:
        nextDate.setDate(nextDate.getDate() + 1)
    }
    
    return nextDate
  }
}
