'use client'

import { useState } from 'react'
import { TaskProposal } from '@/types/task.types'

interface TaskProposalCardProps {
  proposal: TaskProposal
  onEdit: (updated: TaskProposal) => void
  onDelete: (id: string) => void
}

export function TaskProposalCard({ proposal, onEdit, onDelete }: TaskProposalCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedProposal, setEditedProposal] = useState<TaskProposal>(proposal)

  const handleSave = () => {
    onEdit(editedProposal)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedProposal(proposal)
    setIsEditing(false)
  }

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return 'No due date'
    const date = new Date(dateString)
    return date.toLocaleDateString()
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'HIGH': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'LOW': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const getEnergyColor = (energy: string) => {
    switch (energy) {
      case 'HIGH': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
      case 'MEDIUM': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'LOW': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (isEditing) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Edit Task Proposal
          </h4>
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={editedProposal.title}
              onChange={(e) => setEditedProposal(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={editedProposal.priority}
              onChange={(e) => setEditedProposal(prev => ({ ...prev, priority: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Energy Level
            </label>
            <select
              value={editedProposal.energy}
              onChange={(e) => setEditedProposal(prev => ({ ...prev, energy: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={editedProposal.dueDate ? new Date(editedProposal.dueDate).toISOString().split('T')[0] : ''}
                            onChange={(e) => setEditedProposal(prev => ({
                ...prev,
                dueDate: e.target.value ? new Date(e.target.value) : undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Estimated Time (minutes)
            </label>
            <input
              type="number"
              value={editedProposal.estimatedMinutes || ''}
              onChange={(e) => setEditedProposal(prev => ({ ...prev, estimatedMinutes: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Labels (comma-separated)
            </label>
            <input
              type="text"
              value={editedProposal.labels?.join(', ') || ''}
              onChange={(e) => setEditedProposal(prev => ({ 
                ...prev, 
                labels: e.target.value.split(',').map(label => label.trim()).filter(Boolean) 
              }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={editedProposal.description || ''}
            onChange={(e) => setEditedProposal(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={editedProposal.isRepeating}
              onChange={(e) => setEditedProposal(prev => ({ ...prev, isRepeating: e.target.checked }))}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Repeating Task</span>
          </label>
        </div>

        {editedProposal.isRepeating && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Repeat Pattern
              </label>
              <select
                value={editedProposal.repeatPattern || ''}
                onChange={(e) => setEditedProposal(prev => ({ ...prev, repeatPattern: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select pattern</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Repeat Interval
              </label>
              <input
                type="number"
                value={editedProposal.repeatInterval || 1}
                onChange={(e) => setEditedProposal(prev => ({ ...prev, repeatInterval: parseInt(e.target.value) || 1 }))}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Repeat End Date
              </label>
              <input
                type="date"
                value={editedProposal.repeatEndDate ? new Date(editedProposal.repeatEndDate).toISOString().split('T')[0] : ''}
                              onChange={(e) => setEditedProposal(prev => ({
                ...prev,
                repeatEndDate: e.target.value ? new Date(e.target.value) : undefined
              }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {proposal.title}
          </h4>
          
          {proposal.description && (
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              {proposal.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(proposal.priority)}`}>
              {proposal.priority}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEnergyColor(proposal.energy)}`}>
              {proposal.energy}
            </span>
            {proposal.isRepeating && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                🔄 Repeating
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Due Date:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {formatDate(proposal.dueDate)}
              </span>
            </div>
            
            <div>
              <span className="text-gray-500 dark:text-gray-400">Estimated Time:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">
                {proposal.estimatedMinutes ? `${proposal.estimatedMinutes} min` : 'Not set'}
              </span>
            </div>

            {proposal.isRepeating && (
              <>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Repeat Pattern:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {proposal.repeatPattern || 'Not set'}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Repeat Interval:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">
                    {proposal.repeatInterval || 1}
                  </span>
                </div>
              </>
            )}
          </div>

          {proposal.labels && proposal.labels.length > 0 && (
            <div className="mt-3">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Labels:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {proposal.labels.map((label, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md text-xs"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {proposal.subtasks && proposal.subtasks.length > 0 && (
            <div className="mt-3">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Subtasks:</span>
              <ul className="mt-1 space-y-1">
                {proposal.subtasks.map((subtask, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                    • {subtask.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Confidence: {proposal.confidence ? (proposal.confidence * 100).toFixed(0) : 0}%
          </div>
        </div>

        <div className="flex space-x-2 ml-4">
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(proposal.id)}
            className="px-3 py-1 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
