import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface TimeEntry {
  id: string
  taskId: string
  taskTitle: string
  boardId: string
  boardName: string
  startTime: Date
  endTime?: Date
  duration?: number // in minutes
  description?: string
  energy?: 'LOW' | 'MEDIUM' | 'HIGH'
  category?: string
  isRunning: boolean
  tags?: string[]
}

export interface TimeLog {
  taskId: string
  totalTime: number // in minutes
  sessions: TimeEntry[]
  averageSessionLength: number
  estimatedTime?: number
  estimateAccuracy?: number // percentage
  lastTracked?: Date
}

interface TimeTrackingState {
  // Active timer
  activeTimer: TimeEntry | null
  
  // Time entries
  timeEntries: TimeEntry[]
  
  // Time logs per task
  timeLogs: Record<string, TimeLog>
  
  // Analytics
  dailyTotals: Record<string, number> // date -> minutes
  weeklyTotals: Record<string, number> // week -> minutes
  
  // Actions
  startTimer: (task: { id: string; title: string; boardId: string; boardName: string; energy?: string }) => void
  stopTimer: (description?: string) => TimeEntry | null
  pauseTimer: () => void
  resumeTimer: () => void
  
  addManualEntry: (entry: Omit<TimeEntry, 'id'>) => void
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void
  deleteTimeEntry: (id: string) => void
  
  // Analytics
  getTaskLog: (taskId: string) => TimeLog | null
  getDailyTotal: (date?: Date) => number
  getWeeklyTotal: (date?: Date) => number
  getTopTasks: (limit?: number) => Array<{ taskId: string; taskTitle: string; totalTime: number }>
  
  // Bulk operations
  exportTimeEntries: (startDate?: Date, endDate?: Date) => TimeEntry[]
  importTimeEntries: (entries: TimeEntry[]) => void
  clearAllEntries: () => void
}

const formatDate = (date: Date) => {
  return date.toISOString().split('T')[0] // YYYY-MM-DD
}

const getWeekKey = (date: Date) => {
  const year = date.getFullYear()
  const week = Math.ceil((date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))
  return `${year}-W${week}`
}

