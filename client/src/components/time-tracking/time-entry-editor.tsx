'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { useTimeTrackingStore, type TimeEntry } from '@/stores/timeTracking'
import { toast } from 'react-hot-toast'

interface TimeEntryEditorProps {
  entry: TimeEntry
  onClose: () => void
}

export function TimeEntryEditor({ entry, onClose }: TimeEntryEditorProps) {
  const { updateTimeEntry, deleteTimeEntry } = useTimeTrackingStore()
  
  const [formData, setFormData] = useState({
    taskTitle: entry.taskTitle,
    startTime: format(entry.startTime, 'yyyy-MM-dd\'T\'HH:mm'),
    endTime: entry.endTime ? format(entry.endTime, 'yyyy-MM-dd\'T\'HH:mm') : '',
    duration: entry.duration ? Math.floor(entry.duration / 60) : 0, // Convert to minutes for editing
    durationSeconds: entry.duration ? entry.duration % 60 : 0,
    description: entry.description || '',
    energy: entry.energy || 'MEDIUM'
  })

  const handleSave = () => {
    const startTime = new Date(formData.startTime)
    const endTime = formData.endTime ? new Date(formData.endTime) : undefined
    
    // Calculate duration in seconds
    let duration: number
    if (endTime) {
      duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
    } else {
      duration = (formData.duration * 60) + formData.durationSeconds
    }
    
    updateTimeEntry(entry.id, {
      taskTitle: formData.taskTitle,
      startTime,
      endTime,
      duration,
      description: formData.description,
      energy: formData.energy as any
    })
    
    toast.success('Time entry updated!')
    onClose()
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this time entry?')) {
      deleteTimeEntry(entry.id)
      toast.success('Time entry deleted!')
      onClose()
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Edit Time Entry
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4">
            {/* Task Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Task Title
              </label>
              <input
                type="text"
                value={formData.taskTitle}
                onChange={(e) => setFormData({ ...formData, taskTitle: e.target.value })}
                className="input w-full"
                placeholder="Enter task title"
              />
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="input w-full"
              />
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Time (optional)
              </label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="input w-full"
              />
            </div>

            {/* Manual Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duration (if no end time specified)
              </label>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                    placeholder="Minutes"
                  />
                  <div className="text-xs text-gray-500 mt-1">Minutes</div>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.durationSeconds}
                    onChange={(e) => setFormData({ ...formData, durationSeconds: parseInt(e.target.value) || 0 })}
                    className="input w-full"
                    placeholder="Seconds"
                  />
                  <div className="text-xs text-gray-500 mt-1">Seconds</div>
                </div>
              </div>
              {(formData.duration > 0 || formData.durationSeconds > 0) && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Total: {formatDuration((formData.duration * 60) + formData.durationSeconds)}
                </div>
              )}
            </div>

            {/* Energy Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Energy Level
              </label>
              <select
                value={formData.energy}
                onChange={(e) => setFormData({ ...formData, energy: e.target.value })}
                className="input w-full"
              >
                <option value="LOW">🟡 Low Energy</option>
                <option value="MEDIUM">🔵 Medium Energy</option>
                <option value="HIGH">🟢 High Energy</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description (optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input w-full h-20 resize-none"
                placeholder="Add notes about this work session..."
              />
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              🗑️ Delete
            </button>
            <div className="space-x-3">
              <button
                onClick={onClose}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
