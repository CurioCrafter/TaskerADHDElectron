/**
 * Utility functions library
 * Reduces code duplication and provides common helpers
 */

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ADHD_LIMITS, TASK_CONFIG } from './constants'
import type { Task, Board, TaskPriority, EnergyLevel } from '@/types'

/**
 * Tailwind class name merger
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Date utilities for ADHD-friendly formatting
 */
export const dateUtils = {
  /**
   * Check if date is today
   */
  isToday: (date: Date | string): boolean => {
    const today = new Date()
    const checkDate = new Date(date)
    return today.toDateString() === checkDate.toDateString()
  },

  /**
   * Check if date is overdue
   */
  isOverdue: (date: Date | string): boolean => {
    return new Date(date) < new Date()
  },

  /**
   * Format date for ADHD-friendly display
   */
  formatRelative: (date: Date | string): string => {
    const now = new Date()
    const targetDate = new Date(date)
    const diffMs = targetDate.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays === -1) return 'Yesterday'
    if (diffDays > 0) return `In ${diffDays} days`
    return `${Math.abs(diffDays)} days ago`
  },

  /**
   * Format due date with urgency indicator
   */
  formatDueDate: (date: Date | string): { text: string; urgency: 'overdue' | 'today' | 'soon' | 'later' } => {
    const targetDate = new Date(date)
    const now = new Date()
    const diffMs = targetDate.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays < 0) return { text: 'Overdue', urgency: 'overdue' }
    if (diffDays === 0) return { text: 'Due today', urgency: 'today' }
    if (diffDays <= 3) return { text: `Due in ${diffDays} days`, urgency: 'soon' }
    return { text: `Due ${targetDate.toLocaleDateString()}`, urgency: 'later' }
  }
}

/**
 * Task utilities for ADHD management
 */
export const taskUtils = {
  /**
   * Check if task is a quick win (low energy, short duration)
   */
  isQuickWin: (task: Task): boolean => {
    return task.energy === 'LOW' && (task.estimateMin || 0) <= TASK_CONFIG.QUICK_WIN_THRESHOLD
  },

  /**
   * Check if task is due today
   */
  isDueToday: (task: Task): boolean => {
    return task.dueAt ? dateUtils.isToday(task.dueAt) : false
  },

  /**
   * Check if task is urgent (high priority or overdue)
   */
  isUrgent: (task: Task): boolean => {
    const isHighPriority = task.priority === 'URGENT' || task.priority === 'HIGH'
    const isOverdue = task.dueAt ? dateUtils.isOverdue(task.dueAt) : false
    return isHighPriority || isOverdue
  },

  /**
   * Get task priority score for sorting
   */
  getPriorityScore: (task: Task): number => {
    const priorityScores = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
    return priorityScores[task.priority as keyof typeof priorityScores] || 0
  },

  /**
   * Get task energy score for sorting
   */
  getEnergyScore: (task: Task): number => {
    const energyScores = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    return energyScores[task.energy as keyof typeof energyScores] || 0
  },

  /**
   * Sort tasks by ADHD-friendly criteria
   */
  sortForADHD: (tasks: Task[], mode: 'priority' | 'energy' | 'dueDate' | 'quickWins' = 'priority'): Task[] => {
    return [...tasks].sort((a, b) => {
      switch (mode) {
        case 'priority':
          return taskUtils.getPriorityScore(b) - taskUtils.getPriorityScore(a)
        case 'energy':
          return taskUtils.getEnergyScore(a) - taskUtils.getEnergyScore(b) // Low energy first
        case 'dueDate':
          if (!a.dueAt && !b.dueAt) return 0
          if (!a.dueAt) return 1
          if (!b.dueAt) return -1
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
        case 'quickWins':
          return (taskUtils.isQuickWin(a) ? -1 : 1) - (taskUtils.isQuickWin(b) ? -1 : 1)
        default:
          return 0
      }
    })
  },

  /**
   * Filter tasks for today's focus
   */
  getTodaysTasks: (tasks: Task[]): Task[] => {
    return tasks
      .filter(task => {
        const isDueToday = taskUtils.isDueToday(task)
        const isUrgent = taskUtils.isUrgent(task)
        const isInProgress = task.column?.name?.toLowerCase().includes('doing') || 
                           task.column?.name?.toLowerCase().includes('progress')
        return isDueToday || isUrgent || isInProgress
      })
      .slice(0, ADHD_LIMITS.MAX_DAILY_TASKS)
  },

  /**
   * Filter tasks for quick wins
   */
  getQuickWins: (tasks: Task[]): Task[] => {
    return tasks
      .filter(taskUtils.isQuickWin)
      .slice(0, ADHD_LIMITS.MAX_QUICK_WINS)
  },

  /**
   * Calculate estimated completion time for task list
   */
  calculateTotalTime: (tasks: Task[]): number => {
    return tasks.reduce((total, task) => total + (task.estimateMin || 0), 0)
  },

  /**
   * Get task progress percentage for a board
   */
  getBoardProgress: (board: Board): { completed: number; total: number; percentage: number } => {
    const allTasks = board.columns?.flatMap(col => col.tasks || []) || []
    const completed = allTasks.filter(task => 
      task.column?.name?.toLowerCase().includes('done') ||
      task.column?.name?.toLowerCase().includes('complete')
    ).length
    const total = allTasks.length
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return { completed, total, percentage }
  }
}

