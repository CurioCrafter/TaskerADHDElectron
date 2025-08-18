'use client'

import { useState } from 'react'
import { VoiceCaptureModal } from '@/components/voice/VoiceCaptureModal'
import { Task } from '@/types/task.types'

export default function VoiceTestPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createdTasks, setCreatedTasks] = useState<Task[]>([])

  const handleTasksCreated = (tasks: Task[]) => {
    setCreatedTasks(prev => [...prev, ...tasks])
    console.log('Tasks created:', tasks)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            🎤 Voice Component Test Page
          </h1>
          
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Test Voice Capture
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                This page tests the new voice capture components. Make sure you have configured your API keys in settings first.
              </p>
              
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg font-medium"
              >
                🎤 Open Voice Capture Modal
              </button>
            </div>

            {createdTasks.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Created Tasks ({createdTasks.length})
                </h2>
                <div className="space-y-4">
                  {createdTasks.map((task, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {task.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs">
                          {task.priority}
                        </span>
                        <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full text-xs">
                          {task.energy}
                        </span>
                        {task.isRepeating && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded-full text-xs">
                            🔄 {task.repeatPattern}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                        {task.estimatedMinutes && ` • Est: ${task.estimatedMinutes} min`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                🧪 Testing Instructions
              </h3>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                <li>Configure your API keys in Settings → API Configuration</li>
                <li>Click "Open Voice Capture Modal"</li>
                <li>Try recording voice or typing text</li>
                <li>Click "Analyze Tasks" to test AI processing</li>
                <li>Test the clarification chat if it appears</li>
                <li>Review and edit task proposals</li>
                <li>Create the final tasks</li>
              </ol>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                ⚠️ Requirements
              </h3>
              <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                <li>Deepgram API key for voice transcription</li>
                <li>OpenAI API key for AI task generation</li>
                <li>Microphone permissions for voice recording</li>
                <li>Internet connection for API calls</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <VoiceCaptureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onTasksCreated={handleTasksCreated}
      />
    </div>
  )
}
