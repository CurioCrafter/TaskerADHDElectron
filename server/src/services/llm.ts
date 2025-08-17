import { z } from 'zod';

// Schemas for LLM input/output validation
const TaskProposalSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(1000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  energy: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueAt: z.string().datetime().optional(),
  estimateMin: z.number().int().min(1).max(1440).optional(),
  labels: z.array(z.string()).optional(),
  subtasks: z.array(z.string()).optional(),
  columnName: z.string().optional(), // AI-suggested column assignment
  scheduledFor: z.string().datetime().optional(), // Calendar integration
  recurrence: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional() // Recurring tasks
});

const LLMResponseSchema = z.object({
  tasks: z.array(TaskProposalSchema),
  dedupeCandidates: z.array(z.object({
    taskTitle: z.string(),
    similarity: z.number().min(0).max(1)
  })).optional()
});

export type TaskProposal = z.infer<typeof TaskProposalSchema>;
export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// Board context interfaces
export interface BoardContext {
  columns: Array<{ id: string; name: string }>;
  recentTasks: Array<{ title: string; labels: string[] }>;
}

export interface ShapingContext {
  transcriptText: string;
  boardContext: BoardContext;
  userTimezone?: string;
}

// Mock LLM Provider for development
class MockLLMProvider {
  async shapeTranscript(context: ShapingContext): Promise<LLMResponse> {
    const { transcriptText, boardContext } = context;
    
    console.log('🤖 MockLLM: Processing transcript:', transcriptText.substring(0, 100) + '...');
    console.log('🤖 MockLLM: Available columns:', boardContext.columns.map(c => c.name).join(', '));
    
    // Simple parsing for demo
    const tasks: TaskProposal[] = [];
    const sentences = transcriptText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    for (const sentence of sentences) {
      const text = sentence.trim();
      if (text.length < 5) continue;
      
      // Extract task-like patterns
      const taskPatterns = [
        /(?:remember to|need to|have to|should|must)\s+(.+)/i,
        /(?:call|email|contact)\s+(.+)/i,
        /(?:buy|get|order|purchase)\s+(.+)/i,
        /(?:write|draft|create)\s+(.+)/i,
        /(?:schedule|book|arrange)\s+(.+)/i,
        /(?:update|fix|review|check)\s+(.+)/i
      ];
      
      let taskTitle = text;
      let priority: TaskProposal['priority'] = 'MEDIUM';
      let energy: TaskProposal['energy'] = 'MEDIUM';
      let labels: string[] = [];
      let columnName = 'Inbox'; // Default column
      let dueAt: string | undefined;
      let scheduledFor: string | undefined;
      
      // Extract action and determine priority/energy
      for (const pattern of taskPatterns) {
        const match = text.match(pattern);
        if (match) {
          taskTitle = match[1];
          break;
        }
      }
      
      // Determine priority and column based on keywords
      if (/urgent|asap|immediately|critical/i.test(text)) {
        priority = 'URGENT';
        energy = 'HIGH';
        columnName = this.findBestColumn(boardContext.columns, ['To Do', 'Doing', 'In Progress']);
      } else if (/important|priority|soon/i.test(text)) {
        priority = 'HIGH';
        energy = 'MEDIUM';
        columnName = this.findBestColumn(boardContext.columns, ['To Do']);
      } else if (/quick|simple|easy/i.test(text)) {
        priority = 'LOW';
        energy = 'LOW';
        columnName = this.findBestColumn(boardContext.columns, ['Inbox', 'To Do']);
      } else if (/started|begin|working on/i.test(text)) {
        columnName = this.findBestColumn(boardContext.columns, ['Doing', 'In Progress']);
      } else if (/plan|think about|research/i.test(text)) {
        columnName = this.findBestColumn(boardContext.columns, ['Backlog', 'Planning', 'Inbox']);
      }
      
      // Extract time-based information for scheduling
      const timePatterns = [
        { pattern: /tomorrow/i, days: 1 },
        { pattern: /next week/i, days: 7 },
        { pattern: /monday/i, days: this.getDaysUntilWeekday(1) },
        { pattern: /tuesday/i, days: this.getDaysUntilWeekday(2) },
        { pattern: /wednesday/i, days: this.getDaysUntilWeekday(3) },
        { pattern: /thursday/i, days: this.getDaysUntilWeekday(4) },
        { pattern: /friday/i, days: this.getDaysUntilWeekday(5) },
        { pattern: /(\d+)\s*(?:am|pm)/i, hours: true },
      ];
      
      for (const timePattern of timePatterns) {
        if (timePattern.pattern.test(text)) {
          const now = new Date();
          if (timePattern.days) {
            const targetDate = new Date(now.getTime() + timePattern.days * 24 * 60 * 60 * 1000);
            dueAt = targetDate.toISOString();
            if (timePattern.days <= 2) {
              scheduledFor = targetDate.toISOString();
            }
          } else if (timePattern.hours) {
            const hourMatch = text.match(/(\d+)\s*(am|pm)/i);
            if (hourMatch) {
              const hour = parseInt(hourMatch[1]);
              const isPM = hourMatch[2].toLowerCase() === 'pm';
              const targetDate = new Date(now);
              targetDate.setHours(isPM && hour !== 12 ? hour + 12 : (hour === 12 && !isPM ? 0 : hour), 0, 0, 0);
              if (targetDate <= now) {
                targetDate.setDate(targetDate.getDate() + 1);
              }
              scheduledFor = targetDate.toISOString();
            }
          }
          break;
        }
      }
      
      // Extract labels based on content
      if (/call|phone|contact/i.test(text)) {
        labels.push('communication');
      }
      if (/email|send|message/i.test(text)) {
        labels.push('email');
      }
      if (/buy|order|purchase|shop/i.test(text)) {
        labels.push('shopping');
      }
      if (/meeting|schedule|appointment/i.test(text)) {
        labels.push('calendar');
      }
      if (/work|project|office/i.test(text)) {
        labels.push('work');
      }
      if (/home|house|personal/i.test(text)) {
        labels.push('personal');
      }
      
      // Estimate time based on task type
      let estimateMin = 15; // Default
      if (/call|phone/i.test(text)) {
        estimateMin = 10;
      } else if (/email|message/i.test(text)) {
        estimateMin = 5;
      } else if (/write|draft|create/i.test(text)) {
        estimateMin = 30;
      } else if (/meeting|appointment/i.test(text)) {
        estimateMin = 60;
      }
      
      // Clean up title
      taskTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);
      if (!taskTitle.match(/[.!?]$/)) {
        taskTitle += '';
      }
      
      // Generate subtasks for complex tasks
      const subtasks: string[] = [];
      if (energy === 'HIGH' || estimateMin > 20) {
        if (/email|contact/i.test(text)) {
          subtasks.push('Draft the message');
          subtasks.push('Review and send');
        } else if (/meeting|schedule/i.test(text)) {
          subtasks.push('Check calendar availability');
          subtasks.push('Send meeting invite');
        } else if (/write|create/i.test(text)) {
          subtasks.push('Create outline');
          subtasks.push('Write first draft');
          subtasks.push('Review and edit');
        }
      }
      
      const task: TaskProposal = {
        title: taskTitle,
        priority,
        energy,
        estimateMin,
        labels: labels.length > 0 ? labels : undefined,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
        columnName,
        dueAt,
        scheduledFor
      };
      
      console.log('🤖 MockLLM: Generated task:', { title: task.title, columnName: task.columnName, priority: task.priority });
      tasks.push(task);
    }
    
