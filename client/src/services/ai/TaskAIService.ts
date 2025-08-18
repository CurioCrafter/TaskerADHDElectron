import { Task, TaskProposal, TaskContext, TaskProcessingResult, ChatMessage } from '@/types/task.types'
import { ChatContextManager } from './ChatContextManager'

export class TaskAIService {
  private openAIKey: string
  private deepgramKey: string
  private contextManager: ChatContextManager

  constructor(openAIKey: string, deepgramKey: string) {
    this.openAIKey = openAIKey
    this.deepgramKey = deepgramKey
    this.contextManager = new ChatContextManager()
  }

  /**
   * Main entry point for voice-to-task conversion
   */
  async processVoiceInput(audioBlob: Blob): Promise<TaskProcessingResult> {
    try {
      // Step 1: Transcribe with Deepgram
      const transcript = await this.transcribeAudio(audioBlob)
      
      // Step 2: Extract context and intent
      const context = await this.extractContext(transcript)
      
      // Step 3: Generate task proposals
      const proposals = await this.generateTaskProposals(transcript, context)
      
      // Step 4: Check if clarification needed
      if (this.needsClarification(proposals)) {
        return {
          status: 'NEEDS_CLARIFICATION',
          transcript,
          proposals,
          clarificationQuestions: await this.generateQuestions(proposals)
        }
      }
      
      return {
        status: 'READY',
        transcript,
        proposals,
        confidence: this.calculateConfidence(proposals)
      }
    } catch (error) {
      console.error('Task processing failed:', error)
      return {
        status: 'ERROR',
        transcript: '',
        proposals: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Transcribe audio using Deepgram
   */
  private async transcribeAudio(audioBlob: Blob): Promise<string> {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')
      
      const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&diarize=true', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.deepgramKey}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Deepgram API error: ${response.status}`)
      }

      const data = await response.json()
      return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
    } catch (error) {
      console.error('Transcription failed:', error)
      throw new Error('Failed to transcribe audio. Please try again.')
    }
  }

  /**
   * Extract context from transcript
   */
  private async extractContext(transcript: string): Promise<TaskContext> {
    // For now, return default context - this could be enhanced with AI analysis
    return {
      boardId: 'default',
      boardName: 'Main Board',
      columns: ['To Do', 'In Progress', 'Done'],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }

  /**
   * Generates structured task proposals from transcript
   */
  private async generateTaskProposals(
    transcript: string, 
    context: TaskContext
  ): Promise<TaskProposal[]> {
    const systemPrompt = `
You are an ADHD-friendly task assistant. Convert voice input into detailed, actionable tasks.

CRITICAL REQUIREMENTS:
1. Extract ALL temporal information (dates, times, deadlines)
2. Identify if task should repeat (daily, weekly, monthly patterns)
3. Assign appropriate priority based on urgency words
4. Estimate time needed (in minutes)
5. Generate helpful labels/tags
6. Create subtasks for complex items
7. Set energy level required
8. ALWAYS set isRepeating to true if words like "every", "daily", "weekly", "monthly" are present
9. ALWAYS set dueDate to today's date if no specific date is mentioned
10. ALWAYS populate ALL fields with reasonable defaults

Current context:
- User timezone: ${context.timezone}
- Current date/time: ${new Date().toISOString()}
- Active board: ${context.boardName}
- Available columns: ${context.columns.join(', ')}

Return JSON with this structure:
{
  "tasks": [{
    "title": "Clear, action-oriented title",
    "description": "Detailed description if needed",
    "priority": "LOW|MEDIUM|HIGH|URGENT",
    "energy": "LOW|MEDIUM|HIGH",
    "dueDate": "ISO date string or null",
    "scheduledFor": "ISO date string or null",
    "isRepeating": boolean,
    "repeatPattern": "DAILY|WEEKLY|MONTHLY|null",
    "repeatInterval": number or null,
    "repeatDays": [0-6] or null,
    "estimatedMinutes": number,
    "labels": ["label1", "label2"],
    "subtasks": ["subtask1", "subtask2"],
    "confidence": 0.0-1.0,
    "needsClarification": boolean,
    "clarificationNeeded": ["what needs clarifying"]
  }],
  "metadata": {
    "totalTasks": number,
    "requiresReview": boolean,
    "suggestedColumn": "column name"
  }
}
`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: transcript }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const result = JSON.parse(data.choices[0].message.content)
      
      // Transform to TaskProposal format
      return result.tasks.map((task: any) => ({
        ...task,
        id: `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        proposalId: `prop_${Date.now()}`,
        boardId: context.boardId,
        columnId: this.selectBestColumn(task, context.columns),
        status: 'TODO',
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceTranscript: transcript,
        aiGenerated: true,
        // Ensure required fields have defaults
        isRepeating: task.isRepeating || false,
        repeatPattern: task.repeatPattern || null,
        repeatInterval: task.repeatInterval || 1,
        repeatDays: task.repeatDays || null,
        estimatedMinutes: task.estimatedMinutes || 30,
        labels: task.labels || [],
        subtasks: task.subtasks || [],
        confidence: task.confidence || 0.7,
        needsClarification: task.needsClarification || false,
        clarificationNeeded: task.clarificationNeeded || []
      }))
    } catch (error) {
      console.error('OpenAI API call failed:', error)
      throw new Error('Failed to generate task proposals. Please check your API key and try again.')
    }
  }

  /**
   * Select the best column for a task
   */
  private selectBestColumn(task: any, columns: string[]): string {
    // Simple logic - could be enhanced with AI
    if (task.status === 'DONE') {
      return columns.find(col => col.toLowerCase().includes('done')) || columns[0]
    }
    if (task.status === 'IN_PROGRESS') {
      return columns.find(col => col.toLowerCase().includes('progress')) || columns[1] || columns[0]
    }
    return columns[0] // Default to first column
  }

  /**
   * Check if proposals need clarification
   */
  private needsClarification(proposals: TaskProposal[]): boolean {
    return proposals.some(proposal => 
      proposal.needsClarification || 
      !proposal.dueDate || 
      (proposal.isRepeating && !proposal.repeatPattern) ||
      !proposal.estimatedMinutes
    )
  }

  /**
   * Interactive clarification chat
   */
  async clarifyTask(
    proposal: TaskProposal, 
    userResponse: string
  ): Promise<TaskProposal> {
    const prompt = `
Original task proposal: ${JSON.stringify(proposal)}
User clarification: "${userResponse}"

Update the task with the new information. Focus on:
1. Filling in missing temporal information
2. Adjusting priority if mentioned
3. Adding specific details to description
4. Setting up recurrence if applicable

Return the updated task in the same JSON format.
`

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openAIKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: 'You are a task clarification assistant. Return only valid JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`)
      }

      const data = await response.json()
      const updatedTask = JSON.parse(data.choices[0].message.content)
      
      return {
        ...proposal,
        ...updatedTask,
        updatedAt: new Date()
      }
    } catch (error) {
      console.error('Task clarification failed:', error)
      // Return original proposal if clarification fails
      return proposal
    }
  }

  /**
   * Generates contextual questions for clarification
   */
  private async generateQuestions(proposals: TaskProposal[]): Promise<string[]> {
    const questions: string[] = []
    
    for (const proposal of proposals) {
      if (!proposal.dueDate && proposal.priority === 'URGENT') {
        questions.push(`When does "${proposal.title}" need to be completed?`)
      }
      
      if (proposal.isRepeating && !proposal.repeatPattern) {
        questions.push(`How often should "${proposal.title}" repeat? (daily, weekly, monthly)`)
      }
      
      if (!proposal.estimatedMinutes) {
        questions.push(`How long do you think "${proposal.title}" will take?`)
      }
      
      if (proposal.needsClarification && proposal.clarificationQuestions) {
        questions.push(...proposal.clarificationQuestions)
      }
    }
    
    return questions.slice(0, 3) // Limit to 3 questions max
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(proposals: TaskProposal[]): number {
    if (proposals.length === 0) return 0
    
    const totalConfidence = proposals.reduce((sum, proposal) => sum + (proposal.confidence || 0), 0)
    return totalConfidence / proposals.length
  }

  /**
   * Update context manager
   */
  updateContext(context: Partial<TaskContext>): void {
    this.contextManager.updateContext(context)
  }

  /**
   * Add conversation message
   */
  addMessage(message: ChatMessage): void {
    this.contextManager.addMessage(message)
  }
}
