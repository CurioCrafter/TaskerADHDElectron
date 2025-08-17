import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { taskUtils } from '@/lib/utils'
import { STORAGE_KEYS, ADHD_LIMITS } from '@/lib/constants'
import type { Task, EnergyLevel } from '@/types'

interface EnergyState {
  // Current state
  currentEnergyLevel: EnergyLevel | null
  currentMood: 'focused' | 'scattered' | 'tired' | 'energized' | 'neutral' | null
  energyHistory: Array<{
    timestamp: string
    energy: EnergyLevel
    mood: string
    tasksCompleted: number
    context?: string
  }>
  
  // Patterns and insights
  energyPatterns: {
    morningEnergy: EnergyLevel | null
    afternoonEnergy: EnergyLevel | null
    eveningEnergy: EnergyLevel | null
    bestWorkingHours: number[]
  }
  
  // Task completion tracking
  completionsByEnergy: {
    [key in EnergyLevel]: {
      completed: number
      total: number
      averageTime: number
    }
  }

  // Actions
  setCurrentEnergyLevel: (energy: EnergyLevel) => void
  setCurrentMood: (mood: string) => void
  trackEnergyChange: (energy: EnergyLevel, mood: string, context?: string) => void
  trackTaskCompletion: (task: Task, actualTimeSpent?: number) => void
  getRecommendedTasks: (tasks: Task[], context: {
    energyLevel?: EnergyLevel | null
    mood?: string | null
    timeOfDay?: string
    maxTasks?: number
  }) => Task[]
  analyzeEnergyPatterns: () => void
  getEnergyInsights: () => {
    message: string
    type: 'tip' | 'warning' | 'success' | 'info'
    action?: string
  }[]
}