    // Limit to max 7 tasks as per ADHD-friendly design
    const finalTasks = tasks.slice(0, 7);
    
    console.log(`🤖 MockLLM: Generated ${finalTasks.length} tasks total`);
    
    return {
      tasks: finalTasks,
      dedupeCandidates: [] // TODO: Implement deduplication logic
    };
  }

  private findBestColumn(availableColumns: Array<{ id: string; name: string }>, preferredColumns: string[]): string {
    for (const preferred of preferredColumns) {
      const found = availableColumns.find(col => col.name === preferred);
      if (found) return found.name;
    }
    // Fallback to first available column
    return availableColumns[0]?.name || 'Inbox';
  }

  private getDaysUntilWeekday(targetDay: number): number {
    const today = new Date().getDay();
    const diff = targetDay - today;
    return diff <= 0 ? diff + 7 : diff;
  }
}

// OpenAI LLM Provider for production
class OpenAILLMProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gpt-3.5-turbo') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async shapeTranscript(context: ShapingContext): Promise<LLMResponse> {
    const { transcriptText, boardContext, userTimezone = 'UTC' } = context;
    
    const systemPrompt = `You are a task-shaping assistant for an ADHD-friendly task management system. Convert the user's transcript into atomic, actionable tasks with intelligent column placement and calendar integration.

IMPORTANT GUIDELINES:
- Prefer concrete action verbs (call, email, buy, schedule, write, etc.)
- Split compound items into separate tasks
- Assign tasks to appropriate columns based on their status and urgency
- Infer reasonable due dates and scheduled times when the transcript contains time cues
- Label tasks with energy level (LOW/MEDIUM/HIGH) based on complexity and cognitive load
- Never hallucinate facts or add information not present in the transcript
- Cap output to maximum 7 tasks to avoid overwhelming ADHD users
- Mark uncertain items with summary notes like "(uncertain: person name?)"

COLUMN ASSIGNMENT LOGIC:
- "Inbox": New ideas, unclear tasks, things to review later
- "To Do": Ready-to-start tasks, clearly defined actions
- "Doing"/"In Progress": Currently working on, started tasks
- "Done": Completed tasks (don't assign here)
- "Backlog"/"Planning": Future ideas, not yet ready to start
- "Review": Tasks waiting for approval or feedback

ENERGY LEVELS:
- LOW: Quick, routine tasks (5-15 min, low cognitive load)
- MEDIUM: Standard tasks requiring focus (15-45 min, moderate complexity)  
- HIGH: Complex tasks requiring deep work (45+ min, high cognitive load)

CALENDAR INTEGRATION:
- Set "dueAt" for tasks with clear deadlines
- Set "scheduledFor" for tasks with specific times (meetings, appointments)
- Use "recurrence" for recurring tasks (daily, weekly, monthly)

Return strictly valid JSON matching the TypeScript schema provided.`;

    const userPrompt = `Context:
- Current board columns: ${boardContext.columns.map(c => c.name).join(', ')}
- Recent tasks (for deduplication): ${boardContext.recentTasks.map(t => t.title).slice(0, 10).join('; ')}
- User timezone: ${userTimezone}
- Today is: ${new Date().toISOString().split('T')[0]}

Transcript:
"${transcriptText}"

Return JSON matching this TypeScript type:
type Output = {
  tasks: {
    title: string;
    summary?: string;
    priority?: "LOW"|"MEDIUM"|"HIGH"|"URGENT";
    energy?: "LOW"|"MEDIUM"|"HIGH";
    dueAt?: string; // ISO 8601 or omit
    labels?: string[];
    estimateMin?: number;
    subtasks?: string[];
    columnName?: string; // Must match one of the available column names
    scheduledFor?: string; // ISO 8601 for calendar scheduling
    recurrence?: "DAILY"|"WEEKLY"|"MONTHLY"; // For recurring tasks
  }[];
  dedupeCandidates?: { taskTitle: string; similarity: number }[];
}`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      // Parse and validate JSON response
      const parsedResponse = JSON.parse(content);
      return LLMResponseSchema.parse(parsedResponse);

    } catch (error) {
      console.error('OpenAI LLM error:', error);
      throw new Error(`AI processing failed: ${error}`);
    }
  }
}

// Factory function to create LLM provider
function createLLMProvider() {
  const provider = process.env.LLM_PROVIDER || 'mock';
  
  switch (provider) {
    case 'openai':
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn('OpenAI API key not found, falling back to mock LLM');
        return new MockLLMProvider();
      }
      return new OpenAILLMProvider(apiKey);
    
    case 'mock':
    default:
      return new MockLLMProvider();
  }
}

// Main export function
export async function shapeTranscriptWithAI(context: ShapingContext): Promise<LLMResponse> {
  const provider = createLLMProvider();
  
  try {
    const result = await provider.shapeTranscript(context);
    
    // Additional validation and safety checks
    if (!result.tasks || result.tasks.length === 0) {
      throw new Error('No tasks generated from transcript');
    }
    
    // Cap to 7 tasks maximum for ADHD-friendly design
    if (result.tasks.length > 7) {
      result.tasks = result.tasks.slice(0, 7);
    }
    
    return result;
    
  } catch (error) {
    console.error('LLM shaping error:', error);
    throw error;
  }
}
