import { Task, TaskProposal } from '../../types'

export class TaskProcessor {
  private db: any // Will be replaced with actual database interface
  
  constructor(db: any) {
    this.db = db
  }
  
  /**
   * Process task proposals and create final tasks
   */
  async processTasks(proposals: TaskProposal[]): Promise<Task[]> {
    const tasks: Task[] = []
    
    for (const proposal of proposals) {
      try {
        // Validate and enrich task data
        const enriched = await this.enrichTaskData(proposal)
        
        // Check for duplicates
        const duplicates = await this.findDuplicates(enriched)
        if (duplicates.length > 0) {
          // Merge or skip based on confidence
          if (enriched.confidence && enriched.confidence > 0.8) {
            await this.mergeTasks(enriched, duplicates[0])
          }
          continue
        }
        
        // Create recurring tasks if needed
        if (enriched.isRepeating) {
          const recurringTasks = await this.createRecurringTasks(enriched)
          tasks.push(...recurringTasks)
        } else {
          tasks.push(enriched)
        }
      } catch (error) {
        console.error(`Failed to process proposal ${proposal.id}:`, error)
        // Continue with other proposals
      }
    }
    
    // Save to database
    if (tasks.length > 0) {
      return await this.saveTasks(tasks)
    }
    
    return []
  }
  
  /**
   * Enrich task data with defaults and validation
   */
  private async enrichTaskData(proposal: TaskProposal): Promise<Task> {
    const enriched: Task = {
      ...proposal,
      // Ensure required fields have defaults
      isRepeating: proposal.isRepeating || false,
      repeatPattern: proposal.repeatPattern || undefined,
      repeatInterval: proposal.repeatInterval || 1,
      repeatDays: proposal.repeatDays || undefined,
      estimatedMinutes: proposal.estimatedMinutes || 30,
      labels: proposal.labels || [],
      subtasks: proposal.subtasks || [],
      confidence: proposal.confidence || 0.7,
      clarificationNeeded: false,
      // Set temporal defaults
      dueDate: proposal.dueDate || this.getDefaultDueDate(proposal.priority),
      scheduledFor: proposal.scheduledFor || proposal.dueDate || new Date(),
      // Set metadata
      createdAt: new Date(),
      updatedAt: new Date(),
      aiGenerated: true
    }
    
    // Validate and fix data
    if (enriched.isRepeating && !enriched.repeatPattern) {
      enriched.repeatPattern = this.inferRepeatPattern(proposal.title, proposal.description)
    }
    
    if (enriched.isRepeating && !enriched.repeatDays) {
      enriched.repeatDays = this.getDefaultRepeatDays(enriched.repeatPattern)
    }
    
    return enriched
  }
  
  /**
   * Find duplicate tasks
   */
  private async findDuplicates(task: Task): Promise<Task[]> {
    // This would query the database for similar tasks
    // For now, return empty array
    return []
  }
  
  /**
   * Merge tasks (placeholder implementation)
   */
  private async mergeTasks(newTask: Task, existingTask: Task): Promise<void> {
    // This would merge the new task with the existing one
    // For now, just log
    console.log(`Merging task ${newTask.id} with existing ${existingTask.id}`)
  }
  
  /**
   * Create recurring tasks based on template
   */
  private async createRecurringTasks(template: Task): Promise<Task[]> {
    const tasks: Task[] = []
    const endDate = template.repeatEndDate || this.getDefaultEndDate()
    
    let currentDate = new Date(template.scheduledFor || new Date())
    
    while (currentDate <= endDate) {
      const task: Task = {
        ...template,
        id: `${template.id}_${currentDate.getTime()}`,
        scheduledFor: new Date(currentDate),
        dueDate: new Date(currentDate),
        createdAt: new Date(),
        updatedAt: new Date()
      }
      
      tasks.push(task)
      
      // Calculate next occurrence
      currentDate = this.getNextOccurrence(
        currentDate,
        template.repeatPattern!,
        template.repeatInterval!,
        template.repeatDays
      )
    }
    
    return tasks
  }
  
  /**
   * Get next occurrence date for recurring tasks
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
          // Find next occurrence based on repeat days
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
  
  /**
   * Get default due date based on priority
   */
  private getDefaultDueDate(priority?: string): Date {
    const today = new Date()
    
    switch (priority) {
      case 'URGENT':
        return today
      case 'HIGH':
        today.setDate(today.getDate() + 1)
        return today
      case 'MEDIUM':
        today.setDate(today.getDate() + 3)
        return today
      case 'LOW':
        today.setDate(today.getDate() + 7)
        return today
      default:
        today.setDate(today.getDate() + 3)
        return today
    }
  }
  
  /**
   * Get default end date for recurring tasks
   */
  private getDefaultEndDate(): Date {
    const endDate = new Date()
    endDate.setFullYear(endDate.getFullYear() + 1) // Default to 1 year
    return endDate
  }
  
  /**
   * Infer repeat pattern from text
   */
  private inferRepeatPattern(title: string, description?: string): 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM' {
    const text = `${title} ${description || ''}`.toLowerCase()
    
    if (text.includes('every day') || text.includes('daily')) {
      return 'DAILY'
    }
    if (text.includes('every week') || text.includes('weekly')) {
      return 'WEEKLY'
    }
    if (text.includes('every month') || text.includes('monthly')) {
      return 'MONTHLY'
    }
    
    return 'WEEKLY' // Default to weekly
  }
  
  /**
   * Get default repeat days for pattern
   */
  private getDefaultRepeatDays(pattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'): number[] {
    switch (pattern) {
      case 'DAILY':
        return [0, 1, 2, 3, 4, 5, 6] // All days
      case 'WEEKLY':
        return [1] // Monday
      case 'MONTHLY':
        return [1] // First Monday of month
      default:
        return [1] // Monday
    }
  }
  
  /**
   * Save tasks to database
   */
  private async saveTasks(tasks: Task[]): Promise<Task[]> {
    // This would save to the actual database
    // For now, just return the tasks
    console.log(`Saving ${tasks.length} tasks to database`)
    return tasks
  }
  
  /**
   * Validate task data
   */
  private validateTask(task: Task): boolean {
    if (!task.title || task.title.trim().length === 0) {
      return false
    }
    
    if (task.isRepeating && !task.repeatPattern) {
      return false
    }
    
    if (task.estimatedMinutes && task.estimatedMinutes < 0) {
      return false
    }
    
    return true
  }
}
