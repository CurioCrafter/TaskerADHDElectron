'use client'

import Link from 'next/link'

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                🎯 TaskerADHD
              </Link>
              <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Documentation</span>
            </div>
            <Link href="/dashboard" className="btn-secondary">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            📚 TaskerADHD Implementation Guide
          </h1>

          {/* Table of Contents */}
          <nav className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-8">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">📑 Table of Contents</h2>
            <ul className="space-y-2 text-sm">
              <li><a href="#overview" className="text-blue-600 dark:text-blue-400 hover:underline">🌟 Overview</a></li>
              <li><a href="#features" className="text-blue-600 dark:text-blue-400 hover:underline">🚀 Current Features</a></li>
              <li><a href="#voice-capture" className="text-blue-600 dark:text-blue-400 hover:underline">🎤 Voice Capture System</a></li>
              <li><a href="#ai-chat" className="text-blue-600 dark:text-blue-400 hover:underline">🤖 AI Chat Interface</a></li>
              <li><a href="#advanced-features" className="text-blue-600 dark:text-blue-400 hover:underline">⚡ Advanced Features</a></li>
              <li><a href="#task-management" className="text-blue-600 dark:text-blue-400 hover:underline">📋 Task Management</a></li>
              <li><a href="#themes" className="text-blue-600 dark:text-blue-400 hover:underline">🎨 Theme System</a></li>
              <li><a href="#architecture" className="text-blue-600 dark:text-blue-400 hover:underline">🏗️ Technical Architecture</a></li>
              <li><a href="#future" className="text-blue-600 dark:text-blue-400 hover:underline">🔮 Future Plans</a></li>
            </ul>
          </nav>

          {/* Overview */}
          <section id="overview" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🌟 Overview</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              TaskerADHD is an ADHD-first task management application designed to reduce cognitive load and support neurodivergent workflows. 
              The application prioritizes voice-first interaction, energy-aware task organization, and sensory-friendly design.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🎯 Key Principles</h3>
              <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
                <li>• <strong>Low Cognitive Load:</strong> Simple, clear interfaces with minimal distractions</li>
                <li>• <strong>Voice-First:</strong> Speak tasks naturally instead of typing complex forms</li>
                <li>• <strong>Energy Awareness:</strong> Match tasks to your current energy level</li>
                <li>• <strong>Human-in-the-Loop:</strong> AI suggests, you decide - full control maintained</li>
              </ul>
            </div>
          </section>

          {/* Current Features */}
          <section id="features" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🚀 Current Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">✅ Implemented</h3>
                <ul className="text-green-800 dark:text-green-200 text-sm space-y-1">
                  <li>• Kanban board with drag-and-drop</li>
                  <li>• Manual task creation with priority/energy</li>
                  <li>• Theme system (light/dark/low-stim)</li>
                  <li>• Development authentication bypass</li>
                  <li>• Task deletion with confirmation</li>
                  <li>• <strong>Complete voice capture system</strong></li>
                  <li>• <strong>Real-time speech-to-text (Deepgram/OpenAI)</strong></li>
                  <li>• <strong>Push-to-talk with audio level monitoring</strong></li>
                  <li>• <strong>Word-level confidence scoring</strong></li>
                  <li>• <strong>Interim and final transcript display</strong></li>
                  <li>• <strong>OpenAI chat interface with actual task creation</strong></li>
                  <li>• Responsive design with accessibility</li>
                  <li>• <strong>Projects as boards - each project is a real board with tasks</strong></li>
                  <li>• <strong>Project templates for quick setup (software, content, learning, personal)</strong></li>
                  <li>• <strong>Board navigation and switching between projects</strong></li>
                  <li>• <strong>AI task proposal system (voice → structured tasks)</strong></li>
                  <li>• <strong>Focus mode functionality with UI dimming</strong></li>
                  <li>• <strong>Energy level filtering and quick wins</strong></li>
                  <li>• <strong>Time-boxing and Pomodoro timer features</strong></li>
                  <li>• <strong>Intelligent staging area for task review</strong></li>
                  <li>• Multiple page structure (settings/docs/projects)</li>
                </ul>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">🚧 In Progress</h3>
                <ul className="text-amber-800 dark:text-amber-200 text-sm space-y-1">
                  <li>• Backend transcript storage and persistence</li>
                  <li>• Performance optimization for large boards</li>
                  <li>• Advanced project analytics and reporting</li>
                  <li>• Integration with external calendars</li>
                  <li>• Mobile app development</li>
                  <li>• Offline mode capabilities</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Voice Capture */}
          <section id="voice-capture" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🎤 Voice Capture System</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Advanced voice capture with real-time speech-to-text, confidence scoring, and push-to-talk interface. 
              Designed for minimal friction and maximum accuracy.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">🎯 How to Use</h3>
                <ol className="text-gray-700 dark:text-gray-300 text-sm space-y-2">
                  <li>1. Click "🎤 Voice Capture" button</li>
                  <li>2. Configure API key if not set (Deepgram/OpenAI)</li>
                  <li>3. <strong>Press Space</strong> or click the large mic button</li>
                  <li>4. Speak naturally while watching audio levels</li>
                  <li>5. <strong>Press Space</strong> again to stop recording</li>
                  <li>6. Review transcript with confidence indicators</li>
                </ol>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">⚡ Key Features</h3>
                <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
                  <li>• <strong>Push-to-talk:</strong> Space key or click to record</li>
                  <li>• <strong>Real-time levels:</strong> RMS + peak audio monitoring</li>
                  <li>• <strong>Live transcription:</strong> See words as you speak</li>
                  <li>• <strong>Confidence scores:</strong> Underlined low-confidence words</li>
                  <li>• <strong>Two providers:</strong> Deepgram (best) or OpenAI</li>
                  <li>• <strong>Session metrics:</strong> Duration, chunks, performance</li>
                </ul>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">🔧 Technical Implementation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Audio Processing</h4>
                  <ul className="text-purple-800 dark:text-purple-200 space-y-1">
                    <li>• WebRTC MediaStream API with optimal constraints</li>
                    <li>• AudioWorklet for low-latency PCM extraction</li>
                    <li>• Real-time level analysis (RMS + peak)</li>
                    <li>• Echo cancellation, noise suppression, AGC</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">STT Integration</h4>
                  <ul className="text-purple-800 dark:text-purple-200 space-y-1">
                    <li>• Pluggable adapter architecture</li>
                    <li>• Deepgram WebSocket streaming</li>
                    <li>• OpenAI Realtime API support</li>
                    <li>• Word-level timestamps and confidence</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Projects System */}
          <section id="projects" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">📋 Projects as Boards</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              TaskerADHD treats projects as specialized boards with enhanced metadata and templates. Each project becomes a full Kanban board with its own tasks, columns, and workflow.
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Project Features</h3>
              <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-2 list-disc list-inside">
                <li><strong>Board Integration:</strong> Projects are real boards in the main system, not separate entities</li>
                <li><strong>Custom Workflows:</strong> Each project type gets appropriate column layouts (Backlog → Development → Review → Done)</li>
                <li><strong>Templates:</strong> Pre-built project types (Software Development, Content Creation, Learning, Personal Goals)</li>
                <li><strong>Metadata:</strong> Projects include priority, status, due dates, tags, and progress tracking</li>
                <li><strong>Navigation:</strong> Switch between projects using the board selector in the dashboard header</li>
                <li><strong>Analytics:</strong> Project status distribution, progress tracking, and completion metrics</li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🚀 Quick Start</h4>
              <ol className="text-blue-800 dark:text-blue-200 text-sm space-y-1 list-decimal list-inside">
                <li>Go to Projects page → Click "New Project" or "Templates"</li>
                <li>Choose a template or create custom project with name, description, priority</li>
                <li>Project appears as a new board accessible via the board selector</li>
                <li>Navigate between your main board and project boards using dashboard navigation</li>
                <li>Each project has its own tasks, columns, and can use all TaskerADHD features</li>
              </ol>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">📋 Available Templates</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-green-800 dark:text-green-200 text-sm">
                <div>
                  <strong>Software Development:</strong><br/>
                  Backlog → Planning → Development → Testing → Review → Done
                </div>
                <div>
                  <strong>Content Creation:</strong><br/>
                  Ideas → Research → Writing → Editing → Review → Published
                </div>
                <div>
                  <strong>Learning & Skill Development:</strong><br/>
                  Resources → Learning → Practice → Projects → Assessment → Mastered
                </div>
                <div>
                  <strong>Personal Goal Project:</strong><br/>
                  Ideas → Planning → Action → Progress → Review → Achieved
                </div>
              </div>
            </div>
          </section>

          {/* AI Chat */}
          <section id="ai-chat" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🤖 AI Chat Interface</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The AI chat interface provides direct access to OpenAI's GPT models with full context about your TaskerADHD environment. The AI can now actually create tasks in your board when you ask it to!
              
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">🤖 What the AI can do:</h4>
              <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1 list-disc list-inside">
                <li><strong>Create single tasks:</strong> "Create a task to review the budget report"</li>
                <li><strong>Create multiple tasks:</strong> "Create daily tasks for me with morning routine, work tasks, and wrap up"</li>
                <li><strong>Set priorities and energy levels:</strong> Tasks are created with appropriate priority and energy estimates</li>
                <li><strong>Provide context:</strong> Understands your current board state and task organization</li>
                <li><strong>Debug and help:</strong> Answer questions about the application and provide assistance</li>
              </ul>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mt-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Example Commands</h4>
                <div className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
                  <div><code className="bg-blue-100 dark:bg-blue-800/20 px-2 py-1 rounded">"Create a daily task list for me"</code></div>
                  <div><code className="bg-blue-100 dark:bg-blue-800/20 px-2 py-1 rounded">"Add a high priority task to call the dentist"</code></div>
                  <div><code className="bg-blue-100 dark:bg-blue-800/20 px-2 py-1 rounded">"Create tasks for my morning routine"</code></div>
                  <div><code className="bg-blue-100 dark:bg-blue-800/20 px-2 py-1 rounded">"Make a task to review budget with 30 minute estimate"</code></div>
                </div>
              </div>
            </p>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Setup</h3>
              <ol className="text-gray-700 dark:text-gray-300 text-sm space-y-2">
                <li>1. Click "🤖 AI Chat" to open the chat interface</li>
                <li>2. Enter your OpenAI API key (stored locally)</li>
                <li>3. Start chatting with the AI about your tasks or application issues</li>
                <li>4. The AI has full context about TaskerADHD's features and your current state</li>
              </ol>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🎯 Use Cases</h3>
              <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
                <li>• Debug application issues with AI assistance</li>
                <li>• Get help organizing tasks and priorities</li>
                <li>• Brainstorm project ideas and task breakdowns</li>
                <li>• Ask questions about ADHD-friendly productivity</li>
              </ul>
            </div>
          </section>

          {/* Advanced Features */}
          <section id="advanced-features" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">⚡ Advanced Features</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Task Staging */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">📥 Intelligent Task Staging</h3>
                <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                  <li>• Review tasks before adding to boards</li>
                  <li>• Smart column assignment based on board type</li>
                  <li>• Bulk actions for task management</li>
                  <li>• Confidence scoring for voice-generated tasks</li>
                  <li>• Duplicate detection and warnings</li>
                </ul>
              </div>

              {/* Focus Mode */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">🎯 Focus Mode</h3>
                <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                  <li>• Dims non-essential UI elements</li>
                  <li>• Highlights primary task areas</li>
                  <li>• Reduces visual distractions</li>
                  <li>• Integrates with time-boxing features</li>
                  <li>• Customizable focus levels</li>
                </ul>
              </div>

              {/* Energy Filtering */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">⚡ Energy-Aware Task Management</h3>
                <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                  <li>• Filter tasks by energy level (Low/Medium/High)</li>
                  <li>• Quick wins for low-energy moments</li>
                  <li>• Energy-based task recommendations</li>
                  <li>• Time estimation integration</li>
                  <li>• Adaptive task scheduling</li>
                </ul>
              </div>

              {/* Time Boxing */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">⏱️ Time Boxing & Focus Sessions</h3>
                <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                  <li>• Pomodoro timer integration</li>
                  <li>• Customizable session lengths</li>
                  <li>• Break reminders and tracking</li>
                  <li>• Task completion metrics</li>
                  <li>• Session history and analytics</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Task Management */}
          <section id="task-management" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">📋 Task Management</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Tasks are organized in a Kanban board with four default columns: Inbox, To Do, Doing, and Done.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Task Properties</h3>
                <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                  <li>• <strong>Title:</strong> Brief task description</li>
                  <li>• <strong>Summary:</strong> Optional detailed notes</li>
                  <li>• <strong>Priority:</strong> Low, Medium, High, Urgent</li>
                  <li>• <strong>Energy:</strong> Low, Medium, High</li>
                  <li>• <strong>Estimate:</strong> Time in minutes</li>
                  <li>• <strong>Due Date:</strong> Optional deadline</li>
                </ul>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Actions</h3>
                <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                  <li>• <strong>Drag & Drop:</strong> Move between columns</li>
                  <li>• <strong>Delete:</strong> Hover and click ✕ button</li>
                  <li>• <strong>Create:</strong> Manual form or voice capture</li>
                  <li>• <strong>Filter:</strong> By energy, priority, or date</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Theme System */}
          <section id="themes" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🎨 Theme System</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              TaskerADHD includes three carefully designed themes to support different sensory needs and preferences.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">🌞 Light Mode</h3>
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  High contrast, clean design with plenty of white space. Good for well-lit environments.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">🌙 Dark Mode</h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  Reduced eye strain for low-light environments. Easier on the eyes during extended use.
                </p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🧘 Low-Stim</h3>
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  Minimal visual stimulation with muted colors and reduced motion. Perfect for sensory sensitivity.
                </p>
              </div>
            </div>
          </section>

          {/* Architecture */}
          <section id="architecture" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🏗️ Technical Architecture</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              TaskerADHD uses a modern full-stack architecture with real-time capabilities and AI integration.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Frontend Stack</h3>
                <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                  <li>• <strong>Next.js 14</strong> with App Router</li>
                  <li>• <strong>TypeScript</strong> for type safety</li>
                  <li>• <strong>Tailwind CSS</strong> for styling</li>
                  <li>• <strong>Zustand</strong> for state management</li>
                  <li>• <strong>React DnD</strong> for drag-and-drop</li>
                  <li>• <strong>Web Audio API</strong> for voice capture</li>
                  <li>• <strong>Socket.IO client</strong> for real-time features</li>
                </ul>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Backend Stack</h3>
                <ul className="text-gray-700 dark:text-gray-300 text-sm space-y-1">
                  <li>• <strong>Node.js + Express</strong> REST API</li>
                  <li>• <strong>PostgreSQL</strong> with Prisma ORM</li>
                  <li>• <strong>Socket.IO</strong> for WebSocket connections</li>
                  <li>• <strong>BullMQ + Redis</strong> for background jobs</li>
                  <li>• <strong>Rate limiting</strong> and security middleware</li>
                  <li>• <strong>JWT authentication</strong> (dev bypass enabled)</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🤖 AI Services</h3>
                <ul className="text-blue-800 dark:text-blue-200 text-sm space-y-1">
                  <li>• <strong>Deepgram API</strong> for speech-to-text</li>
                  <li>• <strong>OpenAI Whisper</strong> (alternative STT)</li>
                  <li>• <strong>OpenAI GPT-4</strong> for task processing</li>
                  <li>• <strong>Function calling</strong> for structured outputs</li>
                  <li>• <strong>Real-time streaming</strong> transcription</li>
                  <li>• <strong>Confidence scoring</strong> integration</li>
                </ul>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">💾 Data Architecture</h3>
                <ul className="text-green-800 dark:text-green-200 text-sm space-y-1">
                  <li>• <strong>Unified boards</strong> (projects = boards)</li>
                  <li>• <strong>Flexible columns</strong> per board type</li>
                  <li>• <strong>Rich metadata</strong> support</li>
                  <li>• <strong>Task relationships</strong> and hierarchies</li>
                  <li>• <strong>Audit trails</strong> voice→task linkage</li>
                  <li>• <strong>Template system</strong> for project types</li>
                </ul>
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">🔄 Voice-to-Task Pipeline</h3>
              <div className="text-purple-800 dark:text-purple-200 text-sm">
                <p className="mb-2"><strong>Data Flow:</strong> Voice → STT → LLM → Proposals → Review → Board</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>Audio captured via Web Audio API with push-to-talk</li>
                  <li>Real-time streaming to Deepgram for transcription</li>
                  <li>Final transcript sent to OpenAI GPT with function calling</li>
                  <li>LLM generates structured task proposals with metadata</li>
                  <li>Tasks staged in review area with confidence scores</li>
                  <li>User approves/edits tasks before board integration</li>
                  <li>Smart column routing based on priority and board type</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Future Plans */}
          <section id="future" className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🔮 Future Plans</h2>
            <div className="space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4">
                <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">Phase 1: Enhanced Intelligence</h3>
                <ul className="text-indigo-800 dark:text-indigo-200 text-sm space-y-1">
                  <li>• Persistent transcript storage and search</li>
                  <li>• Context-aware task suggestions based on history</li>
                  <li>• Advanced duplicate detection and automatic merging</li>
                  <li>• Multi-language support for voice capture</li>
                  <li>• Voice command shortcuts and macros</li>
                </ul>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2">Phase 2: Productivity & Analytics</h3>
                <ul className="text-green-800 dark:text-green-200 text-sm space-y-1">
                  <li>• Advanced project analytics and progress tracking</li>
                  <li>• Calendar integration for automatic time blocking</li>
                  <li>• Smart notifications and reminders</li>
                  <li>• Habit tracking and energy pattern analysis</li>
                  <li>• Burnout prevention and wellness features</li>
                </ul>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">Phase 3: Collaboration & Integration</h3>
                <ul className="text-purple-800 dark:text-purple-200 text-sm space-y-1">
                  <li>• Real-time team collaboration and shared workspaces</li>
                  <li>• Advanced permissions and role management</li>
                  <li>• Integration with external tools (Jira, GitHub, Slack)</li>
                  <li>• Voice notes and audio comments on tasks</li>
                  <li>• Mobile app with offline synchronization</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
              📚 This documentation is automatically updated as features are implemented.
              <br />
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
