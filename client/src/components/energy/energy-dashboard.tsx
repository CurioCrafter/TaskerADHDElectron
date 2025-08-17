'use client'

import { useState, useEffect } from 'react'
import { useBoardStore } from '@/stores/board'
import { useEnergyStore } from '@/stores/energy'
import { taskUtils, dateUtils } from '@/lib/utils'
import { COLORS, ADHD_LIMITS } from '@/lib/constants'
import type { Task, EnergyLevel } from '@/types'
import { ErrorBoundary } from '@/components/error-boundary'

interface EnergyDashboardProps {
  className?: string
  showFullStats?: boolean
}

export function EnergyDashboard({ className = '', showFullStats = false }: EnergyDashboardProps) {
  console.log('🔧 EnergyDashboard rendering...', { showFullStats, className })
  
  const { currentBoard } = useBoardStore()
  const { 
    currentEnergyLevel, 
    currentMood, 
    setCurrentEnergyLevel, 
    setCurrentMood,
    getRecommendedTasks,
    trackTaskCompletion 
  } = useEnergyStore()

  const [recommendedTasks, setRecommendedTasks] = useState<Task[]>([])
  const [energyTrend, setEnergyTrend] = useState<'up' | 'down' | 'stable'>('stable')
  
  // Validate essential data
  if (!currentBoard) {
    console.warn('⚠️ EnergyDashboard: No current board available')
    return null
  }

  // Get current time context
  const currentHour = new Date().getHours()
  const timeOfDay = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening'
  
  // Get all tasks for energy analysis
  const allTasks = (() => {
    try {
      if (!currentBoard?.columns || !Array.isArray(currentBoard.columns)) {
        console.warn('⚠️ EnergyDashboard: Invalid board columns', { currentBoard })
        return []
      }
      
      const tasks = currentBoard.columns
        .filter(col => col && Array.isArray(col.tasks))
        .flatMap(col => col.tasks || [])
        .filter(task => task && task.id) // Only valid tasks
      
      console.log('✅ EnergyDashboard allTasks:', tasks.length, 'tasks')
      return tasks
    } catch (error) {
      console.error('🚨 Error getting allTasks:', error)
      return []
    }
  })()
  
  // Update recommendations when energy/mood changes
  useEffect(() => {
    if (currentBoard && (currentEnergyLevel || currentMood)) {
      const recommended = getRecommendedTasks(allTasks, {
        energyLevel: currentEnergyLevel,
        mood: currentMood,
        timeOfDay,
        maxTasks: ADHD_LIMITS.MAX_DAILY_TASKS
      })
      setRecommendedTasks(recommended)
    }
  }, [currentBoard, currentEnergyLevel, currentMood, timeOfDay, allTasks])

  // Auto-detect energy based on time patterns
  useEffect(() => {
    if (!currentEnergyLevel) {
      // Auto-suggest based on time of day
      let suggestedEnergy: EnergyLevel = 'MEDIUM'
      if (timeOfDay === 'morning') suggestedEnergy = 'HIGH'
      else if (timeOfDay === 'evening') suggestedEnergy = 'LOW'
      
      setCurrentEnergyLevel(suggestedEnergy)
    }
  }, [timeOfDay, currentEnergyLevel, setCurrentEnergyLevel])

  const energyLevels: { id: EnergyLevel; label: string; icon: string; color: string }[] = [
    { id: 'LOW', label: 'Low Energy', icon: '🌱', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
    { id: 'MEDIUM', label: 'Medium Energy', icon: '⚡', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' },
    { id: 'HIGH', label: 'High Energy', icon: '🚀', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' }
  ]

  const moods: { id: string; label: string; icon: string }[] = [
    { id: 'focused', label: 'Focused', icon: '🎯' },
    { id: 'scattered', label: 'Scattered', icon: '🌪️' },
    { id: 'tired', label: 'Tired', icon: '😴' },
    { id: 'energized', label: 'Energized', icon: '⚡' },
    { id: 'neutral', label: 'Neutral', icon: '😐' }
  ]

  const getTasksByEnergy = () => {
    try {
      // Ensure allTasks is a valid array
      const tasks = Array.isArray(allTasks) ? allTasks : []
      
      const tasksByEnergy = {
        LOW: tasks.filter(task => task?.energy === 'LOW'),
        MEDIUM: tasks.filter(task => task?.energy === 'MEDIUM'), 
        HIGH: tasks.filter(task => task?.energy === 'HIGH')
      }
      
      console.log('✅ getTasksByEnergy:', { 
        totalTasks: tasks.length,
        LOW: tasksByEnergy.LOW.length,
        MEDIUM: tasksByEnergy.MEDIUM.length,
        HIGH: tasksByEnergy.HIGH.length
      })
      
      return tasksByEnergy
    } catch (error) {
      console.error('🚨 Error in getTasksByEnergy:', error)
      return { LOW: [], MEDIUM: [], HIGH: [] }
    }
  }

  const getEnergyInsight = () => {
    try {
      const tasksByEnergy = getTasksByEnergy()
      const currentTime = new Date().getHours()
      
      // Ensure currentEnergyLevel is valid
      if (!currentEnergyLevel || typeof currentEnergyLevel !== 'string') {
        console.warn('⚠️ getEnergyInsight: Invalid currentEnergyLevel:', currentEnergyLevel)
        return null
      }
      
      if (currentEnergyLevel === 'HIGH' && currentTime > 15) {
        return {
          type: 'warning',
          message: 'High energy in afternoon is great! Consider tackling creative or complex tasks.'
        }
      } else if (currentEnergyLevel === 'LOW' && currentTime < 10) {
        return {
          type: 'suggestion', 
          message: 'Low energy in morning? Try starting with quick wins to build momentum.'
        }
      } else {
        // Safe access to tasksByEnergy with fallback
        const currentEnergyTasks = tasksByEnergy[currentEnergyLevel as keyof typeof tasksByEnergy] || []
        if (Array.isArray(currentEnergyTasks) && currentEnergyTasks.length === 0) {
          return {
            type: 'info',
            message: `No ${currentEnergyLevel.toLowerCase()} energy tasks available. Consider adjusting existing tasks.`
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('🚨 Error in getEnergyInsight:', error, { currentEnergyLevel })
      return null
    }
  }

  if (!currentBoard) return null

  return (
    <ErrorBoundary>
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
          ⚡ Energy Dashboard
          {energyTrend !== 'stable' && (
            <span className={`ml-2 text-sm ${energyTrend === 'up' ? 'text-green-600' : 'text-orange-600'}`}>
              {energyTrend === 'up' ? '↗️' : '↘️'}
            </span>
          )}
        </h3>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {timeOfDay} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Current Energy & Mood */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Energy Level
          </label>
          <div className="flex space-x-2">
            {energyLevels.map((level) => (
              <button
                key={level.id}
                onClick={() => setCurrentEnergyLevel(level.id)}
                className={`flex-1 p-2 rounded-lg border text-sm font-medium transition-all ${
                  currentEnergyLevel === level.id
                    ? level.color + ' border-current'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="text-lg mb-1">{level.icon}</div>
                <div className="text-xs">{level.label.split(' ')[0]}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Current Mood
          </label>
          <select
            value={currentMood || 'neutral'}
            onChange={(e) => setCurrentMood(e.target.value as any)}
            className="input w-full text-sm"
          >
            {moods.map((mood) => (
              <option key={mood.id} value={mood.id}>
                {mood.icon} {mood.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Energy Insight */}
      {getEnergyInsight() && (
        <div className={`p-3 rounded-lg mb-4 text-sm ${
          getEnergyInsight()?.type === 'warning' ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300' :
          getEnergyInsight()?.type === 'suggestion' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
          'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}>
          💡 {getEnergyInsight()?.message}
        </div>
      )}

      {/* Recommended Tasks */}
      {recommendedTasks.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            🎯 Recommended for You Right Now ({recommendedTasks.length})
          </h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {recommendedTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                    {task.title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {task.energy && `${task.energy} energy`}
                    {task.estimateMin && ` • ${task.estimateMin}min`}
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  task.priority === 'URGENT' ? 'bg-red-500' :
                  task.priority === 'HIGH' ? 'bg-orange-500' :
                  task.priority === 'MEDIUM' ? 'bg-blue-500' : 'bg-green-500'
                }`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Energy Distribution */}
      {showFullStats && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Task Energy Distribution
          </h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {energyLevels.map((level) => {
              try {
                const tasksByEnergy = getTasksByEnergy()
                const tasksForLevel = tasksByEnergy[level.id] || []
                const count = Array.isArray(tasksForLevel) ? tasksForLevel.length : 0
                const totalTasks = Array.isArray(allTasks) ? allTasks.length : 0
                const percentage = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0
                
                return (
                  <div key={level.id} className="text-center">
                    <div className="text-lg mb-1">{level.icon}</div>
                    <div className="font-medium">{count}</div>
                    <div className="text-gray-500 dark:text-gray-400">{percentage}%</div>
                  </div>
                )
              } catch (error) {
                console.error('🚨 Error rendering energy level:', error, { level })
                return (
                  <div key={level.id} className="text-center">
                    <div className="text-lg mb-1">{level.icon}</div>
                    <div className="font-medium">0</div>
                    <div className="text-gray-500 dark:text-gray-400">0%</div>
                  </div>
                )
              }
            })}
          </div>
        </div>
      )}
      </div>
    </ErrorBoundary>
  )
}
