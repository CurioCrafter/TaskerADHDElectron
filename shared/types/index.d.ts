export interface Task {
    id: string;
    title: string;
    description?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    energy: 'LOW' | 'MEDIUM' | 'HIGH';
    status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
    createdAt: Date;
    updatedAt: Date;
    dueDate?: Date;
    scheduledFor?: Date;
    completedAt?: Date;
    boardId: string;
    columnId: string;
    projectId?: string;
    labels: string[];
    position?: number;
    confidence?: number;
    sourceTranscript?: string;
    aiGenerated?: boolean;
    clarificationNeeded?: boolean;
    isRepeating: boolean;
    repeatPattern?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
    repeatInterval?: number;
    repeatDays?: number[];
    repeatEndDate?: Date;
    repeatCount?: number;
    nextOccurrenceDate?: Date;
    estimatedMinutes?: number;
    actualMinutes?: number;
    subtasks?: Subtask[];
    attachments?: Attachment[];
    comments?: Comment[];
    isDemo?: boolean;
    summary?: string;
    dueAt?: string;
    estimateMin?: number;
    isRepeatable?: boolean;
    transcriptId?: string;
    createdById?: string;
    column?: {
        id: string;
        name: string;
    };
    parentTaskId?: string;
    nextDueDate?: string;
}
export interface TaskProposal extends Task {
    proposalId: string;
    needsClarification: boolean;
    clarificationQuestions?: string[];
    alternativeSuggestions?: string[];
}
export interface Subtask {
    id: string;
    title: string;
    completed: boolean;
    order: number;
}
export interface Attachment {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
}
export interface Comment {
    id: string;
    content: string;
    authorId: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface BoardColumn {
    id: string;
    name: string;
    boardId: string;
    position: number;
    color?: string;
    taskLimit?: number;
    autoArchiveDays?: number;
    tasks?: Task[];
}
export interface BoardSettings {
    allowTaskEditing: boolean;
    autoArchive: boolean;
    archiveAfterDays: number;
    showCompletedTasks: boolean;
    taskOrdering: 'PRIORITY' | 'DUE_DATE' | 'CREATED_AT' | 'MANUAL';
}
export interface Board {
    id: string;
    name: string;
    description?: string;
    type: 'PROJECT' | 'PERSONAL' | 'TEAM';
    columns: BoardColumn[];
    settings: BoardSettings;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
        columns: number;
        tasks: number;
    };
    tags?: string[];
    status?: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    dueDate?: Date;
    ownerId?: string;
    owner?: {
        id: string;
        displayName?: string;
        email: string;
    };
    members?: any[];
    tasks?: Task[];
}
export interface TaskContext {
    boardId: string;
    boardName: string;
    columns: string[];
    timezone: string;
    userId?: string;
}
export interface TaskProcessingResult {
    status: 'NEEDS_CLARIFICATION' | 'READY' | 'ERROR';
    transcript: string;
    proposals: TaskProposal[];
    clarificationQuestions?: string[];
    confidence?: number;
    error?: string;
}
export interface ChatMessage {
    type: 'user' | 'ai';
    content: string;
    timestamp: Date;
}
export type TaskPriority = Task['priority'];
export type EnergyLevel = Task['energy'];
export type BoardType = Board['type'];
export type BoardPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type BoardStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';
//# sourceMappingURL=index.d.ts.map