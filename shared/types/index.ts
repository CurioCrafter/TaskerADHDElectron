// Unified Task Interface - Used everywhere
export interface Task {
  id: string
  title: string
  description?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  energy: 'LOW' | 'MEDIUM' | 'HIGH'
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED'
  
  // Temporal fields
  createdAt: Date
  updatedAt: Date
  dueDate?: Date
  scheduledFor?: Date
  completedAt?: Date
  
  // Organization
  boardId: string
  columnId: string
  projectId?: string
  labels: string[]
  position?: number // For client compatibility
  
  // AI & Voice fields
  confidence?: number
  sourceTranscript?: string
  aiGenerated?: boolean
  clarificationNeeded?: boolean
  
  // Recurring task fields
  isRepeating: boolean
  repeatPattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'
  repeatInterval?: number
  repeatDays?: number[] // 0-6 for days of week
  repeatEndDate?: Date
  repeatCount?: number
  nextOccurrenceDate?: Date
  
  // Metadata
  estimatedMinutes?: number
  actualMinutes?: number
  subtasks?: Subtask[]
  attachments?: Attachment[]
  comments?: Comment[]
  
  // Demo flag
  isDemo?: boolean
  
  // Client compatibility fields
  summary?: string // Alias for description
  dueAt?: string // String version of dueDate
  estimateMin?: number // Alias for estimatedMinutes
  isRepeatable?: boolean // Alias for isRepeating
  transcriptId?: string
  createdById?: string
  column?: { id: string; name: string }
  parentTaskId?: string
  nextDueDate?: string
}

export interface TaskProposal extends Task {
  proposalId: string
  needsClarification: boolean
  clarificationQuestions?: string[]
  alternativeSuggestions?: string[]
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
  order: number
}

export interface Attachment {
  id: string
  name: string
  url: string
  type: string
  size: number
}

export interface Comment {
  id: string
  content: string
  authorId: string
  createdAt: Date
  updatedAt: Date
}

export interface BoardColumn {
  id: string
  name: string
  boardId: string
  position: number
  color?: string
  taskLimit?: number
  autoArchiveDays?: number
  tasks?: Task[] // For client compatibility
}

export interface BoardSettings {
  allowTaskEditing: boolean
  autoArchive: boolean
  archiveAfterDays: number
  showCompletedTasks: boolean
  taskOrdering: 'PRIORITY' | 'DUE_DATE' | 'CREATED_AT' | 'MANUAL'
}

export interface Board {
  id: string
  name: string
  description?: string
  type: 'PROJECT' | 'PERSONAL' | 'TEAM'
  columns: BoardColumn[]
  settings: BoardSettings
  createdAt: Date
  updatedAt: Date
  // Client compatibility fields
  _count?: {
    columns: number
    tasks: number
  }
  tags?: string[]
  status?: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED'
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  dueDate?: Date
  ownerId?: string
  owner?: { id: string; displayName?: string; email: string }
  members?: any[]
  tasks?: Task[]
}

export interface TaskContext {
  boardId: string
  boardName: string
  columns: string[]
  timezone: string
  userId?: string
}

export interface TaskProcessingResult {
  status: 'NEEDS_CLARIFICATION' | 'READY' | 'ERROR'
  transcript: string
  proposals: TaskProposal[]
  clarificationQuestions?: string[]
  confidence?: number
  error?: string
}

export interface ChatMessage {
  type: 'user' | 'ai'
  content: string
  timestamp: Date
}

// Legacy type mappings for backward compatibility
export type TaskPriority = Task['priority']
export type EnergyLevel = Task['energy']
export type BoardType = Board['type']
export type BoardPriority = 'LOW' | 'MEDIUM' | 'HIGH'
export type BoardStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED'
