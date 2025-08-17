import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Board, Task, Column, TaskPriority, EnergyLevel, BoardType, BoardPriority, BoardStatus } from '@/types'
import { getAuthHeaders } from './auth'

interface BoardState {
  // State
  currentBoard: Board | null
  boards: Board[]
  isLoading: boolean
  error: string | null

  // Actions
  setCurrentBoard: (board: Board) => void
  setBoards: (boards: Board[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // API actions
  fetchBoards: () => Promise<void>
  fetchBoard: (boardId: string) => Promise<void>
  createBoard: (board: {
    name: string
    description?: string
    type?: BoardType
    priority?: BoardPriority
    status?: BoardStatus
    dueDate?: string
    tags?: string[]
    metadata?: any
  }) => Promise<Board | null>
  updateBoard: (boardId: string, updates: Partial<Board>) => Promise<void>
  deleteBoard: (boardId: string) => Promise<void>
  createTask: (task: {
    title: string
    summary?: string
    priority?: TaskPriority
    energy?: EnergyLevel
    dueAt?: string
    estimateMin?: number
    labels?: string[]
    columnId?: string
  }) => Promise<Task | null>
  moveTask: (taskId: string, columnId: string, position: number) => Promise<void>
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const useBoardStore = create<BoardState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentBoard: null,
      boards: [],
      isLoading: false,
      error: null,

      // Setters
      setCurrentBoard: (board: Board) => set({ currentBoard: board }),
      setBoards: (boards: Board[]) => set({ boards }),
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),

      // Fetch all boards
      fetchBoards: async () => {
        set({ isLoading: true, error: null })
        
        try {
          const authHeaders = getAuthHeaders()
          const response = await fetch(`${API_URL}/api/boards`, {
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            }
          })

          if (response.ok) {
            const data = await response.json()
            set({ boards: data.boards, isLoading: false })
            
            // Set a default board as current if none selected
            // Prefer personal/main boards over projects for the main dashboard
            if (data.boards.length > 0 && !get().currentBoard) {
              const defaultBoard = data.boards.find((b: any) => b.type !== 'PROJECT') || data.boards[0]
              set({ currentBoard: defaultBoard })
            }
          } else {
            // In development, handle 401 gracefully
            if (response.status === 401 && process.env.NODE_ENV === 'development') {
              console.log('Dev mode: Using empty boards for 401')
              set({ boards: [], isLoading: false, error: null })
              return
            }
            const error = await response.json()
            set({ error: error.error || 'Failed to fetch boards', isLoading: false })
          }
        } catch (error) {
          set({ error: 'Network error', isLoading: false })
        }
      },