export const useTimeTrackingStore = create<TimeTrackingState>()(
  persist(
    (set, get) => ({
      activeTimer: null,
      timeEntries: [],
      timeLogs: {},
      dailyTotals: {},
      weeklyTotals: {},

      startTimer: (task) => {
        const state = get()
        
        // Stop any existing timer
        if (state.activeTimer) {
          get().stopTimer()
        }

        const newTimer: TimeEntry = {
          id: `timer_${Date.now()}`,
          taskId: task.id,
          taskTitle: task.title,
          boardId: task.boardId,
          boardName: task.boardName,
          startTime: new Date(),
          isRunning: true,
          energy: (task.energy as any) || 'MEDIUM'
        }

        set({ activeTimer: newTimer })
      },

      stopTimer: (description) => {
        const state = get()
        if (!state.activeTimer) return null

        const endTime = new Date()
        const duration = Math.round((endTime.getTime() - state.activeTimer.startTime.getTime()) / (1000 * 60))

        const completedEntry: TimeEntry = {
          ...state.activeTimer,
          endTime,
          duration,
          description,
          isRunning: false
        }

        const updatedEntries = [completedEntry, ...state.timeEntries]
        const dateKey = formatDate(completedEntry.startTime)
        const weekKey = getWeekKey(completedEntry.startTime)
        
        // Update daily and weekly totals
        const newDailyTotals = { ...state.dailyTotals }
        const newWeeklyTotals = { ...state.weeklyTotals }
        
        newDailyTotals[dateKey] = (newDailyTotals[dateKey] || 0) + duration
        newWeeklyTotals[weekKey] = (newWeeklyTotals[weekKey] || 0) + duration

        // Update task log
        const newTimeLogs = { ...state.timeLogs }
        const taskLog = newTimeLogs[completedEntry.taskId] || {
          taskId: completedEntry.taskId,
          totalTime: 0,
          sessions: [],
          averageSessionLength: 0,
          lastTracked: completedEntry.startTime
        }

        taskLog.sessions.push(completedEntry)
        taskLog.totalTime += duration
        taskLog.averageSessionLength = Math.round(taskLog.totalTime / taskLog.sessions.length)
        taskLog.lastTracked = completedEntry.startTime
        
        newTimeLogs[completedEntry.taskId] = taskLog

        set({
          activeTimer: null,
          timeEntries: updatedEntries,
          timeLogs: newTimeLogs,
          dailyTotals: newDailyTotals,
          weeklyTotals: newWeeklyTotals
        })

        return completedEntry
      },

      pauseTimer: () => {
        const state = get()
        if (!state.activeTimer || !state.activeTimer.isRunning) return

        set({
          activeTimer: {
            ...state.activeTimer,
            isRunning: false
          }
        })
      },

      resumeTimer: () => {
        const state = get()
        if (!state.activeTimer || state.activeTimer.isRunning) return

        set({
          activeTimer: {
            ...state.activeTimer,
            isRunning: true
          }
        })
      },

      addManualEntry: (entry) => {
        const newEntry: TimeEntry = {
          ...entry,
          id: `manual_${Date.now()}`
        }

        const state = get()
        const updatedEntries = [newEntry, ...state.timeEntries]
        
        // Update totals if duration is provided
        if (entry.duration) {
          const dateKey = formatDate(entry.startTime)
          const weekKey = getWeekKey(entry.startTime)
          
          const newDailyTotals = { ...state.dailyTotals }
          const newWeeklyTotals = { ...state.weeklyTotals }
          
          newDailyTotals[dateKey] = (newDailyTotals[dateKey] || 0) + entry.duration
          newWeeklyTotals[weekKey] = (newWeeklyTotals[weekKey] || 0) + entry.duration

          // Update task log
          const newTimeLogs = { ...state.timeLogs }
          const taskLog = newTimeLogs[entry.taskId] || {
            taskId: entry.taskId,
            totalTime: 0,
            sessions: [],
            averageSessionLength: 0,
            lastTracked: entry.startTime
          }

          taskLog.sessions.push(newEntry)
          taskLog.totalTime += entry.duration
          taskLog.averageSessionLength = Math.round(taskLog.totalTime / taskLog.sessions.length)
          taskLog.lastTracked = entry.startTime
          
          newTimeLogs[entry.taskId] = taskLog

          set({
            timeEntries: updatedEntries,
            timeLogs: newTimeLogs,
            dailyTotals: newDailyTotals,
            weeklyTotals: newWeeklyTotals
          })
        } else {
          set({ timeEntries: updatedEntries })
        }
      },

      updateTimeEntry: (id, updates) => {
        const state = get()
        const updatedEntries = state.timeEntries.map(entry =>
          entry.id === id ? { ...entry, ...updates } : entry
        )
        set({ timeEntries: updatedEntries })
      },

      deleteTimeEntry: (id) => {
        const state = get()
        const entryToDelete = state.timeEntries.find(entry => entry.id === id)
        if (!entryToDelete || !entryToDelete.duration) return

        const updatedEntries = state.timeEntries.filter(entry => entry.id !== id)
        
        // Update totals
        const dateKey = formatDate(entryToDelete.startTime)
        const weekKey = getWeekKey(entryToDelete.startTime)
        
        const newDailyTotals = { ...state.dailyTotals }
        const newWeeklyTotals = { ...state.weeklyTotals }
        
        newDailyTotals[dateKey] = Math.max(0, (newDailyTotals[dateKey] || 0) - entryToDelete.duration)
        newWeeklyTotals[weekKey] = Math.max(0, (newWeeklyTotals[weekKey] || 0) - entryToDelete.duration)

        set({
          timeEntries: updatedEntries,
          dailyTotals: newDailyTotals,
          weeklyTotals: newWeeklyTotals
        })
      },

      getTaskLog: (taskId) => {
        return get().timeLogs[taskId] || null
      },

      getDailyTotal: (date = new Date()) => {
        const dateKey = formatDate(date)
        return get().dailyTotals[dateKey] || 0
      },

      getWeeklyTotal: (date = new Date()) => {
        const weekKey = getWeekKey(date)
        return get().weeklyTotals[weekKey] || 0
      },

      getTopTasks: (limit = 10) => {
        const state = get()
        return Object.values(state.timeLogs)
          .sort((a, b) => b.totalTime - a.totalTime)
          .slice(0, limit)
          .map(log => ({
            taskId: log.taskId,
            taskTitle: log.sessions[0]?.taskTitle || 'Unknown Task',
            totalTime: log.totalTime
          }))
      },

      exportTimeEntries: (startDate, endDate) => {
        const state = get()
        let entries = state.timeEntries

        if (startDate || endDate) {
          entries = entries.filter(entry => {
            const entryDate = entry.startTime
            if (startDate && entryDate < startDate) return false
            if (endDate && entryDate > endDate) return false
            return true
          })
        }

        return entries
      },

      importTimeEntries: (entries) => {
        const state = get()
        const existingIds = new Set(state.timeEntries.map(e => e.id))
        const newEntries = entries.filter(e => !existingIds.has(e.id))
        
        set({
          timeEntries: [...newEntries, ...state.timeEntries].sort(
            (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          )
        })
      },

      clearAllEntries: () => {
        set({
          timeEntries: [],
          timeLogs: {},
          dailyTotals: {},
          weeklyTotals: {},
          activeTimer: null
        })
      }
    }),
    {
      name: 'taskeradhd-time-tracking',
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      ),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migration between versions
        if (version === 0) {
          return {
            activeTimer: null,
            timeEntries: persistedState.timeEntries || [],
            timeLogs: persistedState.timeLogs || {},
            dailyTotals: persistedState.dailyTotals || {},
            weeklyTotals: persistedState.weeklyTotals || {},
            ...persistedState
          }
        }
        return persistedState
      }
    }
  )
)
