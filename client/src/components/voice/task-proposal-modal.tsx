'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import type { TaskProposal, TaskShapingResult } from '@/services/llm/task-shaper'
import { useBoardStore } from '@/stores/board'
import { useStagingStore } from '@/stores/staging'

interface TaskProposalModalProps {
  isOpen: boolean
  onClose: () => void
  proposals: TaskShapingResult | null
  transcript: string
  useStaging?: boolean
}

interface CreatedTaskSummary {
  title: string
  summary?: string
  priority?: string
  energy?: string
  dueAt?: string
  estimateMin?: number
  labels: string[]
  isRepeatable: boolean
  repeatPattern?: string
  repeatInterval?: number
  repeatDays?: number[]
  repeatEndDate?: string
  repeatCount?: number
  confidence?: number
  source: string
}

export function TaskProposalModal({ isOpen, onClose, proposals, transcript, useStaging = false }: TaskProposalModalProps) {
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [editedTasks, setEditedTasks] = useState<Map<string, Partial<TaskProposal>>>(new Map())
  const [isCreating, setIsCreating] = useState(false)
  const [showSuccessSummary, setShowSuccessSummary] = useState(false)
  const [createdTasks, setCreatedTasks] = useState<CreatedTaskSummary[]>([])
  
  const { currentBoard, createTask } = useBoardStore()
  const { addToStaging } = useStagingStore()

  // Select all tasks by default
  useEffect(() => {
    if (proposals?.tasks) {
      setSelectedTasks(new Set(proposals.tasks.map(t => t.id)))
    }
  }, [proposals])

  if (!isOpen || !proposals) return null

  const handleTaskToggle = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleEditTask = (taskId: string, field: string, value: any) => {
    const newEdited = new Map(editedTasks)
    const currentEdits = newEdited.get(taskId) || {}
    newEdited.set(taskId, { ...currentEdits, [field]: value })
    setEditedTasks(newEdited)
  }

  const getTaskData = (task: TaskProposal): TaskProposal => {
    const edits = editedTasks.get(task.id) || {}
    return { ...task, ...edits }
  }

  const handleAcceptSelected = async () => {
    const selectedTasksArray = proposals.tasks.filter(t => selectedTasks.has(t.id))
    
    if (selectedTasksArray.length === 0) {
      toast.error('Please select at least one task to create')
      return
    }

    // Debug: log the staging decision
    console.log('🔧 [TASK_PROPOSAL] Staging decision:', {
      useStaging,
      currentBoard: !!currentBoard,
      willUseStaging: !currentBoard || useStaging,
      selectedTasksCount: selectedTasksArray.length
    })

    setIsCreating(true)
    let successCount = 0
    const createdTaskSummaries: CreatedTaskSummary[] = []

    try {
      for (const task of selectedTasksArray) {
        const finalTask = getTaskData(task)
        
        try {
          if (currentBoard && !useStaging) {
            // Create directly on the current board when staging is OFF
            await createTask({
              title: finalTask.title,
              summary: finalTask.summary,
              priority: finalTask.priority as any,
              energy: finalTask.energy as any,
              dueAt: finalTask.dueAt,
              estimateMin: finalTask.estimateMin,
              isRepeatable: finalTask.isRepeatable || false
            })
            
            // Add to success summary
            createdTaskSummaries.push({
              title: finalTask.title,
              summary: finalTask.summary,
              priority: finalTask.priority,
              energy: finalTask.energy,
              dueAt: finalTask.dueAt,
              estimateMin: finalTask.estimateMin,
              labels: finalTask.labels || [],
              isRepeatable: finalTask.isRepeatable || false,
              repeatPattern: finalTask.repeatPattern,
              repeatInterval: finalTask.repeatInterval,
              repeatDays: finalTask.repeatDays,
              repeatEndDate: finalTask.repeatEndDate,
              repeatCount: finalTask.repeatCount,
              confidence: finalTask.confidence,
              source: 'board'
            })
            
            successCount++
          } else {
            // Send to staging when staging is ON or no board available
            addToStaging({
              title: finalTask.title,
              summary: finalTask.summary,
              priority: finalTask.priority,
              energy: finalTask.energy,
              dueAt: finalTask.dueAt,
              estimateMin: finalTask.estimateMin,
              labels: finalTask.labels || [],
              subtasks: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              position: 0,
              isRepeatable: finalTask.isRepeatable,
              
              // Staging-specific metadata
              source: 'voice',
              confidence: finalTask.confidence || 0.8,
              suggestedImprovements: [],
              relatedTasks: [],
              suggestedLabels: finalTask.labels || [],
              detectedCategory: 'work' // Default category
            })
            
            // Add to success summary
            createdTaskSummaries.push({
              title: finalTask.title,
              summary: finalTask.summary,
              priority: finalTask.priority,
              energy: finalTask.energy,
              dueAt: finalTask.dueAt,
              estimateMin: finalTask.estimateMin,
              labels: finalTask.labels || [],
              isRepeatable: finalTask.isRepeatable || false,
              repeatPattern: finalTask.repeatPattern,
              repeatInterval: finalTask.repeatInterval,
              repeatDays: finalTask.repeatDays,
              repeatEndDate: finalTask.repeatEndDate,
              repeatCount: finalTask.repeatCount,
              confidence: finalTask.confidence,
              source: 'staging'
            })
            
            successCount++
          }
        } catch (error) {
          console.error('Failed to create task:', finalTask.title, error)
        }
      }

      if (successCount > 0) {
        // Set the created tasks for the success summary
        setCreatedTasks(createdTaskSummaries)
        setShowSuccessSummary(true)
        
        if (useStaging) {
          toast.success(`📥 Sent ${successCount} task${successCount > 1 ? 's' : ''} to staging for review!`)
        } else {
          toast.success(`✅ Created ${successCount} task${successCount > 1 ? 's' : ''} directly on your board!`)
        }
      } else {
        toast.error('Failed to create tasks')
      }

    } catch (error) {
      console.error('Task staging error:', error)
      toast.error('Failed to stage tasks')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectAll = () => {
    setSelectedTasks(new Set(proposals.tasks.map(t => t.id)))
  }

  const handleSelectNone = () => {
    setSelectedTasks(new Set())
  }

  const handleCloseSuccessSummary = () => {
    setShowSuccessSummary(false)
    setCreatedTasks([])
    onClose()
  }

  const handleCreateMoreTasks = () => {
    setShowSuccessSummary(false)
    setCreatedTasks([])
    // Reset the form to allow creating more tasks
    setSelectedTasks(new Set())
    setEditedTasks(new Map())
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400'
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200'
      case 'MEDIUM': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
      case 'LOW': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getEnergyColor = (energy?: string) => {
    switch (energy) {
      case 'HIGH': return 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200'
      case 'MEDIUM': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-200'
      case 'LOW': return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200'
      default: return 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  // Success Summary Modal
  if (showSuccessSummary) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                🎉 Tasks Created Successfully!
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Here's a summary of what was created from your voice input
              </p>
            </div>
            <button
              onClick={handleCloseSuccessSummary}
              className="btn-ghost p-2"
              aria-label="Close summary"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Original Input */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                🎤 Your Voice Input
              </h3>
              <p className="text-blue-800 dark:text-blue-200 italic">"{transcript}"</p>
            </div>

            {/* Created Tasks Summary */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                📋 Created Tasks ({createdTasks.length})
              </h3>
              
              {createdTasks.map((task, index) => (
                <div key={index} className="border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-medium text-green-900 dark:text-green-100 text-lg">
                      {index + 1}. {task.title}
                    </h4>
                    <span className={`text-sm px-2 py-1 rounded-full ${
                      task.source === 'board' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                        : 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200'
                    }`}>
                      {task.source === 'board' ? '✅ On Board' : '📥 In Staging'}
                    </span>
                  </div>

                  {/* Description */}
                  {task.summary && (
                    <p className="text-green-800 dark:text-green-200 mb-3">
                      {task.summary}
                    </p>
                  )}

                  {/* Task Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    {/* Priority & Energy */}
                    <div className="space-y-2">
                      {task.priority && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">Priority:</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                            {task.priority.toLowerCase()}
                          </span>
                        </div>
                      )}
                      
                      {task.energy && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">Energy:</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getEnergyColor(task.energy)}`}>
                            {task.energy === 'HIGH' && '🚀'}
                            {task.energy === 'MEDIUM' && '⚡'}
                            {task.energy === 'LOW' && '🌱'} {task.energy.toLowerCase()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Time & Date */}
                    <div className="space-y-2">
                      {task.estimateMin && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">Estimated Time:</span>
                          <span className="text-sm text-green-700 dark:text-green-300">
                            ⏱️ {task.estimateMin} minutes
                          </span>
                        </div>
                      )}
                      
                      {task.dueAt && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-green-800 dark:text-green-200">Due Date:</span>
                          <span className="text-sm text-green-700 dark:text-green-300">
                            📅 {new Date(task.dueAt).toLocaleDateString()} at {new Date(task.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Labels */}
                  {task.labels && task.labels.length > 0 && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-green-800 dark:text-green-200 mr-2">Labels:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {task.labels.map((label, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded"
                          >
                            #{label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recurring Task Details */}
                  {task.isRepeatable && (
                    <div className="mt-3 p-3 bg-green-100 dark:bg-green-800/30 rounded-lg border border-green-200 dark:border-green-600">
                      <h5 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                        🔄 Recurring Task Details
                      </h5>
                      <div className="grid grid-cols-2 gap-2 text-sm text-green-700 dark:text-green-300">
                        {task.repeatPattern && (
                          <div>
                            <span className="font-medium">Pattern:</span> {task.repeatPattern}
                            {task.repeatInterval && task.repeatInterval > 1 && ` every ${task.repeatInterval} ${task.repeatPattern === 'DAILY' ? 'days' : task.repeatPattern === 'WEEKLY' ? 'weeks' : task.repeatPattern === 'MONTHLY' ? 'months' : 'times'}`}
                          </div>
                        )}
                        {task.repeatDays && task.repeatDays.length > 0 && (
                          <div>
                            <span className="font-medium">Days:</span> {task.repeatDays.map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')}
                          </div>
                        )}
                        {task.repeatCount && (
                          <div>
                            <span className="font-medium">Occurrences:</span> {task.repeatCount} times
                          </div>
                        )}
                        {task.repeatEndDate && (
                          <div>
                            <span className="font-medium">Ends:</span> {new Date(task.repeatEndDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AI Confidence */}
                  {task.confidence && (
                    <div className="mt-2 flex items-center space-x-2">
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">AI Confidence:</span>
                      <span className={`text-sm px-2 py-1 rounded-full ${
                        task.confidence >= 0.8 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                          : task.confidence >= 0.6
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                      }`}>
                        {Math.round(task.confidence * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Next Steps */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                🚀 Next Steps
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                {createdTasks.some(t => t.source === 'board') && (
                  <li>• Tasks created on your board are ready to work on</li>
                )}
                {createdTasks.some(t => t.source === 'staging') && (
                  <li>• Tasks sent to staging need your review before going live</li>
                )}
                <li>• You can edit any task details directly on the board</li>
                <li>• Set reminders and track progress as you work</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <div className="flex justify-between">
              <button
                onClick={handleCreateMoreTasks}
                className="btn-secondary"
              >
                ➕ Create More Tasks
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={handleCloseSuccessSummary}
                  className="btn-primary"
                >
                  ✅ Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              🤖 AI Task Proposals
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Review and edit AI-generated tasks from your voice transcript
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost p-2"
            aria-label="Close proposals"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Transcript & Summary */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Original Transcript */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  📝 Original Transcript
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
                  "{transcript}"
                </div>
              </div>

              {/* AI Summary */}
              {proposals.summary && (
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    🤖 AI Summary
                  </h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
                    {proposals.summary}
                  </div>
                </div>
              )}

              {/* Clarifying Questions */}
              {proposals.tasks.some(task => task.title.includes('❓') || task.title.includes('Need more details')) && (
                <div className="mt-4">
                  <h3 className="font-medium text-orange-900 dark:text-orange-100 mb-2">
                    ❓ Clarifying Questions Needed
                  </h3>
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                    <p className="text-orange-800 dark:text-orange-200 text-sm mb-3">
                      The AI needs more specific details to create proper tasks. Please provide:
                    </p>
                    <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-2">
                      {proposals.tasks
                        .filter(task => task.title.includes('❓') || task.title.includes('Need more details'))
                        .map(task => (
                          <li key={task.id} className="flex items-start space-x-2">
                            <span className="text-orange-600 dark:text-orange-400 mt-0.5">•</span>
                            <div>
                              <div className="font-medium">{task.title.replace('❓ Need more details: ', '')}</div>
                              {task.summary && (
                                <div className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                                  {task.summary}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                    </ul>
                    <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded border border-orange-200 dark:border-orange-600">
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        <strong>Tip:</strong> Try being more specific about time, day, location, or frequency. 
                        For example: "Every Saturday at 6pm" instead of "every weekend"
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Processing Stats */}
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Processed in {proposals.processingTime}ms</span>
              <span>{proposals.tasks.length} task{proposals.tasks.length !== 1 ? 's' : ''} proposed</span>
            </div>
          </div>

          {/* Task Selection Controls */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select tasks to create:
                </span>
                <button onClick={handleSelectAll} className="btn-ghost btn-sm">
                  Select All
                </button>
                <button onClick={handleSelectNone} className="btn-ghost btn-sm">
                  Select None
                </button>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {selectedTasks.size} of {proposals.tasks.length} selected
              </span>
            </div>

            {/* Uncertainties Warning */}
            {proposals.uncertainties && proposals.uncertainties.length > 0 && (
              <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                  ⚠️ Uncertainties Detected
                </h4>
                <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                  {proposals.uncertainties.map((unc, idx) => (
                    <li key={idx}>
                      • <strong>{unc.field}:</strong> "{unc.value}" - {unc.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Task Proposals */}
          <div className="p-6 space-y-4">
            {proposals.tasks.map((task, index) => {
              const finalTask = getTaskData(task)
              const isSelected = selectedTasks.has(task.id)
              const isEditing = editingTask === task.id

              return (
                <div
                  key={task.id}
                  className={`border rounded-lg p-4 transition-all ${
                    isSelected 
                      ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-700' 
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTaskToggle(task.id)}
                      className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />

                    {/* Task Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <div className="flex items-center justify-between mb-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={finalTask.title}
                            onChange={(e) => handleEditTask(task.id, 'title', e.target.value)}
                            className="input flex-1 mr-2"
                            autoFocus
                          />
                        ) : (
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 flex-1">
                            {index + 1}. {finalTask.title}
                          </h4>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          {/* Repeatable Badge */}
                          {finalTask.isRepeatable && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                              🔄 Repeatable
                            </span>
                          )}
                          
                          {/* Confidence Badge */}
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            (finalTask.confidence || 0) >= 0.8 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                              : (finalTask.confidence || 0) >= 0.6
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                          }`}>
                            {Math.round((finalTask.confidence || 0) * 100)}% confidence
                          </span>
                          
                          {/* Edit Button */}
                          <button
                            onClick={() => setEditingTask(isEditing ? null : task.id)}
                            className="btn-ghost btn-sm p-1"
                            title={isEditing ? 'Cancel edit' : 'Edit task'}
                          >
                            {isEditing ? '✕' : '✏️'}
                          </button>
                        </div>
                      </div>

                      {/* Summary */}
                      {finalTask.summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {finalTask.summary}
                        </p>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {/* Priority */}
                        {finalTask.priority && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(finalTask.priority)}`}>
                            {finalTask.priority.toLowerCase()}
                          </span>
                        )}

                        {/* Energy */}
                        {finalTask.energy && (
                          <span className={`text-xs px-2 py-1 rounded-full ${getEnergyColor(finalTask.energy)}`}>
                            {finalTask.energy === 'HIGH' && '🚀'}
                            {finalTask.energy === 'MEDIUM' && '⚡'}
                            {finalTask.energy === 'LOW' && '🌱'} {finalTask.energy.toLowerCase()}
                          </span>
                        )}

                        {/* Estimate */}
                        {finalTask.estimateMin && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                            ⏱️ {finalTask.estimateMin}m
                          </span>
                        )}

                        {/* Due Date */}
                        {finalTask.dueAt && (
                          <span className="text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                            📅 {new Date(finalTask.dueAt).toLocaleDateString()}
                          </span>
                        )}

                        {/* Repeatable Indicator */}
                        {finalTask.isRepeatable && (
                          <span className="text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                            🔄 Repeatable
                          </span>
                        )}

                        {/* Repeat Pattern Details */}
                        {finalTask.isRepeatable && finalTask.repeatPattern && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                            📅 {finalTask.repeatPattern} {finalTask.repeatInterval && finalTask.repeatInterval > 1 ? `every ${finalTask.repeatInterval} ${finalTask.repeatPattern === 'daily' ? 'days' : finalTask.repeatPattern === 'weekly' ? 'weeks' : finalTask.repeatPattern === 'monthly' ? 'months' : 'times'}` : ''}
                          </span>
                        )}

                        {/* Repeat Days */}
                        {finalTask.isRepeatable && finalTask.repeatDays && finalTask.repeatDays.length > 0 && (
                          <span className="text-xs bg-indigo-100 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-200 px-2 py-1 rounded">
                            📆 {finalTask.repeatDays.map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')}
                          </span>
                        )}

                        {/* Repeat Count */}
                        {finalTask.isRepeatable && finalTask.repeatCount && (
                          <span className="text-xs bg-teal-100 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200 px-2 py-1 rounded">
                            🔢 {finalTask.repeatCount} times
                          </span>
                        )}

                        {/* Repeat End Date */}
                        {finalTask.isRepeatable && finalTask.repeatEndDate && (
                          <span className="text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 px-2 py-1 rounded">
                            🎯 Until {new Date(finalTask.repeatEndDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Labels */}
                      {finalTask.labels && finalTask.labels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {finalTask.labels.map((label, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-primary-100 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200 px-2 py-1 rounded"
                            >
                              #{label}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Detailed Repeatable Information */}
                      {finalTask.isRepeatable && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                            🔄 Recurring Task Details
                          </h5>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
                            {finalTask.repeatPattern && (
                              <div>
                                <span className="font-medium">Pattern:</span> {finalTask.repeatPattern}
                                {finalTask.repeatInterval && finalTask.repeatInterval > 1 && ` every ${finalTask.repeatInterval} ${finalTask.repeatPattern === 'daily' ? 'days' : finalTask.repeatPattern === 'weekly' ? 'weeks' : finalTask.repeatPattern === 'monthly' ? 'months' : 'times'}`}
                              </div>
                            )}
                            {finalTask.repeatDays && finalTask.repeatDays.length > 0 && (
                              <div>
                                <span className="font-medium">Days:</span> {finalTask.repeatDays.map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')}
                              </div>
                            )}
                            {finalTask.repeatCount && (
                              <div>
                                <span className="font-medium">Occurrences:</span> {finalTask.repeatCount} times
                              </div>
                            )}
                            {finalTask.repeatEndDate && (
                              <div>
                                <span className="font-medium">Ends:</span> {new Date(finalTask.repeatEndDate).toLocaleDateString()}
                              </div>
                            )}
                            {finalTask.dueAt && (
                              <div>
                                <span className="font-medium">Next Due:</span> {new Date(finalTask.dueAt).toLocaleDateString()} at {new Date(finalTask.dueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Subtasks */}
                      {finalTask.subtasks && finalTask.subtasks.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Subtasks:</p>
                          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            {finalTask.subtasks.map((subtask, idx) => (
                              <li key={idx} className="flex items-center space-x-1">
                                <span className="text-gray-400">•</span>
                                <span>{subtask}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* AI Reasoning */}
                      {task.reasoning && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                            🤖 AI Reasoning
                          </summary>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 ml-4">
                            {task.reasoning}
                          </p>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Duplicate Warnings */}
          {proposals.dedupeCandidates && proposals.dedupeCandidates.length > 0 && (
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
              <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                🔍 Possible Duplicates
              </h3>
              <div className="space-y-2">
                {proposals.dedupeCandidates.map((dup, idx) => (
                  <div key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">
                    • Task similar to existing "{dup.taskId}" ({Math.round(dup.similarity * 100)}% similarity) - {dup.reason}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                💡 Review tasks carefully before accepting. You can edit titles and details above.
              </div>
              <label className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                <input 
                  type="checkbox" 
                  className="mr-2" 
                  checked={useStaging} 
                  onChange={(e) => {
                    // This would need to be handled by the parent component
                    // For now, just show the current state
                  }} 
                  disabled
                />
                <span className={useStaging ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-600 dark:text-gray-300'}>
                  {useStaging ? '⚠️ Staging Enabled' : 'Direct to Board'}
                </span>
              </label>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="btn-secondary"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptSelected}
                disabled={selectedTasks.size === 0 || isCreating}
                className="btn-primary"
              >
                {isCreating ? 'Creating...' : `Create ${selectedTasks.size} Task${selectedTasks.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