export const useEnergyStore = create<EnergyState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentEnergyLevel: null,
      currentMood: null,
      energyHistory: [],
      energyPatterns: {
        morningEnergy: null,
        afternoonEnergy: null,
        eveningEnergy: null,
        bestWorkingHours: []
      },
      completionsByEnergy: {
        LOW: { completed: 0, total: 0, averageTime: 0 },
        MEDIUM: { completed: 0, total: 0, averageTime: 0 },
        HIGH: { completed: 0, total: 0, averageTime: 0 }
      },

      // Set current energy level
      setCurrentEnergyLevel: (energy: EnergyLevel) => {
        const state = get()
        set({ currentEnergyLevel: energy })
        
        // Track the change
        get().trackEnergyChange(energy, state.currentMood || 'neutral', 'manual_update')
      },

      // Set current mood
      setCurrentMood: (mood: string) => {
        set({ currentMood: mood as any })
      },

      // Track energy changes over time
      trackEnergyChange: (energy: EnergyLevel, mood: string, context?: string) => {
        const state = get()
        const timestamp = new Date().toISOString()
        const currentHour = new Date().getHours()
        
        // Add to history
        const newEntry = {
          timestamp,
          energy,
          mood,
          tasksCompleted: 0, // Will be updated by task completion tracking
          context
        }
        
        set({
          energyHistory: [...state.energyHistory, newEntry].slice(-100) // Keep last 100 entries
        })

        // Update patterns
        get().analyzeEnergyPatterns()
      },

      // Track when tasks are completed to learn patterns
      trackTaskCompletion: (task: Task, actualTimeSpent?: number) => {
        const state = get()
        const taskEnergy = task.energy as EnergyLevel
        
        if (taskEnergy) {
          const current = state.completionsByEnergy[taskEnergy]
          const timeSpent = actualTimeSpent || task.estimateMin || 0
          
          set({
            completionsByEnergy: {
              ...state.completionsByEnergy,
              [taskEnergy]: {
                completed: current.completed + 1,
                total: current.total + 1,
                averageTime: current.total > 0 
                  ? (current.averageTime * current.total + timeSpent) / (current.total + 1)
                  : timeSpent
              }
            }
          })
        }
      },

      // Get recommended tasks based on current energy and context
      getRecommendedTasks: (tasks: Task[], context) => {
        try {
          console.log('🎯 Getting recommended tasks:', { tasksLength: tasks?.length, context })
          
          if (!tasks || !Array.isArray(tasks)) {
            console.warn('⚠️ getRecommendedTasks: Invalid tasks array', { tasks })
            return []
          }
          
          const {
            energyLevel = get().currentEnergyLevel,
            mood = get().currentMood,
            timeOfDay = 'any',
            maxTasks = ADHD_LIMITS?.MAX_DAILY_TASKS || 5
          } = context || {}

          if (!energyLevel) {
            console.warn('⚠️ getRecommendedTasks: No energy level provided')
            return []
          }

        // Filter tasks by current energy level
        let recommended = tasks.filter(task => {
          // Match energy level
          if (task.energy !== energyLevel) return false
          
          // Filter out completed tasks
          if (task.column?.name?.toLowerCase().includes('done')) return false
          
          return true
        })

        // Apply mood-based filtering
        if (mood === 'scattered') {
          // When scattered, prefer quick wins and low-complexity tasks
          recommended = recommended.filter(task => 
            taskUtils.isQuickWin(task) || 
            (task.estimateMin && task.estimateMin <= 15)
          )
        } else if (mood === 'focused') {
          // When focused, prefer important/urgent tasks
          recommended = recommended.filter(task => 
            task.priority === 'HIGH' || task.priority === 'URGENT'
          )
        } else if (mood === 'tired') {
          // When tired, prefer low energy tasks only
          recommended = recommended.filter(task => 
            task.energy === 'LOW' && taskUtils.isQuickWin(task)
          )
        }

        // Apply time-of-day logic
        if (timeOfDay === 'morning' && energyLevel === 'HIGH') {
          // Morning high energy: prioritize creative/complex work
          recommended = recommended.filter(task => 
            task.energy === 'HIGH' || task.priority === 'HIGH'
          )
        } else if (timeOfDay === 'evening') {
          // Evening: prefer quick tasks and low energy work
          recommended = recommended.filter(task => 
            task.energy === 'LOW' || taskUtils.isQuickWin(task)
          )
        }

        // Sort by ADHD-friendly criteria
        recommended = taskUtils.sortForADHD(recommended, 'priority')

        // Apply ADHD-friendly limits
        const result = recommended.slice(0, maxTasks)
        console.log('✅ getRecommendedTasks successful:', result.length, 'tasks')
        return result
        } catch (error) {
          console.error('🚨 Error in getRecommendedTasks:', error, { tasks, context })
          return []
        }
      },

      // Analyze patterns from energy history
      analyzeEnergyPatterns: () => {
        const state = get()
        const history = state.energyHistory
        
        if (history.length < 5) return // Need at least 5 data points

        // Analyze energy by time of day
        const morningEntries = history.filter(entry => {
          const hour = new Date(entry.timestamp).getHours()
          return hour >= 6 && hour < 12
        })
        
        const afternoonEntries = history.filter(entry => {
          const hour = new Date(entry.timestamp).getHours()
          return hour >= 12 && hour < 18
        })
        
        const eveningEntries = history.filter(entry => {
          const hour = new Date(entry.timestamp).getHours()
          return hour >= 18 && hour < 24
        })

        // Get most common energy level for each time period
        const getMostCommonEnergy = (entries: typeof history): EnergyLevel | null => {
          if (entries.length === 0) return null
          
          const energyCounts = entries.reduce((acc, entry) => {
            acc[entry.energy] = (acc[entry.energy] || 0) + 1
            return acc
          }, {} as Record<EnergyLevel, number>)
          
          return Object.entries(energyCounts).reduce((max, [energy, count]) => 
            count > (energyCounts[max as EnergyLevel] || 0) ? energy as EnergyLevel : max
          , 'MEDIUM' as EnergyLevel)
        }

        // Find best working hours based on high energy periods
        const bestWorkingHours = history
          .filter(entry => entry.energy === 'HIGH')
          .map(entry => new Date(entry.timestamp).getHours())
          .reduce((acc, hour) => {
            acc[hour] = (acc[hour] || 0) + 1
            return acc
          }, {} as Record<number, number>)

        const topHours = Object.entries(bestWorkingHours)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 4)
          .map(([hour]) => parseInt(hour))

        set({
          energyPatterns: {
            morningEnergy: getMostCommonEnergy(morningEntries),
            afternoonEnergy: getMostCommonEnergy(afternoonEntries),
            eveningEnergy: getMostCommonEnergy(eveningEntries),
            bestWorkingHours: topHours
          }
        })
      },

      // Generate insights based on patterns and current state
      getEnergyInsights: () => {
        const state = get()
        const insights: ReturnType<EnergyState['getEnergyInsights']> = []
        const currentHour = new Date().getHours()
        
        // Suggest energy level based on patterns
        if (state.energyPatterns.bestWorkingHours.includes(currentHour)) {
          insights.push({
            type: 'success',
            message: 'This is typically a high-energy time for you!',
            action: 'Consider tackling challenging tasks now.'
          })
        }

        // Completion rate insights
        const lowEnergyStats = state.completionsByEnergy.LOW
        const highEnergyStats = state.completionsByEnergy.HIGH
        
        if (lowEnergyStats.total > 5 && lowEnergyStats.completed / lowEnergyStats.total > 0.8) {
          insights.push({
            type: 'tip',
            message: 'You excel at completing low-energy tasks!',
            action: 'Use these as momentum builders when feeling stuck.'
          })
        }

        if (highEnergyStats.total > 3 && highEnergyStats.completed / highEnergyStats.total < 0.5) {
          insights.push({
            type: 'warning',
            message: 'High-energy tasks seem challenging for you.',
            action: 'Try breaking them into smaller pieces.'
          })
        }

        // Time-based suggestions
        if (currentHour < 10 && state.currentEnergyLevel === 'LOW') {
          insights.push({
            type: 'tip',
            message: 'Low energy in the morning?',
            action: 'Try some quick wins to build momentum.'
          })
        }

        if (currentHour > 20 && state.currentEnergyLevel === 'HIGH') {
          insights.push({
            type: 'info',
            message: 'High energy in the evening is great for creative work!',
            action: 'Consider planning or brainstorming tasks.'
          })
        }

        return insights
      }
    }),
    {
      name: STORAGE_KEYS.ENERGY,
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      ),
      partialize: (state) => ({
        currentEnergyLevel: state.currentEnergyLevel,
        currentMood: state.currentMood,
        energyHistory: state.energyHistory.slice(-50), // Only persist last 50 entries
        energyPatterns: state.energyPatterns,
        completionsByEnergy: state.completionsByEnergy
      }),
      version: 1
    }
  )
)