      // Fetch specific board
      fetchBoard: async (boardId: string) => {
        set({ isLoading: true, error: null })
        
        try {
          const authHeaders = getAuthHeaders()
          const response = await fetch(`${API_URL}/api/boards/${boardId}`, {
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            }
          })

          if (response.ok) {
            const data = await response.json()
            set({ currentBoard: data.board, isLoading: false })
          } else {
            const error = await response.json()
            set({ error: error.error || 'Failed to fetch board', isLoading: false })
          }
        } catch (error) {
          set({ error: 'Network error', isLoading: false })
        }
      },

      // Create board
      createBoard: async (boardData) => {
        const authHeaders = getAuthHeaders()
        if (!authHeaders) return null

        set({ isLoading: true, error: null })

        try {
          // Create default columns for new boards
          const defaultColumns = boardData.type === 'PROJECT' 
            ? ['Backlog', 'To Do', 'In Progress', 'Review', 'Done']
            : ['Inbox', 'To Do', 'Doing', 'Done']

          const response = await fetch(`${API_URL}/api/boards`, {
            method: 'POST',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              ...boardData,
              type: boardData.type || 'PROJECT',
              priority: boardData.priority || 'MEDIUM',
              status: boardData.status || 'PLANNING',
              tags: boardData.tags || [],
              columns: defaultColumns
            })
          })

          if (!response.ok) throw new Error('Failed to create board')

          const data = await response.json()
          const board = data.board
          
          // Add to boards list
          set(state => ({
            boards: [...state.boards, board],
            isLoading: false
          }))

          return board
        } catch (error) {
          console.error('Create board error:', error)
          set({ error: 'Failed to create board', isLoading: false })
          return null
        }
      },

      // Update board
      updateBoard: async (boardId, updates) => {
        const authHeaders = getAuthHeaders()
        if (!authHeaders) return

        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`${API_URL}/api/boards/${boardId}`, {
            method: 'PATCH',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
          })

          if (!response.ok) throw new Error('Failed to update board')

          const updatedBoard = await response.json()
          
          // Update in state
          set(state => ({
            boards: state.boards.map(b => b.id === boardId ? updatedBoard : b),
            currentBoard: state.currentBoard?.id === boardId ? updatedBoard : state.currentBoard,
            isLoading: false
          }))
        } catch (error) {
          console.error('Update board error:', error)
          set({ error: 'Failed to update board', isLoading: false })
        }
      },

      // Delete board
      deleteBoard: async (boardId) => {
        const authHeaders = getAuthHeaders()
        if (!authHeaders) return

        set({ isLoading: true, error: null })

        try {
          const response = await fetch(`${API_URL}/api/boards/${boardId}`, {
            method: 'DELETE',
            headers: authHeaders
          })

          if (!response.ok) throw new Error('Failed to delete board')
          
          // Remove from state
          set(state => ({
            boards: state.boards.filter(b => b.id !== boardId),
            currentBoard: state.currentBoard?.id === boardId ? null : state.currentBoard,
            isLoading: false
          }))
        } catch (error) {
          console.error('Delete board error:', error)
          set({ error: 'Failed to delete board', isLoading: false })
        }
      },

      // Create task
      createTask: async (taskData) => {
        const { currentBoard } = get()
        if (!currentBoard) return null

        set({ isLoading: true, error: null })

        try {
          // Use first column (Inbox) if no column specified
          const columnId = taskData.columnId || currentBoard.columns[0]?.id
          if (!columnId) {
            set({ error: 'No columns available', isLoading: false })
            return null
          }

          const authHeaders = getAuthHeaders()
          const response = await fetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            },
            body: JSON.stringify({
              ...taskData,
              columnId
            })
          })

          if (response.ok) {
            const data = await response.json()
            
            // Refresh current board to get updated tasks
            await get().fetchBoard(currentBoard.id)
            set({ isLoading: false })
            
            return data.task
          } else {
            const error = await response.json()
            set({ error: error.error || 'Failed to create task', isLoading: false })
            return null
          }
        } catch (error) {
          set({ error: 'Network error', isLoading: false })
          return null
        }
      },

      // Move task
      moveTask: async (taskId: string, columnId: string, position: number) => {
        set({ isLoading: true, error: null })

        try {
          const authHeaders = getAuthHeaders()
          const response = await fetch(`${API_URL}/api/tasks/${taskId}/move`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            },
            body: JSON.stringify({ columnId, position })
          })

          if (response.ok) {
            // Refresh current board
            const { currentBoard } = get()
            if (currentBoard) {
              await get().fetchBoard(currentBoard.id)
            }
            set({ isLoading: false })
          } else {
            const error = await response.json()
            set({ error: error.error || 'Failed to move task', isLoading: false })
          }
        } catch (error) {
          set({ error: 'Network error', isLoading: false })
        }
      },

      // Update task
      updateTask: async (taskId: string, updates: Partial<Task>) => {
        set({ isLoading: true, error: null })

        try {
          const authHeaders = getAuthHeaders()
          const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            },
            body: JSON.stringify(updates)
          })

          if (response.ok) {
            // Refresh current board
            const { currentBoard } = get()
            if (currentBoard) {
              await get().fetchBoard(currentBoard.id)
            }
            set({ isLoading: false })
          } else {
            const error = await response.json()
            set({ error: error.error || 'Failed to update task', isLoading: false })
          }
        } catch (error) {
          set({ error: 'Network error', isLoading: false })
        }
      },

      // Delete task
      deleteTask: async (taskId: string) => {
        set({ isLoading: true, error: null })

        try {
          const authHeaders = getAuthHeaders()
          const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...authHeaders
            }
          })

          if (response.ok) {
            // Refresh current board
            const { currentBoard } = get()
            if (currentBoard) {
              await get().fetchBoard(currentBoard.id)
            }
            set({ isLoading: false })
          } else {
            const error = await response.json()
            set({ error: error.error || 'Failed to delete task', isLoading: false })
          }
        } catch (error) {
          set({ error: 'Network error', isLoading: false })
        }
      }
    }),
    {
      name: 'taskeradhd-board',
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      ),
      partialize: (state) => ({
        currentBoard: state.currentBoard,
        boards: state.boards
      }),
      version: 1
    }
  )
)
