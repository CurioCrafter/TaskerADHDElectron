'use client'

import { useState, useEffect } from 'react'
import { useBoardStore } from '@/stores/board'
import { toast } from 'react-hot-toast'
import type { Task, TaskPriority, EnergyLevel } from '@/types'

interface StagedTask extends Task {
  isStaged: boolean
  stagedAt: string
  source: 'voice' | 'manual' | 'import'
  confidence?: number
  aiGenerated?: boolean
  similarTasks?: Array<{ id: string; title: string; similarity: number }>
}

interface StagingAreaProps {
  isOpen: boolean
  onClose: () => void
}

export function StagingArea({ isOpen, onClose }: StagingAreaProps) {
  const [stagedTasks, setStagedTasks] = useState<StagedTask[]>([])
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [filterBy, setFilterBy] = useState<'all' | 'voice' | 'manual' | 'low-confidence'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'priority' | 'energy' | 'confidence'>('newest')
  const [bulkAction, setBulkAction] = useState<'accept' | 'schedule' | 'delete' | ''>('')

  const { currentBoard, moveTask, updateTask, deleteTask } = useBoardStore()

  // Sample staged tasks - in real app, would come from backend
  useEffect(() => {
    if (isOpen) {
      const sampleStagedTasks: StagedTask[] = [
        {
          id: 'staged_1',
          title: 'Call dentist about appointment',
          summary: 'Schedule routine cleaning appointment for next month',
          priority: 'MEDIUM',
          energy: 'LOW',
          estimateMin: 5,
          labels: [],
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          columnId: 'inbox',
          boardId: currentBoard?.id || '',
          position: 0,
          isStaged: true,
          stagedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
          source: 'voice',
          confidence: 0.92,
          aiGenerated: true
        },
        {
          id: 'staged_2',
          title: 'Review quarterly budget report',
          summary: 'Analyze spending patterns and identify areas for optimization',
          priority: 'HIGH',
          energy: 'HIGH',
          estimateMin: 45,
          dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days from now
          labels: [],
          subtasks: [
            { id: '1', taskId: '', title: 'Download reports', done: false, position: 0 },
            { id: '2', taskId: '', title: 'Analyze categories', done: false, position: 1 },
            { id: '3', taskId: '', title: 'Write summary', done: false, position: 2 }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          columnId: 'inbox',
          boardId: currentBoard?.id || '',
          position: 1,
          isStaged: true,
          stagedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
          source: 'voice',
          confidence: 0.78,
          aiGenerated: true,
          similarTasks: [
            { id: 'task_123', title: 'Monthly budget review', similarity: 0.85 }
          ]
        },
        {
          id: 'staged_3',
          title: 'Buy groceries for the week',
          summary: 'Weekly grocery shopping including items for meal prep',
          priority: 'LOW',
          energy: 'MEDIUM',
          estimateMin: 60,
          labels: [],
          subtasks: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          columnId: 'inbox',
          boardId: currentBoard?.id || '',
          position: 2,
          isStaged: true,
          stagedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 minutes ago
          source: 'manual',
          aiGenerated: false
        }
      ]
      setStagedTasks(sampleStagedTasks)
    }
  }, [isOpen, currentBoard])

  const filteredTasks = stagedTasks.filter(task => {
    switch (filterBy) {
      case 'voice': return task.source === 'voice'
      case 'manual': return task.source === 'manual'
      case 'low-confidence': return task.confidence && task.confidence < 0.8
      default: return true
    }
  })

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.stagedAt).getTime() - new Date(a.stagedAt).getTime()
      case 'priority':
        const priorityOrder = { 'URGENT': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
        return (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) - 
               (priorityOrder[a.priority as keyof typeof priorityOrder] || 0)
      case 'energy':
        const energyOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
        return (energyOrder[b.energy as keyof typeof energyOrder] || 0) - 
               (energyOrder[a.energy as keyof typeof energyOrder] || 0)
      case 'confidence':
        return (b.confidence || 0) - (a.confidence || 0)
      default:
        return 0
    }
  })

  const handleTaskToggle = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleSelectAll = () => {
    setSelectedTasks(new Set(sortedTasks.map(t => t.id)))
  }

  const handleSelectNone = () => {
    setSelectedTasks(new Set())
  }

  const handleAcceptTasks = async (taskIds: string[]) => {
    const tasksToAccept = stagedTasks.filter(t => taskIds.includes(t.id))
    
    try {
      // Move tasks to appropriate columns based on their priority/energy and board type
      for (const task of tasksToAccept) {
        let targetColumnName = 'Inbox' // Default
        
        // Smart column assignment based on board type
        if (currentBoard?.type === 'PROJECT') {
          // For project boards, use different logic
          if (task.priority === 'URGENT') {
            targetColumnName = 'To Do' // Urgent tasks go directly to To Do
          } else if (task.energy === 'LOW' && task.estimateMin && task.estimateMin <= 15) {
            targetColumnName = 'To Do' // Quick wins go to To Do
          } else {
            targetColumnName = 'Backlog' // Most tasks go to backlog for project planning
          }
        } else {
          // For personal boards, use original logic
          if (task.priority === 'URGENT' || (task.energy === 'LOW' && task.estimateMin && task.estimateMin <= 15)) {
            targetColumnName = 'To Do' // Move urgent or quick tasks directly to todo
          } else if (task.dueAt && new Date(task.dueAt).getTime() <= Date.now() + 24 * 60 * 60 * 1000) {
            targetColumnName = 'To Do' // Due within 24 hours
          }
        }

        // Find the actual column ID by name
        const targetColumn = currentBoard?.columns?.find(col => 
          col.name.toLowerCase() === targetColumnName.toLowerCase()
        ) || currentBoard?.columns?.[0] // Fallback to first column

        if (targetColumn) {
          await moveTask(task.id, targetColumn.id, 0)
        }
      }

      // Remove from staging
      setStagedTasks(prev => prev.filter(t => !taskIds.includes(t.id)))
      setSelectedTasks(prev => {
        const newSet = new Set(prev)
        taskIds.forEach(id => newSet.delete(id))
        return newSet
      })

      toast.success(`✅ Accepted ${tasksToAccept.length} task${tasksToAccept.length > 1 ? 's' : ''}`)
    } catch (error) {
      console.error('Failed to accept tasks:', error)
      toast.error('Failed to accept tasks')
    }
  }

  const handleScheduleTasks = (taskIds: string[]) => {
    // TODO: Open scheduling modal
    toast('Scheduling feature coming soon!')
  }

  const handleDeleteTasks = async (taskIds: string[]) => {
    try {
      for (const taskId of taskIds) {
        await deleteTask(taskId)
      }

      setStagedTasks(prev => prev.filter(t => !taskIds.includes(t.id)))
      setSelectedTasks(prev => {
        const newSet = new Set(prev)
        taskIds.forEach(id => newSet.delete(id))
        return newSet
      })

      toast.success(`🗑️ Deleted ${taskIds.length} task${taskIds.length > 1 ? 's' : ''}`)
    } catch (error) {
      console.error('Failed to delete tasks:', error)
      toast.error('Failed to delete tasks')
    }
  }

  const handleBulkAction = () => {
    if (selectedTasks.size === 0) {
      toast.error('Please select tasks first')
      return
    }

    const selectedTaskIds = Array.from(selectedTasks)

    switch (bulkAction) {
      case 'accept':
        handleAcceptTasks(selectedTaskIds)
        break
      case 'schedule':
        handleScheduleTasks(selectedTaskIds)
        break
      case 'delete':
        if (confirm(`Are you sure you want to delete ${selectedTaskIds.length} tasks?`)) {
          handleDeleteTasks(selectedTaskIds)
        }
        break
    }

    setBulkAction('')
  }

  const getTimeAgo = (timestamp: string) => {
    const now = Date.now()
    const time = new Date(timestamp).getTime()
    const diff = now - time

    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return ''
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400'
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getPriorityColor = (priority?: TaskPriority) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200'
      case 'MEDIUM': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
      case 'LOW': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getEnergyColor = (energy?: EnergyLevel) => {
    switch (energy) {
      case 'HIGH': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200'
      case 'MEDIUM': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200'
      case 'LOW': return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200'
      default: return 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              📥 Task Staging Area
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review and organize tasks before adding them to your board
              {currentBoard && (
                <span className="block">
                  Target: {currentBoard.type === 'PROJECT' ? '📋' : '📝'} {currentBoard.name}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Selection & Filters */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button onClick={handleSelectAll} className="btn-ghost btn-sm">
                  Select All
                </button>
                <button onClick={handleSelectNone} className="btn-ghost btn-sm">
                  None
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedTasks.size} of {sortedTasks.length} selected
                </span>
              </div>

              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as any)}
                className="input w-auto"
              >
                <option value="all">All Sources</option>
                <option value="voice">Voice Generated</option>
                <option value="manual">Manual Entry</option>
                <option value="low-confidence">Low Confidence</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="input w-auto"
              >
                <option value="newest">Newest First</option>
                <option value="priority">Priority</option>
                <option value="energy">Energy Level</option>
                <option value="confidence">Confidence</option>
              </select>
            </div>

            {/* Bulk Actions */}
            <div className="flex items-center space-x-2">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as any)}
                className="input w-auto"
                disabled={selectedTasks.size === 0}
              >
                <option value="">Bulk Action...</option>
                <option value="accept">✅ Accept Selected</option>
                <option value="schedule">📅 Schedule Selected</option>
                <option value="delete">🗑️ Delete Selected</option>
              </select>
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction || selectedTasks.size === 0}
                className="btn-primary"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-6">
          {sortedTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📥</div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                No staged tasks
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                New tasks from voice capture will appear here for review
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTasks.map((task) => (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 transition-all ${
                    selectedTasks.has(task.id)
                      ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-700'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Selection */}
                    <input
                      type="checkbox"
                      checked={selectedTasks.has(task.id)}
                      onChange={() => handleTaskToggle(task.id)}
                      className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 flex-1">
                          {task.title}
                        </h4>
                        <div className="flex items-center space-x-2 ml-4">
                          {/* Source */}
                          <span className={`text-xs px-2 py-1 rounded ${
                            task.source === 'voice' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200' :
                            task.source === 'manual' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {task.source === 'voice' ? '🎤 Voice' : '✏️ Manual'}
                          </span>

                          {/* Confidence */}
                          {task.confidence && (
                            <span className={`text-xs px-2 py-1 rounded ${getConfidenceColor(task.confidence)}`}>
                              {Math.round(task.confidence * 100)}%
                            </span>
                          )}

                          {/* Time */}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {getTimeAgo(task.stagedAt)}
                          </span>
                        </div>
                      </div>

                      {/* Summary */}
                      {task.summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {task.summary}
                        </p>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {task.priority && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                            {task.priority.toLowerCase()}
                          </span>
                        )}

                        {task.energy && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getEnergyColor(task.energy)}`}>
                            {task.energy === 'HIGH' && '🚀'}
                            {task.energy === 'MEDIUM' && '⚡'}
                            {task.energy === 'LOW' && '🌱'} {task.energy.toLowerCase()}
                          </span>
                        )}

                        {task.estimateMin && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                            ⏱️ {task.estimateMin}m
                          </span>
                        )}

                        {task.dueAt && (
                          <span className="text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                            📅 {new Date(task.dueAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Subtasks */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Subtasks ({task.subtasks.length}):
                          </p>
                          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            {task.subtasks.slice(0, 3).map((subtask, idx) => (
                              <li key={idx} className="flex items-center space-x-1">
                                <span className="text-gray-400">•</span>
                                <span>{subtask.title}</span>
                              </li>
                            ))}
                            {task.subtasks.length > 3 && (
                              <li className="text-gray-400">
                                ... and {task.subtasks.length - 3} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {/* Similar Tasks Warning */}
                      {task.similarTasks && task.similarTasks.length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-2 mb-3">
                          <p className="text-xs font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                            ⚠️ Similar tasks found:
                          </p>
                          {task.similarTasks.map((similar, idx) => (
                            <p key={idx} className="text-xs text-yellow-800 dark:text-yellow-200">
                              • "{similar.title}" ({Math.round(similar.similarity * 100)}% similar)
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleAcceptTasks([task.id])}
                          className="btn-primary btn-sm"
                        >
                          ✅ Accept
                        </button>
                        <button
                          onClick={() => handleScheduleTasks([task.id])}
                          className="btn-secondary btn-sm"
                        >
                          📅 Schedule
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${task.title}"?`)) {
                              handleDeleteTasks([task.id])
                            }
                          }}
                          className="btn-ghost btn-sm text-red-600 hover:text-red-700"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              💡 Tasks from voice capture are staged here for review
              {currentBoard?.type === 'PROJECT' && (
                <span className="block">
                  📋 Project tasks will be organized by {currentBoard.name} workflow
                </span>
              )}
            </div>
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
