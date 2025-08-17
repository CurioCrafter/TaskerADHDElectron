import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { arrayUtils, stringUtils } from '@/lib/utils'
import { STORAGE_KEYS } from '@/lib/constants'
import type { Task, TaskPriority, EnergyLevel } from '@/types'

// Extended task interface for staging
interface StagedTask extends Omit<Task, 'columnId' | 'boardId'> {
  // Staging metadata
  source: 'voice' | 'ai_chat' | 'manual' | 'import' | 'calendar_sync'
  confidence: number
  stagedAt: string
  processed: boolean
  
  // AI enhancements
  suggestedImprovements: Array<{
    type: 'missing_context' | 'unclear_priority' | 'duration_estimate' | 'energy_mismatch' | 'similar_task'
    message: string
    suggestion?: string
    autoFix?: boolean
  }>
  
  // Smart categorization
  detectedCategory: 'work' | 'personal' | 'health' | 'learning' | 'admin' | 'creative' | 'urgent'
  duplicateOf?: string
  relatedTasks: string[]
  
  // Auto-completion suggestions
  predictedDuration?: number
  suggestedEnergy?: EnergyLevel
  suggestedPriority?: TaskPriority
  suggestedDueDate?: string
  suggestedLabels: string[]
}

interface StagingStats {
  total: number
  highConfidence: number
  needsReview: number
  duplicates: number
  bySource: Record<StagedTask['source'], number>
  averageConfidence: number
}

interface StagingState {
  // State
  stagedTasks: StagedTask[]
  processingQueue: string[]
  isProcessing: boolean
  
  // Settings
  autoEnhancement: boolean
  duplicateDetection: boolean
  confidenceThreshold: number
  
  // Actions
  addToStaging: (task: Omit<StagedTask, 'id' | 'stagedAt' | 'processed'> & { id?: string }) => void
  removeFromStaging: (taskId: string) => void
  updateStagedTask: (taskId: string, updates: Partial<StagedTask>) => void
  processToBoard: (taskId: string, boardId: string) => Promise<boolean>
  bulkProcessTasks: (taskIds: string[], boardId: string) => Promise<number>
  clearStaging: () => void
  
  // Analytics
  getStagingStats: () => StagingStats
  findDuplicates: (task: StagedTask) => string[]
  categorizeTask: (task: StagedTask) => StagedTask['detectedCategory']
  
  // Auto-enhancement
  enhanceTask: (taskId: string) => void
  runAutoEnhancement: () => void
}

