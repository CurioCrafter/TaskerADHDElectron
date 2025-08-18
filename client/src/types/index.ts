// User and authentication types
export interface User {
  id: string
  email: string
  displayName?: string
  createdAt: string
  updatedAt: string
  settings?: UserSettings
}

export interface UserSettings {
  theme?: 'light' | 'dark' | 'low-stim'
  reducedMotion?: boolean
  highContrast?: boolean
  focusMode?: boolean
  timeFormat?: '12h' | '24h'
  voiceSettings?: {
    autoStart?: boolean
    wakeWord?: boolean
    language?: string
    aiClarifyThreshold?: number // 0..1 – confidence at/below which to ask clarifying questions
  }
  taskPreferences?: {
    defaultEnergy?: EnergyLevel
    defaultPriority?: TaskPriority
    maxTodayTasks?: number
    showSubtasks?: boolean
  }
}

// Board and task types
export type BoardType = 'PERSONAL' | 'PROJECT' | 'TEAM' | 'TEMPLATE'
export type BoardPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type BoardStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED'

export interface Board {
  id: string
  name: string
  description?: string
  type: BoardType
  priority: BoardPriority
  status: BoardStatus
  dueDate?: string
  tags: string[]
  metadata?: any
  ownerId: string
  owner: Pick<User, 'id' | 'displayName' | 'email'>
  columns: Column[]
  members: BoardMember[]
  tasks?: Task[]
  createdAt: string
  updatedAt: string
  _count?: {
    columns: number
    tasks: number
  }
}

export interface BoardMember {
  id: string
  boardId: string
  userId: string
  role: BoardRole
  user: Pick<User, 'id' | 'displayName' | 'email'>
}

export type BoardRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface Column {
  id: string
  boardId: string
  name: string
  position: number
  tasks: Task[]
}

export interface Task {
  id: string
  boardId: string
  columnId: string
  title: string
  summary?: string
  priority?: TaskPriority
  energy?: EnergyLevel
  dueAt?: string
  estimateMin?: number
  position: number
  labels: TaskLabel[]
  subtasks: Subtask[]
  createdById?: string
  createdAt: string
  updatedAt: string
  transcriptId?: string
  column?: Pick<Column, 'id' | 'name'>
  
  // Repeatable task fields
  isRepeatable?: boolean
  repeatPattern?: 'daily' | 'weekly' | 'monthly' | 'custom'
  repeatInterval?: number // e.g., every 2 days, every 3 weeks
  repeatDays?: number[] // for weekly: [1,3,5] = Mon,Wed,Fri (0=Sunday)
  repeatEndDate?: string
  repeatCount?: number // number of repetitions
  parentTaskId?: string // if this is a repeated instance
  nextDueDate?: string // when the next instance should be created
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type EnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface Subtask {
  id: string
  taskId: string
  title: string
  done: boolean
  position: number
}

export interface Label {
  id: string
  name: string
  color?: string
}

export interface TaskLabel {
  taskId: string
  labelId: string
  label: Label
}

// Voice and AI types
export interface Transcript {
  id: string
  userId: string
  text: string
  confidence?: number
  audioUrl?: string
  createdAt: string
  proposals: Proposal[]
}

export interface Proposal {
  id: string
  transcriptId: string
  json: ProposalData
  status: ProposalStatus
  createdAt: string
  transcript?: Pick<Transcript, 'id' | 'text' | 'confidence' | 'createdAt'>
}

export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'

export interface ProposalData {
  tasks: TaskProposal[]
  dedupeCandidates?: DedupCandidate[]
  boardId?: string
  processedAt?: string
  confidence?: number
  error?: string
  failedAt?: string
}

export interface TaskProposal {
  title: string
  summary?: string
  priority?: TaskPriority
  energy?: EnergyLevel
  dueAt?: string
  estimateMin?: number
  labels?: string[]
  subtasks?: string[]
  columnId?: string
  // Repeatable task fields - must match Task interface
  isRepeatable?: boolean
  repeatPattern?: 'daily' | 'weekly' | 'monthly' | 'custom'
  repeatInterval?: number
  repeatDays?: number[]
  repeatEndDate?: string
  repeatCount?: number
  parentTaskId?: string
  nextDueDate?: string
}

export interface DedupCandidate {
  taskTitle: string
  similarity: number
}

// Voice recording types
export interface VoiceSession {
  id: string
  transcriptId?: string
  boardId: string
  isRecording: boolean
  isProcessing: boolean
  error?: string
  transcript: {
    interim: string
    final: string
    confidence?: number
  }
}

// API response types
export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    hasMore: boolean
  }
}

// UI component types
export interface TaskFilterOptions {
  energy?: EnergyLevel
  priority?: TaskPriority
  dueDate?: string
  today?: boolean
  quickWins?: boolean
  labels?: string[]
  search?: string
}

export interface KanbanColumn {
  id: string
  name: string
  tasks: Task[]
  taskCount: number
  isDropTarget?: boolean
}

export interface VoiceControlState {
  isRecording: boolean
  isProcessing: boolean
  canRecord: boolean
  error?: string
  transcript: string
  confidence?: number
}

// Focus mode types
export interface FocusSession {
  id: string
  taskId: string
  task: Task
  startTime: string
  duration: number // in minutes
  breakTime?: number
  isActive: boolean
  completedTime?: string
}

export interface TimerSettings {
  workDuration: number
  shortBreak: number
  longBreak: number
  sessionsUntilLongBreak: number
  autoStartBreaks: boolean
  autoStartWork: boolean
  soundEnabled: boolean
}

// Notification types
export interface NotificationSettings {
  enabled: boolean
  taskReminders: boolean
  breakReminders: boolean
  dailyDigest: boolean
  soundEnabled: boolean
  pushEnabled: boolean
}

// Error types
export interface AppError {
  code: string
  message: string
  details?: any
  timestamp: string
}

// WebSocket message types
export interface SocketMessage {
  type: string
  payload: any
  timestamp: string
}

export interface VoiceSocketMessage extends SocketMessage {
  type: 'voice:start' | 'voice:chunk' | 'voice:stop' | 'voice:error' | 
        'transcript:interim' | 'transcript:final' | 'proposal:queued' | 'proposal:ready'
}

// Drag and drop types
export interface DragItem {
  type: 'task'
  id: string
  task: Task
  sourceColumnId: string
}

export interface DropResult {
  targetColumnId: string
  targetPosition: number
}

// Analytics and metrics types
export interface TaskMetrics {
  totalTasks: number
  completedTasks: number
  overdueTasks: number
  avgCompletionTime: number
  energyDistribution: Record<EnergyLevel, number>
  priorityDistribution: Record<TaskPriority, number>
}

export interface VoiceMetrics {
  totalSessions: number
  avgTranscriptLength: number
  avgConfidence: number
  tasksCreated: number
  successRate: number
}

// Export utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