/**
 * String utilities
 */
export const stringUtils = {
  /**
   * Truncate text with ellipsis
   */
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength - 3) + '...'
  },

  /**
   * Convert to title case
   */
  toTitleCase: (text: string): string => {
    return text.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    )
  },

  /**
   * Generate initials from name
   */
  getInitials: (name: string): string => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  },

  /**
   * Slugify text for URLs
   */
  slugify: (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
}

/**
 * Array utilities
 */
export const arrayUtils = {
  /**
   * Remove item by id from array
   */
  removeById: <T extends { id: string }>(array: T[], id: string): T[] => {
    return array.filter(item => item.id !== id)
  },

  /**
   * Update item by id in array
   */
  updateById: <T extends { id: string }>(array: T[], id: string, updates: Partial<T>): T[] => {
    return array.map(item => item.id === id ? { ...item, ...updates } : item)
  },

  /**
   * Move item in array
   */
  moveItem: <T>(array: T[], fromIndex: number, toIndex: number): T[] => {
    const result = [...array]
    const [removed] = result.splice(fromIndex, 1)
    result.splice(toIndex, 0, removed)
    return result
  },

  /**
   * Group array by property
   */
  groupBy: <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
    return array.reduce((groups, item) => {
      const groupKey = String(item[key])
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(item)
      return groups
    }, {} as Record<string, T[]>)
  },

  /**
   * Shuffle array randomly
   */
  shuffle: <T>(array: T[]): T[] => {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }
}

/**
 * Local storage utilities with error handling
 */
export const storageUtils = {
  /**
   * Get item from localStorage with fallback
   */
  get: <T>(key: string, fallback: T): T => {
    try {
      if (typeof window === 'undefined') return fallback
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : fallback
    } catch {
      return fallback
    }
  },

  /**
   * Set item in localStorage
   */
  set: (key: string, value: any): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(value))
      }
    } catch (error) {
      console.warn('Failed to save to localStorage:', error)
    }
  },

  /**
   * Remove item from localStorage
   */
  remove: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key)
      }
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error)
    }
  }
}

/**
 * Validation utilities
 */
export const validationUtils = {
  /**
   * Validate email format
   */
  isEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Validate task title
   */
  isValidTaskTitle: (title: string): boolean => {
    return title.trim().length >= 1 && title.trim().length <= 200
  },

  /**
   * Validate time estimate
   */
  isValidEstimate: (minutes: number): boolean => {
    return minutes >= TASK_CONFIG.MIN_ESTIMATE && minutes <= TASK_CONFIG.MAX_ESTIMATE
  }
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Format time duration for display
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) return `${hours}h`
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
