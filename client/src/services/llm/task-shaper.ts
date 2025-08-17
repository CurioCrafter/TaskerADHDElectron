// LLM Task Shaper - Converts voice transcripts into structured task proposals

import type { TranscriptChunk } from '@/types/stt'

export interface TaskProposal {
  id: string
  title: string
  summary?: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  energy?: 'LOW' | 'MEDIUM' | 'HIGH'
  dueAt?: string // ISO date string
  estimateMin?: number
  labels?: string[]
  subtasks?: string[]
  confidence: number // 0-1 confidence in the proposal
  reasoning?: string // Why the LLM made these choices
}

export interface TaskShapingResult {
  tasks: TaskProposal[]
  summary?: string
  dedupeCandidates?: Array<{
    taskId: string
    similarity: number
    reason: string
  }>
  uncertainties?: Array<{
    field: string
    value: string
    reason: string
  }>
  processingTime: number
}

export interface TaskShapingConfig {
  maxTasks: number
  includeSubtasks: boolean
  includeSummary: boolean
  checkDuplicates: boolean
  currentTasks?: Array<{ id: string; title: string; summary?: string }>
  userTimezone: string
  shaperPreset: 'tasks' | 'meeting' | 'project' | 'journal'
}

export class TaskShaper {
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async shapeTranscript(
    transcript: string,
    config: TaskShapingConfig
  ): Promise<TaskShapingResult> {
    const startTime = Date.now()

    try {
      const systemPrompt = this.buildSystemPrompt(config)
      const userPrompt = this.buildUserPrompt(transcript, config)

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Fast and cost-effective for task shaping
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3, // Lower temperature for more consistent output
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        })
      })

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.choices[0].message.content

      let result: TaskShapingResult
      try {
        const parsed = JSON.parse(content)
        result = this.validateAndProcessResult(parsed, config)
      } catch (parseError) {
        throw new Error(`Failed to parse LLM response: ${parseError}`)
      }

      result.processingTime = Date.now() - startTime
      
      console.log('🤖 Task shaping completed:', {
        tasksGenerated: result.tasks.length,
        processingTime: result.processingTime,
        duplicatesFound: result.dedupeCandidates?.length || 0
      })

      return result

    } catch (error) {
      console.error('🚨 Task shaping failed:', error)
      throw error
    }
  }

  private buildSystemPrompt(config: TaskShapingConfig): string {
    const preset = config.shaperPreset
    
    const basePrompt = `You are an ADHD-friendly task shaping assistant. Convert voice transcripts into actionable, atomic tasks.

CORE PRINCIPLES:
- Create concrete, actionable tasks with clear verbs
- Split compound items into separate atomic tasks
- Never hallucinate facts not mentioned in the transcript
- Flag uncertainties clearly
- Prefer specific over vague language
- Consider executive function challenges

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "tasks": [
    {
      "title": "Concrete action with clear verb",
      "summary": "Optional context or details",
      "priority": "LOW|MEDIUM|HIGH|URGENT",
      "energy": "LOW|MEDIUM|HIGH", 
      "dueAt": "ISO date string or null",
      "estimateMin": number or null,
      "labels": ["category", "context"],
      "subtasks": ["atomic step 1", "atomic step 2"],
      "confidence": 0.95,
      "reasoning": "Why these choices were made"
    }
  ],
  "summary": "Brief bullet-point summary of transcript",
  "dedupeCandidates": [
    {
      "taskId": "existing-task-id",
      "similarity": 0.85,
      "reason": "Similar action and context"
    }
  ],
  "uncertainties": [
    {
      "field": "dueAt",
      "value": "next Friday",
      "reason": "Ambiguous date reference"
    }
  ]
}`

    const presetInstructions = {
      tasks: `
TASK PRESET:
- Focus on creating actionable tasks
- Include time estimates for planning
- Use energy levels: LOW (admin, quick calls), MEDIUM (focused work), HIGH (creative, complex)
- Set priorities based on urgency and impact`,

      meeting: `
MEETING PRESET:
- Extract action items and decisions
- Include who is responsible (if mentioned)
- Note follow-up dates and deadlines
- Create summary of key decisions and next steps`,

      project: `
PROJECT PRESET:
- Break down project into phases and milestones
- Identify dependencies between tasks
- Estimate effort for each component
- Include research and planning tasks`,

      journal: `
JOURNAL PRESET:
- Focus on reflection and insights
- Extract any mentioned goals or intentions
- Create follow-up tasks for mentioned ideas
- Summarize key themes and emotions`
    }

    return basePrompt + presetInstructions[preset]
  }

  private buildUserPrompt(transcript: string, config: TaskShapingConfig): string {
    let prompt = `Transcript to shape into tasks:\n"${transcript}"\n\n`

    prompt += `Context:\n`
    prompt += `- Max tasks: ${config.maxTasks}\n`
    prompt += `- Include subtasks: ${config.includeSubtasks}\n`
    prompt += `- Include summary: ${config.includeSummary}\n`
    prompt += `- User timezone: ${config.userTimezone}\n`
    prompt += `- Today: ${new Date().toLocaleDateString()}\n\n`

    if (config.checkDuplicates && config.currentTasks && config.currentTasks.length > 0) {
      prompt += `Existing tasks to check for duplicates:\n`
      config.currentTasks.slice(0, 20).forEach(task => {
        prompt += `- ID: ${task.id}, Title: "${task.title}"\n`
      })
      prompt += '\n'
    }

    prompt += `Return the JSON response with shaped tasks following the system instructions.`

    return prompt
  }

  private validateAndProcessResult(parsed: any, config: TaskShapingConfig): TaskShapingResult {
    // Validate structure
    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error('Invalid response: missing tasks array')
    }

    // Validate and process tasks
    const tasks: TaskProposal[] = parsed.tasks.slice(0, config.maxTasks).map((task: any, index: number) => {
      if (!task.title || typeof task.title !== 'string') {
        throw new Error(`Task ${index}: missing or invalid title`)
      }

      // Generate ID for the proposal
      const id = `proposal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Validate enums
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
      const validEnergies = ['LOW', 'MEDIUM', 'HIGH']

      const priority = validPriorities.includes(task.priority) ? task.priority : undefined
      const energy = validEnergies.includes(task.energy) ? task.energy : undefined

      // Validate due date
      let dueAt: string | undefined
      if (task.dueAt) {
        try {
          const date = new Date(task.dueAt)
          if (!isNaN(date.getTime())) {
            dueAt = date.toISOString()
          }
        } catch {
          // Invalid date, ignore
        }
      }

      // Validate estimate
      const estimateMin = typeof task.estimateMin === 'number' && task.estimateMin > 0 
        ? Math.min(task.estimateMin, 480) // Cap at 8 hours
        : undefined

      // Validate arrays
      const labels = Array.isArray(task.labels) 
        ? task.labels.filter((l: any) => typeof l === 'string').slice(0, 5)
        : []

      const subtasks = Array.isArray(task.subtasks) && config.includeSubtasks
        ? task.subtasks.filter((s: any) => typeof s === 'string').slice(0, 10)
        : []

      // Validate confidence
      const confidence = typeof task.confidence === 'number' 
        ? Math.max(0, Math.min(1, task.confidence))
        : 0.8 // Default confidence

      return {
        id,
        title: task.title.trim(),
        summary: typeof task.summary === 'string' ? task.summary.trim() : undefined,
        priority,
        energy,
        dueAt,
        estimateMin,
        labels,
        subtasks,
        confidence,
        reasoning: typeof task.reasoning === 'string' ? task.reasoning.trim() : undefined
      }
    })

    // Process dedupe candidates
    const dedupeCandidates = Array.isArray(parsed.dedupeCandidates) && config.checkDuplicates
      ? parsed.dedupeCandidates
          .filter((dup: any) => dup.taskId && typeof dup.similarity === 'number')
          .slice(0, 10)
          .map((dup: any) => ({
            taskId: dup.taskId,
            similarity: Math.max(0, Math.min(1, dup.similarity)),
            reason: typeof dup.reason === 'string' ? dup.reason : 'Similar task detected'
          }))
      : []

    // Process uncertainties
    const uncertainties = Array.isArray(parsed.uncertainties)
      ? parsed.uncertainties
          .filter((unc: any) => unc.field && unc.value)
          .slice(0, 10)
          .map((unc: any) => ({
            field: unc.field,
            value: unc.value,
            reason: typeof unc.reason === 'string' ? unc.reason : 'Uncertain value'
          }))
      : []

    // Process summary
    const summary = config.includeSummary && typeof parsed.summary === 'string'
      ? parsed.summary.trim()
      : undefined

    return {
      tasks,
      summary,
      dedupeCandidates,
      uncertainties,
      processingTime: 0 // Will be set by caller
    }
  }

  // Helper method to get shaper presets
  static getPresets(): Array<{ id: string; name: string; description: string }> {
    return [
      {
        id: 'tasks',
        name: 'Task Focus',
        description: 'Extract actionable tasks with time estimates and priorities'
      },
      {
        id: 'meeting',
        name: 'Meeting Notes',
        description: 'Capture action items, decisions, and follow-ups from meetings'
      },
      {
        id: 'project',
        name: 'Project Planning',
        description: 'Break down projects into phases, milestones, and dependencies'
      },
      {
        id: 'journal',
        name: 'Reflection & Insights',
        description: 'Extract goals, insights, and follow-up ideas from journaling'
      }
    ]
  }
}
