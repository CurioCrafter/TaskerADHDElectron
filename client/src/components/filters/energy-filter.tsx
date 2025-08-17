'use client'

import { useState, useEffect } from 'react'
import { useBoardStore } from '@/stores/board'
import type { Task, EnergyLevel, TaskPriority } from '@/types'

interface EnergyFilterProps {
  isOpen: boolean
  onClose: () => void
  onTasksFiltered: (tasks: Task[]) => void
}

interface FilterCriteria {
  energy: EnergyLevel[]
  priority: TaskPriority[]
  maxDuration: number | null
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'any'
  includeQuickWins: boolean
  excludeBlocked: boolean
  currentMood: 'focused' | 'scattered' | 'tired' | 'energized' | 'neutral'
}

interface EnergyRecommendation {
  title: string
  description: string
  energy: EnergyLevel[]
  priority: TaskPriority[]
  maxDuration?: number
  icon: string
  reasoning: string
}

export function EnergyFilter({ isOpen, onClose, onTasksFiltered }: EnergyFilterProps) {
  const { currentBoard } = useBoardStore()
  const [filters, setFilters] = useState<FilterCriteria>({
    energy: [],
    priority: [],
    maxDuration: null,
    timeOfDay: 'any',
    includeQuickWins: false,
    excludeBlocked: true,
    currentMood: 'neutral'
  })

  const [showRecommendations, setShowRecommendations] = useState(true)
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([])

  // Energy recommendations based on time and mood
  const getRecommendations = (): EnergyRecommendation[] => {
    const currentHour = new Date().getHours()
    const isWorkingHours = currentHour >= 9 && currentHour <= 17
    
    const recommendations: EnergyRecommendation[] = [
      {
        title: 'Quick Wins',
        description: 'Low energy tasks you can knock out quickly',
        energy: ['LOW'],
        priority: ['LOW', 'MEDIUM'],
        maxDuration: 15,
        icon: '🎯',
        reasoning: 'Build momentum with easy completions'
      },
      {
        title: 'Power Hour',
        description: 'High energy, high impact work',
        energy: ['HIGH'],
        priority: ['HIGH', 'URGENT'],
        icon: '🚀',
        reasoning: filters.currentMood === 'energized' ? 'Your energy is high - tackle challenging work' : 'Channel focus into important tasks'
      },
      {
        title: 'Gentle Progress',
        description: 'Medium energy tasks with good progress potential',
        energy: ['MEDIUM'],
        priority: ['MEDIUM', 'HIGH'],
        maxDuration: 30,
        icon: '⚡',
        reasoning: filters.currentMood === 'tired' ? 'Maintain progress without overwhelming yourself' : 'Steady work on meaningful tasks'
      },
      {
        title: 'Admin Time',
        description: 'Low energy administrative tasks',
        energy: ['LOW'],
        priority: ['LOW'],
        icon: '📋',
        reasoning: 'Good for when you need to stay productive but feel low energy'
      }
    ]

    // Add time-specific recommendations
    if (currentHour < 10) {
      recommendations.unshift({
        title: 'Morning Fresh Start',
        description: 'Take advantage of morning clarity',
        energy: ['MEDIUM', 'HIGH'],
        priority: ['HIGH', 'URGENT'],
        maxDuration: 45,
        icon: '🌅',
        reasoning: 'Morning hours often provide better focus and decision-making'
      })
    } else if (currentHour > 15) {
      recommendations.push({
        title: 'Afternoon Wind-Down',
        description: 'Lower intensity tasks for later in the day',
        energy: ['LOW', 'MEDIUM'],
        priority: ['LOW', 'MEDIUM'],
        maxDuration: 20,
        icon: '🌆',
        reasoning: 'Energy typically decreases in late afternoon - match task difficulty'
      })
    }

    return recommendations
  }

  const applyFilters = () => {
    if (!currentBoard) return

    const allTasks = currentBoard.columns.flatMap(col => col.tasks || [])
    
    let filtered = allTasks.filter(task => {
      // Energy filter
      if (filters.energy.length > 0 && task.energy && !filters.energy.includes(task.energy)) {
        return false
      }

      // Priority filter
      if (filters.priority.length > 0 && task.priority && !filters.priority.includes(task.priority)) {
        return false
      }

      // Duration filter
      if (filters.maxDuration && task.estimateMin && task.estimateMin > filters.maxDuration) {
        return false
      }

      // Quick wins filter
      if (filters.includeQuickWins) {
        const isQuickWin = task.estimateMin && task.estimateMin <= 15 && 
                          (task.energy === 'LOW' || task.priority === 'LOW' || task.priority === 'MEDIUM')
        if (!isQuickWin) return false
      }

      // Exclude blocked tasks
      if (filters.excludeBlocked) {
        // TODO: Check if task is blocked by dependencies
      }

      return true
    })

    // Sort by recommendation score
    filtered = filtered.sort((a, b) => {
      let scoreA = 0
      let scoreB = 0

      // Prioritize by current mood
      if (filters.currentMood === 'energized') {
        if (a.energy === 'HIGH') scoreA += 3
        if (b.energy === 'HIGH') scoreB += 3
      } else if (filters.currentMood === 'tired') {
        if (a.energy === 'LOW') scoreA += 3
        if (b.energy === 'LOW') scoreB += 3
      } else if (filters.currentMood === 'focused') {
        if (a.priority === 'HIGH' || a.priority === 'URGENT') scoreA += 3
        if (b.priority === 'HIGH' || b.priority === 'URGENT') scoreB += 3
      }

      // Prioritize quick wins for scattered mood
      if (filters.currentMood === 'scattered') {
        if (a.estimateMin && a.estimateMin <= 10) scoreA += 2
        if (b.estimateMin && b.estimateMin <= 10) scoreB += 2
      }

      return scoreB - scoreA
    })

    setFilteredTasks(filtered)
    onTasksFiltered(filtered)
  }

  const applyRecommendation = (rec: EnergyRecommendation) => {
    setFilters(prev => ({
      ...prev,
      energy: rec.energy,
      priority: rec.priority,
      maxDuration: rec.maxDuration || null,
      includeQuickWins: rec.title === 'Quick Wins'
    }))
  }

  const clearFilters = () => {
    setFilters({
      energy: [],
      priority: [],
      maxDuration: null,
      timeOfDay: 'any',
      includeQuickWins: false,
      excludeBlocked: true,
      currentMood: 'neutral'
    })
  }

  // Apply filters when criteria change
  useEffect(() => {
    applyFilters()
  }, [filters, currentBoard])

  if (!isOpen) return null

  const recommendations = getRecommendations()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              ⚡ Energy-Based Task Filter
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Find tasks that match your current energy and focus level
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost p-2">✕</button>
        </div>

        <div className="p-6">
          {/* Current Mood Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              How are you feeling right now?
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { id: 'energized', label: 'Energized', icon: '🚀' },
                { id: 'focused', label: 'Focused', icon: '🎯' },
                { id: 'neutral', label: 'Neutral', icon: '😐' },
                { id: 'scattered', label: 'Scattered', icon: '🌪️' },
                { id: 'tired', label: 'Tired', icon: '😴' }
              ].map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => setFilters(prev => ({ ...prev, currentMood: mood.id as any }))}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    filters.currentMood === mood.id
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-1">{mood.icon}</div>
                  <div className="text-xs font-medium">{mood.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Smart Recommendations */}
          {showRecommendations && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  🤖 Smart Recommendations
                </h3>
                <button
                  onClick={() => setShowRecommendations(!showRecommendations)}
                  className="btn-ghost btn-sm"
                >
                  {showRecommendations ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommendations.slice(0, 4).map((rec, idx) => (
                  <div
                    key={idx}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary-300 dark:hover:border-primary-600 transition-colors cursor-pointer"
                    onClick={() => applyRecommendation(rec)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="text-2xl">{rec.icon}</div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {rec.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {rec.description}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {rec.reasoning}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          {rec.energy.map((energy, i) => (
                            <span key={i} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                              {energy}
                            </span>
                          ))}
                          {rec.maxDuration && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ≤{rec.maxDuration}m
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Energy Levels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Energy Levels
              </label>
              <div className="space-y-2">
                {[
                  { id: 'LOW', label: 'Low Energy 🌱', desc: 'Simple, routine tasks' },
                  { id: 'MEDIUM', label: 'Medium Energy ⚡', desc: 'Moderate focus required' },
                  { id: 'HIGH', label: 'High Energy 🚀', desc: 'Complex, creative work' }
                ].map((energy) => (
                  <label key={energy.id} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.energy.includes(energy.id as EnergyLevel)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters(prev => ({ ...prev, energy: [...prev.energy, energy.id as EnergyLevel] }))
                        } else {
                          setFilters(prev => ({ ...prev, energy: prev.energy.filter(e => e !== energy.id) }))
                        }
                      }}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {energy.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {energy.desc}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Priority Levels */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority Levels
              </label>
              <div className="space-y-2">
                {[
                  { id: 'LOW', label: 'Low Priority', color: 'text-gray-600' },
                  { id: 'MEDIUM', label: 'Medium Priority', color: 'text-blue-600' },
                  { id: 'HIGH', label: 'High Priority', color: 'text-orange-600' },
                  { id: 'URGENT', label: 'Urgent', color: 'text-red-600' }
                ].map((priority) => (
                  <label key={priority.id} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.priority.includes(priority.id as TaskPriority)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters(prev => ({ ...prev, priority: [...prev.priority, priority.id as TaskPriority] }))
                        } else {
                          setFilters(prev => ({ ...prev, priority: prev.priority.filter(p => p !== priority.id) }))
                        }
                      }}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className={`text-sm font-medium ${priority.color}`}>
                      {priority.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Duration
              </label>
              <select
                value={filters.maxDuration || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, maxDuration: e.target.value ? Number(e.target.value) : null }))}
                className="input w-full"
              >
                <option value="">Any duration</option>
                <option value="5">5 minutes or less</option>
                <option value="15">15 minutes or less</option>
                <option value="30">30 minutes or less</option>
                <option value="60">1 hour or less</option>
                <option value="120">2 hours or less</option>
              </select>
            </div>

            {/* Special Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Special Filters
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.includeQuickWins}
                    onChange={(e) => setFilters(prev => ({ ...prev, includeQuickWins: e.target.checked }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    Only quick wins (≤15 min)
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.excludeBlocked}
                    onChange={(e) => setFilters(prev => ({ ...prev, excludeBlocked: e.target.checked }))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    Exclude blocked tasks
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Filtered Results
              </h3>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} found
              </span>
            </div>
            {filteredTasks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No tasks match your current filters. Try adjusting your criteria.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {filteredTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-900 dark:text-gray-100 truncate flex-1">
                      {task.title}
                    </span>
                    <div className="flex items-center space-x-2 ml-2">
                      {task.energy && (
                        <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                          {task.energy}
                        </span>
                      )}
                      {task.estimateMin && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {task.estimateMin}m
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {filteredTasks.length > 5 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ... and {filteredTasks.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between">
            <button
              onClick={clearFilters}
              className="btn-ghost"
            >
              Clear All Filters
            </button>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                onClick={() => {
                  applyFilters()
                  onClose()
                }}
                className="btn-primary"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
