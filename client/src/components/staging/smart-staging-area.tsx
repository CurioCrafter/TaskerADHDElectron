'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBoardStore } from '@/stores/board'
import { useStagingStore } from '@/stores/staging'
import { useEnergyStore } from '@/stores/energy'
import { toast } from 'react-hot-toast'
import { taskUtils, dateUtils, arrayUtils, stringUtils } from '@/lib/utils'
import { TaskApi } from '@/services/api'
import type { Task, TaskPriority, EnergyLevel } from '@/types'

interface SmartStagingAreaProps {
  isOpen: boolean
  onClose: () => void
  className?: string
}

interface StagedTask extends Task {
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

export function SmartStagingArea({ isOpen, onClose, className = '' }: SmartStagingAreaProps) {
  const { currentBoard, createTask, boards } = useBoardStore()
  const { 
    stagedTasks, 
    addToStaging, 
    removeFromStaging, 
    updateStagedTask,
    processToBoard,
    bulkProcessTasks,
    getStagingStats
  } = useStagingStore()
  
  // Force refresh staging data when modal opens
  const [refreshKey, setRefreshKey] = useState(0)
  
  useEffect(() => {
    if (isOpen) {
      // Force a re-render by updating the key
      setRefreshKey(prev => prev + 1)
    }
  }, [isOpen])
  const { currentEnergyLevel, getRecommendedTasks } = useEnergyStore()

  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'approve' | 'enhance' | 'schedule' | 'delete' | ''>('')
  const [filterBy, setFilterBy] = useState<'all' | 'high_confidence' | 'needs_review' | 'duplicates'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'confidence' | 'priority' | 'source'>('newest')
  const [showAutoEnhance, setShowAutoEnhance] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Filter staged tasks based on current filter
  const filteredTasks = stagedTasks.filter(task => {
    switch (filterBy) {
      case 'high_confidence':
        return task.confidence >= 0.8
      case 'needs_review':
        return task.confidence < 0.6 || task.suggestedImprovements.length > 0
      case 'duplicates':
        return !!task.duplicateOf
      default:
        return true
    }
  })

  // Sort tasks
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case 'confidence':
        return b.confidence - a.confidence
      case 'priority':
        const priorityOrder = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
        return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
               (priorityOrder[a.priority as keyof typeof priorityOrder] || 0)
      case 'source':
        return a.source.localeCompare(b.source)
      default: // newest
        return new Date(b.stagedAt).getTime() - new Date(a.stagedAt).getTime()
    }
  })

  // Auto-enhance tasks when they arrive
  useEffect(() => {
    if (showAutoEnhance && stagedTasks.length > 0) {
      stagedTasks.forEach(task => {
        if (!task.processed && task.suggestedImprovements.length === 0) {
          enhanceTask(task.id)
        }
      })
    }
  }, [stagedTasks, showAutoEnhance])

  // Auto-enhance a single task with AI suggestions
  const enhanceTask = useCallback(async (taskId: string) => {
    const task = stagedTasks.find(t => t.id === taskId)
    if (!task) return

    const improvements: StagedTask['suggestedImprovements'] = []
    
    // Check for missing duration estimate
    if (!task.estimateMin || task.estimateMin === 0) {
      const predictedDuration = predictTaskDuration(task.title, task.summary)
      improvements.push({
        type: 'duration_estimate',
        message: 'No time estimate provided',
        suggestion: `Suggested: ${predictedDuration} minutes`,
        autoFix: true
      })
      
      updateStagedTask(taskId, { 
        predictedDuration,
        suggestedImprovements: improvements
      })
    }

    // Check for unclear priority
    if (!task.priority || task.priority === 'MEDIUM') {
      const suggestedPriority = predictTaskPriority(task.title, task.summary)
      if (suggestedPriority !== 'MEDIUM') {
        improvements.push({
          type: 'unclear_priority',
          message: 'Priority could be more specific',
          suggestion: `Suggested: ${suggestedPriority}`,
          autoFix: true
        })
      }
    }

    // Check for missing energy level
    if (!task.energy) {
      const suggestedEnergy = predictTaskEnergy(task.title, task.summary)
      improvements.push({
        type: 'energy_mismatch',
        message: 'No energy level assigned',
        suggestion: `Suggested: ${suggestedEnergy}`,
        autoFix: true
      })
    }

    // Check for missing context
    if (!task.summary || task.summary.length < 10) {
      improvements.push({
        type: 'missing_context',
        message: 'Task could use more context',
        suggestion: 'Add details about what needs to be done, why, and any constraints',
        autoFix: false
      })
    }

    // Update task with improvements
    if (improvements.length > 0) {
      updateStagedTask(taskId, { suggestedImprovements: improvements })
    }
  }, [stagedTasks, updateStagedTask])

  // AI prediction functions
  const predictTaskDuration = (title: string, summary?: string): number => {
    const text = `${title} ${summary || ''}`.toLowerCase()
    
    // Quick tasks (5-15 min)
    if (text.includes('call') || text.includes('email') || text.includes('quick') || text.includes('check')) {
      return 10
    }
    
    // Medium tasks (15-45 min)
    if (text.includes('write') || text.includes('review') || text.includes('plan') || text.includes('research')) {
      return 30
    }
    
    // Long tasks (45+ min)
    if (text.includes('develop') || text.includes('create') || text.includes('design') || text.includes('implement')) {
      return 60
    }
    
    return 25 // Default
  }

  const predictTaskPriority = (title: string, summary?: string): TaskPriority => {
    const text = `${title} ${summary || ''}`.toLowerCase()
    
    if (text.includes('urgent') || text.includes('asap') || text.includes('emergency') || text.includes('critical')) {
      return 'URGENT'
    }
    
    if (text.includes('important') || text.includes('deadline') || text.includes('due') || text.includes('meeting')) {
      return 'HIGH'
    }
    
    if (text.includes('whenever') || text.includes('someday') || text.includes('optional')) {
      return 'LOW'
    }
    
    return 'MEDIUM'
  }

  const predictTaskEnergy = (title: string, summary?: string): EnergyLevel => {
    const text = `${title} ${summary || ''}`.toLowerCase()
    
    // High energy: creative, complex, new
    if (text.includes('create') || text.includes('design') || text.includes('brainstorm') || 
        text.includes('develop') || text.includes('plan') || text.includes('strategy')) {
      return 'HIGH'
    }
    
    // Low energy: routine, administrative, simple
    if (text.includes('email') || text.includes('call') || text.includes('schedule') || 
        text.includes('organize') || text.includes('file') || text.includes('update')) {
      return 'LOW'
    }
    
    return 'MEDIUM'
  }

  // Apply auto-fixes to a task
  const applyAutoFixes = (taskId: string) => {
    const task = stagedTasks.find(t => t.id === taskId)
    if (!task) return

    const updates: Partial<StagedTask> = {}
    
    task.suggestedImprovements.forEach(improvement => {
      if (improvement.autoFix) {
        switch (improvement.type) {
          case 'duration_estimate':
            updates.estimateMin = task.predictedDuration
            break
          case 'unclear_priority':
            updates.priority = task.suggestedPriority
            break
          case 'energy_mismatch':
            updates.energy = task.suggestedEnergy
            break
        }
      }
    })

    // Remove auto-fixable improvements
    updates.suggestedImprovements = task.suggestedImprovements.filter(i => !i.autoFix)
    
    updateStagedTask(taskId, updates)
    toast.success('Auto-fixes applied!')
  }

  // Process single task to board
  const processTask = async (taskId: string) => {
    const task = stagedTasks.find(t => t.id === taskId)
    if (!task || !currentBoard) return

    setProcessing(true)
    try {
      // Create the task on the board
      const createdTask = await createTask({
        title: task.title,
        summary: task.summary,
        priority: task.priority,
        energy: task.energy,
        estimateMin: task.estimateMin,
        dueAt: task.dueAt,
        labels: task.suggestedLabels
      })

      if (createdTask) {
        removeFromStaging(taskId)
        toast.success(`Task "${task.title}" added to board!`)
      } else {
        toast.error('Failed to add task to board')
      }
    } catch (error) {
      console.error('Error processing task:', error)
      toast.error('Error processing task')
    } finally {
      setProcessing(false)
    }
  }

  // Bulk process selected tasks
  const processBulkAction = async () => {
    if (selectedTasks.size === 0 || !bulkAction) return

    setProcessing(true)
    try {
      const tasksToProcess = Array.from(selectedTasks)
      
      switch (bulkAction) {
        case 'approve':
          for (const taskId of tasksToProcess) {
            await processTask(taskId)
          }
          break
          
        case 'enhance':
          for (const taskId of tasksToProcess) {
            await enhanceTask(taskId)
          }
          toast.success(`Enhanced ${tasksToProcess.length} tasks`)
          break
          
        case 'delete':
          tasksToProcess.forEach(taskId => removeFromStaging(taskId))
          toast.success(`Removed ${tasksToProcess.length} tasks`)
          break
      }
      
      setSelectedTasks(new Set())
      setBulkAction('')
    } catch (error) {
      toast.error('Error processing bulk action')
    } finally {
      setProcessing(false)
    }
  }

  const getSourceIcon = (source: StagedTask['source']) => {
    switch (source) {
      case 'voice': return '🎤'
      case 'ai_chat': return '🤖'
      case 'manual': return '✍️'
      case 'import': return '📥'
      case 'calendar_sync': return '📅'
      default: return '📝'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400'
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  if (!isOpen) return null

  const stats = getStagingStats()

  return (
    <div key={refreshKey} className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              🔄 Smart Staging Area
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {stats.total} tasks • {stats.highConfidence} high confidence • {stats.needsReview} need review
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex items-center space-x-3">
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="input text-sm"
              >
                <option value="all">All Tasks ({stats.total})</option>
                <option value="high_confidence">High Confidence ({stats.highConfidence})</option>
                <option value="needs_review">Needs Review ({stats.needsReview})</option>
                <option value="duplicates">Duplicates ({stats.duplicates})</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input text-sm"
              >
                <option value="newest">Newest First</option>
                <option value="confidence">By Confidence</option>
                <option value="priority">By Priority</option>
                <option value="source">By Source</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedTasks.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedTasks.size} selected
                </span>
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value as any)}
                  className="input text-sm"
                >
                  <option value="">Bulk Actions...</option>
                  <option value="approve">✅ Approve All</option>
                  <option value="enhance">✨ Enhance All</option>
                  <option value="delete">🗑️ Delete All</option>
                </select>
                <button
                  onClick={processBulkAction}
                  disabled={!bulkAction || processing}
                  className="btn-primary btn-sm"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-6">
          {sortedTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📥</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No tasks in staging
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Tasks from voice capture and AI chat will appear here for review before being added to your board.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${
                    task.duplicateOf ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedTasks.has(task.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedTasks)
                          if (e.target.checked) {
                            newSelected.add(task.id)
                          } else {
                            newSelected.delete(task.id)
                          }
                          setSelectedTasks(newSelected)
                        }}
                        className="mt-1"
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {task.title}
                          </h4>
                          <span className="text-lg">{getSourceIcon(task.source)}</span>
                          <span className={`text-xs font-medium ${getConfidenceColor(task.confidence)}`}>
                            {Math.round(task.confidence * 100)}%
                          </span>
                        </div>
                        
                        {task.summary && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {task.summary}
                          </p>
                        )}
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          {task.priority && (
                            <span className={`px-2 py-1 rounded ${
                              task.priority === 'URGENT' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                              task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                              task.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                              'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            }`}>
                              {task.priority}
                            </span>
                          )}
                          {task.energy && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded">
                              {task.energy} Energy
                            </span>
                          )}
                          {task.estimateMin && (
                            <span>{task.estimateMin}min</span>
                          )}
                          <span>{dateUtils.formatRelative(task.stagedAt)}</span>
                        </div>
                        
                        {/* Improvements */}
                        {task.suggestedImprovements.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {task.suggestedImprovements.map((improvement, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                <span className="text-blue-700 dark:text-blue-300">
                                  💡 {improvement.message}
                                  {improvement.suggestion && `: ${improvement.suggestion}`}
                                </span>
                                {improvement.autoFix && (
                                  <button
                                    onClick={() => applyAutoFixes(task.id)}
                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                                  >
                                    Fix
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {task.suggestedImprovements.some(i => i.autoFix) && (
                        <button
                          onClick={() => applyAutoFixes(task.id)}
                          className="btn-ghost btn-sm"
                          title="Apply auto-fixes"
                        >
                          ✨ Fix
                        </button>
                      )}
                      <button
                        onClick={() => processTask(task.id)}
                        disabled={processing}
                        className="btn-primary btn-sm"
                        title="Add to board"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => removeFromStaging(task.id)}
                        className="btn-ghost btn-sm text-red-600"
                        title="Remove from staging"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
