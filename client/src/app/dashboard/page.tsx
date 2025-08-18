'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { useSettingsStore } from '@/stores/settings'
import { LoadingPage } from '@/components/ui/loading'
import { TaskForm } from '@/components/ui/task-form'
import { VoiceCaptureModal } from '@/components/voice/voice-capture-modal'
import { OpenAIChat } from '@/components/chat/openai-chat'
import { SmartStagingArea } from '@/components/staging/smart-staging-area'
import { EnergyDashboard } from '@/components/energy/energy-dashboard'
import { EnergyFilter } from '@/components/filters/energy-filter'
import { AppLayout } from '@/components/layout/app-layout'
import { DebugToggle } from '@/components/debug-toggle'
import { TimerWidget, useTimerWidget } from '@/components/time-tracking/timer-widget'
import { toast } from 'react-hot-toast'
import { Column as KanbanColumn } from '@/components/kanban/Column'
import type { TaskPriority, EnergyLevel } from '@/types'

// Force dynamic rendering to avoid prerendering with useSearchParams
export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const { 
    currentBoard, 
    boards,
    fetchBoards,
    fetchBoard,
    setCurrentBoard,
    createTask,
    isLoading: boardLoading,
    error: boardError 
  } = useBoardStore()
  
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [showVoiceCapture, setShowVoiceCapture] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showStaging, setShowStaging] = useState(false)
  const [useStaging, setUseStaging] = useState(false)
  const [showEnergyDashboard, setShowEnergyDashboard] = useState(true) // Always on by default
  const [showEnergyFilter, setShowEnergyFilter] = useState(false)
  const [filteredTasks, setFilteredTasks] = useState<any[]>([])
  const [isFiltered, setIsFiltered] = useState(false)
  
  // Get debug state from settings store
  const { debugMode } = useSettingsStore()
  
  // Timer widget state
  const timerWidget = useTimerWidget()
  
  useEffect(() => {
    if (debugMode) {
      console.log('🔧 [DASHBOARD] Dashboard loaded')
      toast('📋 Dashboard loaded', { duration: 2000, icon: '✅' })
    }
  }, [debugMode])

  // Load boards on mount and ensure a default board exists in dev
  useEffect(() => {
    (async () => {
      await fetchBoards()
    })()
  }, [fetchBoards])

  // Debug: Log current board changes
  useEffect(() => {
    if (currentBoard && debugMode) {
      console.log('🔧 Current board updated:', currentBoard.name)
      console.log('🔧 Board columns:', currentBoard.columns?.map(c => ({ 
        name: c.name, 
        taskCount: c.tasks?.length || 0 
      })))
      console.log('🔧 Total tasks on board:', currentBoard.columns?.reduce((total, col) => total + (col.tasks?.length || 0), 0))
    }
  }, [currentBoard, debugMode])

  // Handle URL board parameter when boards are loaded
  useEffect(() => {
    const boardId = searchParams.get('board')
    if (boardId && boards.length > 0) {
      const board = boards.find(b => b.id === boardId)
      if (board && board.id !== currentBoard?.id) {
        setCurrentBoard(board)
      }
    } else if (boards.length > 0 && !currentBoard) {
      // Set default board (first personal board or first available)
      const defaultBoard = boards.find(b => b.type === 'PERSONAL') || boards[0]
      setCurrentBoard(defaultBoard)
    }
  }, [boards, searchParams, currentBoard, setCurrentBoard])

  // Authentication check
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login')
    }
  }, [isAuthenticated, isLoading, router])

  // Handle task creation
  const handleCreateTask = async (taskData: {
    title: string
    summary?: string
    priority?: TaskPriority
    energy?: EnergyLevel
    dueAt?: string
    estimateMin?: number
    labels?: string[]
    // Repeat data
    isRepeatable?: boolean
    repeatPattern?: 'daily' | 'weekly' | 'monthly' | 'custom'
    repeatInterval?: number
    repeatDays?: number[]
    repeatEndDate?: string
    repeatCount?: number
  }) => {
    if (debugMode) console.log('🔧 [DASHBOARD] Creating task:', taskData)
    
    if (!currentBoard) {
      toast.error('No board selected')
      return
    }

    setIsCreatingTask(true)
    try {
      const task = await createTask(taskData)
      if (task) {
        toast.success('Task created successfully!')
        setShowTaskForm(false)
        // Refresh board to show new task
        await fetchBoard(currentBoard.id)
      } else {
        toast.error('Failed to create task')
      }
    } catch (error) {
      console.error('Task creation error:', error)
      toast.error(`Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCreatingTask(false)
    }
  }

  const getTodaysTasks = () => {
    try {
      if (!currentBoard || !currentBoard.columns || !Array.isArray(currentBoard.columns)) {
        console.warn('⚠️ getTodaysTasks: Invalid board or columns data', { currentBoard })
        return []
      }
      
      const tasks = currentBoard.columns
        .filter(col => {
          if (!col || !col.tasks || !Array.isArray(col.tasks)) {
            console.warn('⚠️ getTodaysTasks: Invalid column data', { col })
            return false
          }
          return true
        })
        .flatMap(col => col.tasks || [])
        .filter(task => {
          if (!task || !task.title) {
            console.warn('⚠️ getTodaysTasks: Invalid task data', { task })
            return false
          }
          
          try {
            // Today's tasks: due today, urgent priority, or in "Doing" column
            const today = new Date().toDateString()
            const taskDue = task.dueAt ? new Date(task.dueAt).toDateString() : null
            const isDueToday = taskDue === today
            const isUrgent = task.priority === 'URGENT'
            const isInProgress = task.column?.name === 'Doing'
            
            return isDueToday || isUrgent || isInProgress
          } catch (dateError) {
            console.error('🚨 Error processing task date:', dateError, { task })
            return false
          }
        })
        .slice(0, 7) // ADHD-friendly limit
        
      console.log('✅ getTodaysTasks successful:', tasks.length, 'tasks')
      return tasks
    } catch (error) {
      console.error('🚨 Error in getTodaysTasks:', error)
      return []
    }
  }

  const getQuickWins = () => {
    try {
      if (!currentBoard || !currentBoard.columns || !Array.isArray(currentBoard.columns)) {
        console.warn('⚠️ getQuickWins: Invalid board or columns data', { currentBoard })
        return []
      }
      
      const quickWins = currentBoard.columns
        .filter(col => {
          if (!col || !col.tasks || !Array.isArray(col.tasks)) {
            console.warn('⚠️ getQuickWins: Invalid column data', { col })
            return false
          }
          return true
        })
        .flatMap(col => col.tasks || [])
        .filter(task => {
          if (!task || !task.title) {
            console.warn('⚠️ getQuickWins: Invalid task data', { task })
            return false
          }
          
          try {
            return task.energy === 'LOW' && (task.estimateMin || 0) <= 30
          } catch (taskError) {
            console.error('🚨 Error processing quick win task:', taskError, { task })
            return false
          }
        })
        .slice(0, 5)
        
      console.log('✅ getQuickWins successful:', quickWins.length, 'quick wins')
      return quickWins
    } catch (error) {
      console.error('🚨 Error in getQuickWins:', error)
      return []
    }
  }

  if (isLoading) return <LoadingPage title="Loading..." />
  if (!isAuthenticated) return <LoadingPage title="Redirecting..." />

  if (boardLoading && !currentBoard) {
    return <LoadingPage title="Loading your workspace..." />
  }

  return (
    <AppLayout title="Dashboard">
        <div className="p-6">
        {/* Action Bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          {/* Board Selector */}
          <div className="flex items-center space-x-4">
            {boards && boards.length > 0 && (
              <select
                value={currentBoard?.id || ''}
                onChange={(e) => {
                  const selectedBoardId = e.target.value
                  
                  if (selectedBoardId) {
                    const selectedBoard = boards.find(b => b.id === selectedBoardId)
                    if (selectedBoard) {
                      setCurrentBoard(selectedBoard)
                      router.push(`/dashboard?board=${selectedBoardId}`)
                    }
                  }
                }}
                className="input text-sm min-w-[200px]"
              >
                {boards.filter(board => board && board.id && board.name).map(board => (
                  <option key={board.id} value={board.id}>
                    {board.type === 'PROJECT' ? '📋' : '📝'} {board.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowVoiceCapture(true)}
              className="btn-ghost"
              title="Capture voice notes and convert to tasks"
            >
              🎤 Voice
            </button>
            <button 
              onClick={() => setShowStaging(true)}
              className="btn-ghost"
              title="Review and organize tasks"
            >
              📥 Staging
            </button>
            <button 
              onClick={() => setUseStaging(!useStaging)}
              className={`btn-ghost text-xs ${useStaging ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-2 border-red-300 dark:border-red-600' : 'text-gray-500'}`}
              title={`Toggle staging mode: ${useStaging ? 'ON - new tasks go to staging' : 'OFF - tasks go directly to board'}`}
            >
              {useStaging ? '⚠️ Staging ON' : '📋 Staging OFF'}
            </button>
            <button 
              onClick={() => setShowEnergyDashboard(!showEnergyDashboard)}
              className={`btn-ghost ${showEnergyDashboard ? 'bg-primary-100 dark:bg-primary-900' : ''}`}
              title="Toggle energy management dashboard"
            >
              ⚡ Energy
            </button>
            <button 
              onClick={() => setShowEnergyFilter(true)}
              className="btn-ghost"
              title="Filter tasks by energy level and mood"
            >
              🔍 Filter
            </button>
            <button 
              onClick={() => setShowChat(true)}
              className="btn-ghost"
              title="Chat with AI assistant"
            >
              🤖 AI Chat
            </button>
            <button 
              onClick={() => {
                if (debugMode) console.log('🔧 [DASHBOARD] New Task button clicked')
                setShowTaskForm(true)
              }}
              className="btn-primary"
              title="Add new task"
            >
              ➕ New Task
            </button>
            <button
              onClick={timerWidget.toggleWidget}
              className="btn-ghost"
              title="Show/Hide Timer Widget"
            >
              ⏱️ Timer
            </button>
            <button 
              onClick={async () => {
                if (currentBoard) {
                  console.log('🔄 Manual board refresh triggered')
                  await fetchBoard(currentBoard.id)
                  toast.success('Board refreshed!')
                }
              }}
              className="btn-ghost"
              title="Refresh board data"
            >
              🔄 Refresh
            </button>
            <DebugToggle />
          </div>
        </div>

        {/* Welcome Section */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {/* Staging Warning */}
          {useStaging && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <span className="text-red-600 dark:text-red-400">⚠️</span>
                <span className="text-sm text-red-800 dark:text-red-200 font-medium">
                  Staging Mode is ON - New tasks will be sent to staging for review instead of directly to your board
                </span>
                <button 
                  onClick={() => setUseStaging(false)}
                  className="ml-auto text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 px-2 py-1 rounded hover:bg-red-200 dark:hover:bg-red-700"
                >
                  Turn OFF
                </button>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Welcome back, {user?.displayName || (user?.email ? user.email.split('@')[0] : 'ADHD Warrior')}! 🌟
              </h2>
              {currentBoard && (
                <p className="text-gray-600 dark:text-gray-400">
                  Working on <span className="font-medium">{currentBoard.name}</span> 
                  {currentBoard._count?.tasks ? ` • ${currentBoard._count.tasks} tasks` : ''}
                </p>
              )}
            </div>
            
            {/* Today's Focus */}
            <div className="text-right">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {getTodaysTasks().length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Today's Focus
              </div>
            </div>
          </div>
        </div>

        {/* Energy Dashboard */}
        {showEnergyDashboard && (
          <div className="mb-8">
            <EnergyDashboard showFullStats={true} />
          </div>
        )}

        {/* Today's Tasks & Quick Wins */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Tasks */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              🎯 Today's Focus ({getTodaysTasks().length})
            </h3>
            <div className="space-y-3">
              {getTodaysTasks().length > 0 ? (
                getTodaysTasks().map((task, index) => (
                  <div key={task.id || index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className={`w-2 h-2 rounded-full ${
                      task.priority === 'URGENT' ? 'bg-red-500' : 
                      task.priority === 'HIGH' ? 'bg-orange-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {task.title}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {task.energy && `${task.energy} energy`}
                        {task.estimateMin && ` • ${task.estimateMin}min`}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <div className="text-4xl mb-2">🎉</div>
                  <div>No urgent tasks today!</div>
                  <div className="text-sm">Perfect time to tackle some quick wins.</div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Wins */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
              ⚡ Quick Wins ({getQuickWins().length})
            </h3>
            <div className="space-y-3">
              {getQuickWins().length > 0 ? (
                getQuickWins().map((task, index) => (
                  <div key={task.id || index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {task.title}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {task.estimateMin ? `${task.estimateMin}min` : '15min'} • Low energy
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <div className="text-4xl mb-2">💡</div>
                  <div>No quick wins available</div>
                  <div className="text-sm">Add some low-energy tasks for momentum!</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        {currentBoard && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {currentBoard.name} Board
                </h3>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {currentBoard.columns?.length || 0} columns • {currentBoard._count?.tasks || 0} tasks
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {currentBoard.columns && currentBoard.columns.length > 0 ? (
                <div className="flex space-x-6 overflow-x-auto pb-4">
                  {currentBoard.columns
                    .sort((a, b) => a.position - b.position)
                    .map((column) => (
                      <div key={column.id} className="flex-shrink-0 w-80">
                        <KanbanColumn column={column} />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">📋</div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    No columns yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    This board doesn't have any columns. Create some to organize your tasks!
                  </p>
                  <button className="btn-primary">
                    Add Column
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Board State */}
        {!currentBoard && !boardLoading && (
          <div className="text-center py-16">
            <div className="text-6xl mb-6">🎯</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Ready to get organized?
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              Create your first board to start managing your tasks with ADHD-friendly tools.
            </p>
            <div className="space-x-4">
              <button className="btn-primary">
                🏠 Create Personal Board
              </button>
              <button className="btn-secondary">
                📋 Create Project Board
              </button>
            </div>
          </div>
        )}

        {/* Modals */}
        {showTaskForm && (
          <TaskForm 
            isOpen={showTaskForm}
            onClose={() => setShowTaskForm(false)}
            onSubmit={handleCreateTask}
            isLoading={isCreatingTask}
            boardId={currentBoard?.id}
          />
        )}

        {showVoiceCapture && (
          <VoiceCaptureModal
            isOpen={showVoiceCapture}
            onClose={() => setShowVoiceCapture(false)}
            boardId={currentBoard?.id || ''}
            useStaging={useStaging}
          />
        )}

        {showChat && (
          <OpenAIChat
            isOpen={showChat}
            onClose={() => setShowChat(false)}
          />
        )}

        {/* Smart Staging Area Modal */}
        {showStaging && (
          <SmartStagingArea
            isOpen={showStaging}
            onClose={() => setShowStaging(false)}
          />
        )}

        {/* Energy Filter Modal */}
        {showEnergyFilter && (
          <EnergyFilter
            isOpen={showEnergyFilter}
            onClose={() => setShowEnergyFilter(false)}
            onTasksFiltered={(tasks) => {
              setFilteredTasks(tasks)
              setIsFiltered(true)
              setShowEnergyFilter(false)
              toast.success(`🔍 Filtered to ${tasks.length} tasks matching your energy level`)
            }}
          />
        )}

        {/* Timer Widget */}
        <TimerWidget
          isVisible={timerWidget.isVisible}
          onClose={timerWidget.hideWidget}
          position={timerWidget.position}
          onPositionChange={timerWidget.updatePosition}
        />
        </div>
    </AppLayout>
  )
}
