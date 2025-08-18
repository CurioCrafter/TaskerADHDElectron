'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { LoadingPage } from '@/components/ui/loading'
import { TaskForm } from '@/components/ui/task-form'
import { VoiceCaptureModal } from '@/components/voice/voice-capture-modal'
import { OpenAIChat } from '@/components/chat/openai-chat'
import { StagingArea } from '@/components/inbox/staging-area'
import { EnergyFilter } from '@/components/filters/energy-filter'
import { AppLayout } from '@/components/layout/app-layout'
import { toast } from 'react-hot-toast'
import { Column as KanbanColumn } from '@/components/kanban/Column'

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
  const [showEnergyFilter, setShowEnergyFilter] = useState(false)
  const [filteredTasks, setFilteredTasks] = useState<any[]>([])
  const [isFiltered, setIsFiltered] = useState(false)

  // Load boards on mount
  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

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
  const handleCreateTask = async (taskData: any) => {
    if (!currentBoard) {
      toast.error('No board selected')
      return
    }

    setIsCreatingTask(true)
    try {
      const success = await createTask(taskData)
      if (success) {
        toast.success('Task created!')
        setShowTaskForm(false)
      } else {
        toast.error('Failed to create task')
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setIsCreatingTask(false)
    }
  }

  const getTodaysTasks = () => {
    if (!currentBoard || !currentBoard.columns) return []
    
    return currentBoard.columns
      .filter(col => col && col.tasks)
      .flatMap(col => col.tasks || [])
      .filter(task => {
        // Today's tasks: due today, urgent priority, or in "Doing" column
        const today = new Date().toDateString()
        const taskDue = task.dueAt ? new Date(task.dueAt).toDateString() : null
        const isDueToday = taskDue === today
        const isUrgent = task.priority === 'URGENT'
        const isInProgress = task.column?.name === 'Doing'
        
        return isDueToday || isUrgent || isInProgress
      })
      .slice(0, 7) // ADHD-friendly limit
  }

  const getQuickWins = () => {
    if (!currentBoard || !currentBoard.columns) return []
    
    return currentBoard.columns
      .filter(col => col && col.tasks)
      .flatMap(col => col.tasks || [])
      .filter(task => task.energy === 'LOW' && (task.estimateMin || 0) <= 30)
      .slice(0, 5)
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
                  } else {
                    const defaultBoard = boards.find(b => b.type !== 'PROJECT') || boards[0]
                    if (defaultBoard) {
                      setCurrentBoard(defaultBoard)
                    }
                    router.push('/dashboard')
                  }
                }}
                className="input text-sm min-w-[200px]"
              >
                <option value="">Select Board</option>
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
              onClick={() => setShowEnergyFilter(true)}
              className="btn-ghost"
              title="Filter tasks by energy level"
            >
              ⚡ Energy
            </button>
            <button 
              onClick={() => setShowChat(true)}
              className="btn-ghost"
              title="Chat with AI assistant"
            >
              🤖 AI Chat
            </button>
            <button 
              onClick={() => setShowTaskForm(true)}
              className="btn-primary"
              title="Add new task"
            >
              ➕ New Task
            </button>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
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
          />
        )}

        {showChat && (
          <OpenAIChat
            isOpen={showChat}
            onClose={() => setShowChat(false)}
          />
        )}

        {showStaging && (
          <StagingArea
            isOpen={showStaging}
            onClose={() => setShowStaging(false)}
          />
        )}

        {showEnergyFilter && (
          <EnergyFilter
            isOpen={showEnergyFilter}
            onClose={() => setShowEnergyFilter(false)}
            onTasksFiltered={(tasks) => {
              setFilteredTasks(tasks)
              setIsFiltered(true)
            }}
          />
        )}
      </div>
    </AppLayout>
  )
}
