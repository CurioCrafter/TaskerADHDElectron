'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { LoadingPage } from '@/components/ui/loading'
import { TaskForm } from '@/components/ui/task-form'
import { VoiceCaptureModal } from '@/components/voice/voice-capture-modal'
import { OpenAIChat } from '@/components/chat/openai-chat'
import { StagingArea } from '@/components/inbox/staging-area'
import { EnergyFilter } from '@/components/filters/energy-filter'
import { toast } from 'react-hot-toast'
import { Column as KanbanColumn } from '@/components/kanban/Column'
import { ThemeToggle } from '@/app/theme-toggle'

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
    if (boards.length === 0) return

    const boardId = searchParams.get('board')
    if (!boardId) return

    const targetBoard = boards.find(board => board.id === boardId)
    if (targetBoard) {
      setCurrentBoard(targetBoard)
    } else {
      // Try to fetch the specific board
      fetchBoard(boardId).catch(() => {
        toast.error('Board not found')
        router.replace('/dashboard')
      })
    }
  }, [boards, searchParams, setCurrentBoard, fetchBoard, router])

  // Handle error display
  useEffect(() => {
    if (boardError) {
      toast.error(boardError)
    }
  }, [boardError])

  // Development bypass - skip auth checks
  // useEffect(() => {
  //   if (!isLoading && !isAuthenticated) {
  //     router.replace('/auth/login')
  //   }
  // }, [isAuthenticated, isLoading, router])

  // if (isLoading) {
  //   return <LoadingPage title="Loading your workspace..." />
  // }

  // if (!isAuthenticated) {
  //   return <LoadingPage title="Redirecting to login..." />
  // }

  const handleCreateTask = async (taskData: any) => {
    setIsCreatingTask(true)
    
    try {
      const task = await createTask(taskData)
      if (task) {
        toast.success('Task created successfully! 🎯')
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

  if (boardLoading && !currentBoard) {
    return <LoadingPage title="Loading your workspace..." />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                🎯 TaskerADHD
              </h1>
              
              {/* Board Selector */}
              {boards && boards.length > 0 && (
                <div className="hidden sm:block">
                  <select
                    value={currentBoard?.id || ''}
                    onChange={(e) => {
                      const selectedBoardId = e.target.value
                      
                      if (selectedBoardId) {
                        // Find the board and set it as current
                        const selectedBoard = boards.find(b => b.id === selectedBoardId)
                        if (selectedBoard) {
                          setCurrentBoard(selectedBoard)
                          router.push(`/dashboard?board=${selectedBoardId}`)
                        }
                      } else {
                        // Set to default board (first non-project board)
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
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              
              {/* Quick Board Navigation */}
              <div className="hidden md:flex items-center space-x-2 border-r border-gray-300 dark:border-gray-600 pr-4">
                <Link 
                  href="/dashboard"
                  className={`text-sm px-2 py-1 rounded transition-colors ${
                    !searchParams.get('board') 
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300' 
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
                  }`}
                >
                  📝 Main
                </Link>
                <Link 
                  href="/projects"
                  className="text-sm px-2 py-1 rounded text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                >
                  📋 All Boards
                </Link>
              </div>
              
              <button 
                onClick={() => setShowVoiceCapture(true)}
                className="btn-ghost"
              >
                🎤 Voice Capture
              </button>
              <button 
                onClick={() => setShowStaging(true)}
                className="btn-ghost"
              >
                📥 Staging
              </button>
              <button 
                onClick={() => setShowEnergyFilter(true)}
                className="btn-ghost"
              >
                ⚡ Energy Filter
              </button>
              <button 
                onClick={() => setShowChat(true)}
                className="btn-ghost"
              >
                🤖 AI Chat
              </button>
              <Link href="/settings" className="btn-ghost focus-hide">
                ⚙️ Settings
              </Link>
              <Link href="/docs" className="btn-ghost focus-hide">
                📚 Docs
              </Link>
              <button 
                onClick={() => window.location.reload()}
                className="btn-secondary"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Board Info */}
      <div className="sm:hidden bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex flex-col space-y-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Welcome back, {user?.displayName || (user?.email ? user.email.split('@')[0] : 'ADHD Warrior')}!
          </div>
          
          {/* Mobile Board Selector */}
          {boards && boards.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Board:
              </label>
              <select
                value={currentBoard?.id || ''}
                onChange={(e) => {
                  const selectedBoardId = e.target.value
                  
                  if (selectedBoardId) {
                    // Find the board and set it as current
                    const selectedBoard = boards.find(b => b.id === selectedBoardId)
                    if (selectedBoard) {
                      setCurrentBoard(selectedBoard)
                      router.push(`/dashboard?board=${selectedBoardId}`)
                    }
                  } else {
                    // Set to default board (first non-project board)
                    const defaultBoard = boards.find(b => b.type !== 'PROJECT') || boards[0]
                    if (defaultBoard) {
                      setCurrentBoard(defaultBoard)
                    }
                    router.push('/dashboard')
                  }
                }}
                className="input text-sm w-full"
              >
                <option value="">Select Board</option>
                {boards.filter(board => board && board.id && board.name).map(board => (
                  <option key={board.id} value={board.id}>
                    {board.type === 'PROJECT' ? '📋' : '📝'} {board.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="bg-gradient-energy dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-700 rounded-lg p-6 focus-hide">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              🌟 Ready to capture your thoughts?
            </h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              This is your ADHD-friendly workspace. Speak your tasks, organize by energy level, 
              and focus on what matters most.
            </p>
            <div className="flex space-x-4">
              <button 
                className="btn-primary"
                onClick={() => setShowVoiceCapture(true)}
              >
                🎤 Start Voice Capture
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setShowTaskForm(true)}
              >
                ➕ Add Task Manually
              </button>
              <button 
                className="btn-ghost focus-hide"
                onClick={() => setShowChat(true)}
              >
                🤖 Chat with AI
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 focus-hide">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">{getTodaysTasks().length}</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Today's Tasks</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{getTodaysTasks().length} / 7</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400 font-semibold">{getQuickWins().length}</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Quick Wins</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{getQuickWins().length > 0 ? 'Ready to go' : 'None available'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">⚡</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Energy Level</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Medium</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">🎯</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Focus Mode</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Off</p>
                </div>
              </div>
            </div>
          </div>

          {/* Kanban Board Placeholder */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 focus-primary">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">My Tasks</h3>
              <div className="flex space-x-2 focus-hide">
                <button className="btn-secondary btn-sm">
                  🔍 Filter
                </button>
                <button className="btn-secondary btn-sm">
                  👁️ View
                </button>
              </div>
            </div>

            {/* Kanban Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {currentBoard?.columns.map((column) => (
                <KanbanColumn key={column.id} column={column} />
              )) || (
                // Fallback if no board
                ['Inbox', 'To Do', 'Doing', 'Done'].map((columnName) => (
                  <div key={columnName} className="kanban-column">
                    <div className="kanban-column-header">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{columnName}</h4>
                      <span className="text-sm text-gray-500 dark:text-gray-400">0</span>
                    </div>
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-gray-400 dark:text-gray-300 text-xl">📋</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Getting Started Guide */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-700 focus-hide">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
              🚀 Getting Started with TaskerADHD
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">🎤</span>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">1. Voice Capture</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Press the mic button and speak your tasks naturally. Our AI will organize them for you.
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">⚡</span>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">2. Energy Matching</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Tasks are tagged by energy level. Pick what matches your current state.
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-2">🎯</span>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">3. Focus Mode</h4>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Use time-boxing and focus mode to work distraction-free on important tasks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Task Form Modal */}
      {showTaskForm && (
        <TaskForm
          onSubmit={handleCreateTask}
          onCancel={() => setShowTaskForm(false)}
          isSubmitting={isCreatingTask}
        />
      )}

      {/* Voice Capture Modal */}
      <VoiceCaptureModal
        isOpen={showVoiceCapture}
        onClose={() => setShowVoiceCapture(false)}
      />

      {/* Staging Area Modal */}
      <StagingArea
        isOpen={showStaging}
        onClose={() => setShowStaging(false)}
      />

      {/* Energy Filter Modal */}
      <EnergyFilter
        isOpen={showEnergyFilter}
        onClose={() => {
          setShowEnergyFilter(false)
          setIsFiltered(false)
        }}
        onTasksFiltered={(tasks) => {
          setFilteredTasks(tasks)
          setIsFiltered(true)
        }}
      />

      {/* OpenAI Chat Modal */}
      <OpenAIChat
        isOpen={showChat}
        onClose={() => setShowChat(false)}
      />

      {/* Error handling moved to useEffect */}
    </div>
  )
}
