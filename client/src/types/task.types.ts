// Re-export all types from shared types for backward compatibility
export * from '../../../shared/types'

// Re-export specific types with compatibility aliases
import type { 
  Task as SharedTask,
  TaskProposal as SharedTaskProposal,
  Board as SharedBoard,
  BoardColumn as SharedBoardColumn
} from '../../../shared/types'

// Legacy compatibility types
export type Task = SharedTask
export type TaskProposal = SharedTaskProposal  
export type Board = SharedBoard
export type BoardColumn = SharedBoardColumn

// Additional client-specific types
export interface TaskFormData {
  title: string
  description?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  energy: 'LOW' | 'MEDIUM' | 'HIGH'
  dueDate?: string
  scheduledFor?: string
  estimatedMinutes?: number
  labels: string[]
  isRepeating: boolean
  repeatPattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
  repeatInterval?: number
  repeatDays?: number[]
  repeatEndDate?: string
  repeatCount?: number
}

export interface TaskFilters {
  priority?: SharedTask['priority'][]
  energy?: SharedTask['energy'][]
  status?: SharedTask['status'][]
  labels?: string[]
  dueDateRange?: {
    start: Date
    end: Date
  }
  isRepeating?: boolean
}

export interface TaskSortOptions {
  field: keyof SharedTask
  direction: 'asc' | 'desc'
}
