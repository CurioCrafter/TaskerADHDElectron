import { ChatMessage, TaskContext } from '@/types/task.types'

export class ChatContextManager {
  private context: TaskContext
  private conversationHistory: ChatMessage[] = []
  private maxHistoryLength = 50

  constructor(context?: TaskContext) {
    this.context = context || {
      boardId: '',
      boardName: 'Default Board',
      columns: ['To Do', 'In Progress', 'Done'],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }

  /**
   * Update the current context
   */
  updateContext(newContext: Partial<TaskContext>): void {
    this.context = { ...this.context, ...newContext }
  }

  /**
   * Get the current context
   */
  getContext(): TaskContext {
    return this.context
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(message: ChatMessage): void {
    this.conversationHistory.push(message)
    
    // Keep only the last N messages to prevent memory bloat
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength)
    }
  }

  /**
   * Get recent conversation history
   */
  getRecentHistory(count: number = 10): ChatMessage[] {
    return this.conversationHistory.slice(-count)
  }

  /**
   * Get conversation context for AI prompts
   */
  getConversationContext(): string {
    const recentMessages = this.getRecentHistory(5)
    const contextInfo = `
Current Board: ${this.context.boardName}
Available Columns: ${this.context.columns.join(', ')}
User Timezone: ${this.context.timezone}
Current Time: ${new Date().toISOString()}
    `.trim()

    if (recentMessages.length === 0) {
      return contextInfo
    }

    const conversationSummary = recentMessages
      .map(msg => `${msg.type === 'user' ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n')

    return `${contextInfo}\n\nRecent Conversation:\n${conversationSummary}`
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = []
  }

  /**
   * Get conversation summary for AI context
   */
  getSummary(): string {
    const totalMessages = this.conversationHistory.length
    const userMessages = this.conversationHistory.filter(m => m.type === 'user').length
    const aiMessages = this.conversationHistory.filter(m => m.type === 'ai').length

    return `Conversation Summary: ${totalMessages} total messages (${userMessages} user, ${aiMessages} AI)`
  }

  /**
   * Export conversation for debugging
   */
  exportConversation(): string {
    return JSON.stringify({
      context: this.context,
      conversation: this.conversationHistory,
      summary: this.getSummary(),
      exportedAt: new Date().toISOString()
    }, null, 2)
  }
}