export const useStagingStore = create<StagingState>()(
  persist(
    (set, get) => ({
      // Initial state
      stagedTasks: [],
      processingQueue: [],
      isProcessing: false,
      
      // Settings
      autoEnhancement: true,
      duplicateDetection: true,
      confidenceThreshold: 0.6,

      // Add task to staging
      addToStaging: (task) => {
        try {
          console.log('📥 Adding task to staging:', task.title)
          const state = get()
          
          // Validate required fields
          if (!task.title || typeof task.title !== 'string' || task.title.trim().length === 0) {
            console.error('🚨 Invalid task title:', task.title)
            return
          }
          
          const newTask: StagedTask = {
          id: task.id || `staged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: task.title,
          summary: task.summary || '',
          priority: task.priority,
          energy: task.energy,
          estimateMin: task.estimateMin,
          dueAt: task.dueAt,
          labels: task.labels || [],
          subtasks: task.subtasks || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          position: 0,
          
          // Staging specific
          source: task.source,
          confidence: task.confidence,
          stagedAt: new Date().toISOString(),
          processed: false,
          suggestedImprovements: task.suggestedImprovements || [],
          detectedCategory: get().categorizeTask(task as StagedTask),
          duplicateOf: undefined,
          relatedTasks: task.relatedTasks || [],
          predictedDuration: task.predictedDuration,
          suggestedEnergy: task.suggestedEnergy,
          suggestedPriority: task.suggestedPriority,
          suggestedDueDate: task.suggestedDueDate,
          suggestedLabels: task.suggestedLabels || []
        }

        // Check for duplicates if enabled
        if (state.duplicateDetection) {
          const duplicates = get().findDuplicates(newTask)
          if (duplicates.length > 0) {
            newTask.duplicateOf = duplicates[0]
            newTask.suggestedImprovements.push({
              type: 'similar_task',
              message: `Similar to existing task: "${state.stagedTasks.find(t => t.id === duplicates[0])?.title}"`,
              suggestion: 'Consider merging or adjusting to avoid duplication',
              autoFix: false
            })
          }
        }

        set({ 
          stagedTasks: [...state.stagedTasks, newTask] 
        })

        // Run auto-enhancement if enabled
        if (state.autoEnhancement) {
          setTimeout(() => get().enhanceTask(newTask.id), 100)
        }
        
        console.log('✅ Task successfully added to staging:', newTask.title)
        } catch (error) {
          console.error('🚨 Error adding task to staging:', error, { task })
        }
      },

      // Remove task from staging
      removeFromStaging: (taskId: string) => {
        set(state => ({
          stagedTasks: state.stagedTasks.filter(task => task.id !== taskId)
        }))
      },

      // Update staged task
      updateStagedTask: (taskId: string, updates: Partial<StagedTask>) => {
        set(state => ({
          stagedTasks: arrayUtils.updateById(state.stagedTasks, taskId, {
            ...updates,
            updatedAt: new Date().toISOString()
          })
        }))
      },

      // Process task to board
      processToBoard: async (taskId: string, boardId: string) => {
        const state = get()
        const task = state.stagedTasks.find(t => t.id === taskId)
        if (!task) return false

        set({ isProcessing: true, processingQueue: [...state.processingQueue, taskId] })

        try {
          // Here you would call the actual API to create the task
          // For now, we'll simulate success
          console.log('Processing task to board:', task.title, '→', boardId)
          
          // Mark as processed and remove from staging
          get().removeFromStaging(taskId)
          return true
        } catch (error) {
          console.error('Failed to process task:', error)
          return false
        } finally {
          set(state => ({
            isProcessing: false,
            processingQueue: state.processingQueue.filter(id => id !== taskId)
          }))
        }
      },

      // Bulk process multiple tasks
      bulkProcessTasks: async (taskIds: string[], boardId: string) => {
        let successCount = 0
        
        for (const taskId of taskIds) {
          const success = await get().processToBoard(taskId, boardId)
          if (success) successCount++
        }
        
        return successCount
      },

      // Clear all staging
      clearStaging: () => {
        set({ stagedTasks: [] })
      },

      // Get staging statistics
      getStagingStats: (): StagingStats => {
        const tasks = get().stagedTasks
        
        const bySource = tasks.reduce((acc, task) => {
          acc[task.source] = (acc[task.source] || 0) + 1
          return acc
        }, {} as Record<StagedTask['source'], number>)

        return {
          total: tasks.length,
          highConfidence: tasks.filter(t => t.confidence >= 0.8).length,
          needsReview: tasks.filter(t => t.confidence < 0.6 || t.suggestedImprovements.length > 0).length,
          duplicates: tasks.filter(t => t.duplicateOf).length,
          bySource,
          averageConfidence: tasks.length > 0 
            ? tasks.reduce((sum, t) => sum + t.confidence, 0) / tasks.length 
            : 0
        }
      },

      // Find potential duplicates based on title similarity
      findDuplicates: (task: StagedTask): string[] => {
        const state = get()
        const duplicates: string[] = []
        
        const taskTitle = task.title.toLowerCase().trim()
        
        for (const existingTask of state.stagedTasks) {
          if (existingTask.id === task.id) continue
          
          const existingTitle = existingTask.title.toLowerCase().trim()
          
          // Simple similarity check - could be enhanced with better algorithms
          const similarity = calculateSimilarity(taskTitle, existingTitle)
          
          if (similarity > 0.7) { // 70% similarity threshold
            duplicates.push(existingTask.id)
          }
        }
        
        return duplicates
      },

      // Categorize task based on content
      categorizeTask: (task: StagedTask): StagedTask['detectedCategory'] => {
        const text = `${task.title} ${task.summary || ''}`.toLowerCase()
        
        // Urgent indicators
        if (text.includes('urgent') || text.includes('asap') || text.includes('emergency')) {
          return 'urgent'
        }
        
        // Work indicators
        if (text.includes('meeting') || text.includes('project') || text.includes('deadline') || 
            text.includes('client') || text.includes('work') || text.includes('office')) {
          return 'work'
        }
        
        // Health indicators
        if (text.includes('doctor') || text.includes('health') || text.includes('exercise') || 
            text.includes('medication') || text.includes('appointment')) {
          return 'health'
        }
        
        // Learning indicators
        if (text.includes('learn') || text.includes('study') || text.includes('course') || 
            text.includes('read') || text.includes('research')) {
          return 'learning'
        }
        
        // Creative indicators
        if (text.includes('design') || text.includes('create') || text.includes('write') || 
            text.includes('brainstorm') || text.includes('art')) {
          return 'creative'
        }
        
        // Admin indicators
        if (text.includes('email') || text.includes('call') || text.includes('schedule') || 
            text.includes('organize') || text.includes('file') || text.includes('update')) {
          return 'admin'
        }
        
        return 'personal' // Default
      },

      // Enhance single task with AI suggestions
      enhanceTask: (taskId: string) => {
        const state = get()
        const task = state.stagedTasks.find(t => t.id === taskId)
        if (!task || task.processed) return

        const improvements: StagedTask['suggestedImprovements'] = []
        
        // Check for missing duration
        if (!task.estimateMin) {
          const predicted = predictDuration(task.title, task.summary)
          improvements.push({
            type: 'duration_estimate',
            message: 'No time estimate provided',
            suggestion: `Suggested: ${predicted} minutes`,
            autoFix: true
          })
          
          get().updateStagedTask(taskId, { 
            predictedDuration: predicted,
            suggestedImprovements: [...task.suggestedImprovements, ...improvements]
          })
        }

        // Check for unclear priority
        if (!task.priority) {
          const predicted = predictPriority(task.title, task.summary)
          improvements.push({
            type: 'unclear_priority',
            message: 'Priority not specified',
            suggestion: `Suggested: ${predicted}`,
            autoFix: true
          })
          
          get().updateStagedTask(taskId, { 
            suggestedPriority: predicted
          })
        }

        // Check for missing energy level
        if (!task.energy) {
          const predicted = predictEnergy(task.title, task.summary)
          improvements.push({
            type: 'energy_mismatch',
            message: 'Energy level not specified',
            suggestion: `Suggested: ${predicted}`,
            autoFix: true
          })
          
          get().updateStagedTask(taskId, { 
            suggestedEnergy: predicted
          })
        }

        // Check for missing context
        if (!task.summary || task.summary.length < 20) {
          improvements.push({
            type: 'missing_context',
            message: 'Task could use more detail',
            suggestion: 'Add information about what needs to be done and why',
            autoFix: false
          })
        }

        // Auto-generate labels based on content
        const suggestedLabels = generateLabels(task.title, task.summary, task.detectedCategory)
        
        // Update task with all enhancements
        if (improvements.length > 0 || suggestedLabels.length > 0) {
          get().updateStagedTask(taskId, {
            suggestedImprovements: [...task.suggestedImprovements, ...improvements],
            suggestedLabels: [...task.suggestedLabels, ...suggestedLabels]
          })
        }
      },

      // Run auto-enhancement on all unprocessed tasks
      runAutoEnhancement: () => {
        const state = get()
        const unprocessedTasks = state.stagedTasks.filter(t => !t.processed)
        
        unprocessedTasks.forEach(task => {
          get().enhanceTask(task.id)
        })
      }
    }),
    {
      name: STORAGE_KEYS.STAGING || 'taskeradhd-staging',
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      ),
      partialize: (state) => ({
        stagedTasks: state.stagedTasks.slice(-50), // Keep last 50 tasks
        autoEnhancement: state.autoEnhancement,
        duplicateDetection: state.duplicateDetection,
        confidenceThreshold: state.confidenceThreshold
      }),
      version: 1
    }
  )
)

// Helper functions
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

function predictDuration(title: string, summary?: string): number {
  const text = `${title} ${summary || ''}`.toLowerCase()
  
  if (text.includes('call') || text.includes('email') || text.includes('quick')) return 10
  if (text.includes('meeting') || text.includes('review')) return 30
  if (text.includes('write') || text.includes('plan')) return 45
  if (text.includes('develop') || text.includes('create')) return 60
  
  return 25 // Default
}

function predictPriority(title: string, summary?: string): TaskPriority {
  const text = `${title} ${summary || ''}`.toLowerCase()
  
  if (text.includes('urgent') || text.includes('asap')) return 'URGENT'
  if (text.includes('important') || text.includes('deadline')) return 'HIGH'
  if (text.includes('someday') || text.includes('maybe')) return 'LOW'
  
  return 'MEDIUM'
}

function predictEnergy(title: string, summary?: string): EnergyLevel {
  const text = `${title} ${summary || ''}`.toLowerCase()
  
  if (text.includes('create') || text.includes('design') || text.includes('brainstorm')) return 'HIGH'
  if (text.includes('email') || text.includes('organize') || text.includes('call')) return 'LOW'
  
  return 'MEDIUM'
}

function generateLabels(title: string, summary?: string, category?: string): string[] {
  const labels: string[] = []
  const text = `${title} ${summary || ''}`.toLowerCase()
  
  // Add category as label
  if (category && category !== 'personal') {
    labels.push(category)
  }
  
  // Extract common label patterns
  if (text.includes('meeting')) labels.push('meeting')
  if (text.includes('email')) labels.push('communication')
  if (text.includes('deadline') || text.includes('due')) labels.push('deadline')
  if (text.includes('call') || text.includes('phone')) labels.push('call')
  if (text.includes('research')) labels.push('research')
  if (text.includes('design')) labels.push('design')
  if (text.includes('write') || text.includes('writing')) labels.push('writing')
  
  return [...new Set(labels)] // Remove duplicates
}
