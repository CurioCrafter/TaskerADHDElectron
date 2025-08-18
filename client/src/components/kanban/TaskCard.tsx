'use client'

import { useRef, useState } from 'react'
import { useDrag } from 'react-dnd'
import type { Task } from '@/types/task.types'
import { clsx } from 'clsx'
import { useBoardStore } from '@/stores/board'
import { toast } from 'react-hot-toast'
import { TaskEditModal } from '@/components/ui/task-edit-modal'

export interface DragTaskItem {
  type: 'task'
  id: string
  task: Task
  sourceColumnId: string
}

interface TaskCardProps {
  task: Task
  sourceColumnId: string
}

export function TaskCard({ task, sourceColumnId }: TaskCardProps) {
  const { deleteTask } = useBoardStore()
  const [isEditOpen, setIsEditOpen] = useState(false)
  
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: 'task',
      item: { type: 'task', id: task.id, task, sourceColumnId } as DragTaskItem,
      collect: (monitor) => ({ isDragging: monitor.isDragging() })
    }),
    [task, sourceColumnId]
  )

  const cardRef = useRef<HTMLDivElement>(null)
  drag(cardRef)

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
      try {
        await deleteTask(task.id)
        toast.success('Task deleted successfully!')
      } catch (error) {
        console.error('Failed to delete task:', error)
        toast.error('Failed to delete task')
      }
    }
  }

  return (
    <div
      ref={cardRef}
      className={clsx(
        'kanban-task group',
        task.priority === 'URGENT' ? 'priority-urgent' :
        task.priority === 'HIGH' ? 'priority-high' :
        task.priority === 'MEDIUM' ? 'priority-medium' : 'priority-low',
        isDragging && 'opacity-50'
      )}
      role="listitem"
      aria-label={`Task ${task.title}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h5 className="font-medium text-gray-900 dark:text-gray-100 text-sm break-anywhere flex-1 pr-2">
          {task.title}
        </h5>
        <div className="flex items-center gap-1">
          {task.priority && (
            <span className={clsx(
              'text-xs px-2 py-1 rounded-full capitalize',
              task.priority === 'URGENT' && 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-200',
              task.priority === 'HIGH' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-200',
              task.priority === 'MEDIUM' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200',
              task.priority === 'LOW' && 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            )}>
              {task.priority.toLowerCase()}
            </span>
          )}
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsEditOpen(true)
                toast('Editing task…', { duration: 1200 })
              }}
              className="text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 p-1 rounded"
              title="Edit task"
            >
              ✏️
            </button>
            {task.isRepeating && (
              <span className="text-xs text-blue-500" title="Repeating task">
                🔄
              </span>
            )}
            <button
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-1 rounded"
              aria-label={`Delete task ${task.title}`}
              title="Delete task"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 break-anywhere">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        {task.energy && (
          <span className={clsx(
            'px-2 py-1 rounded-full capitalize',
            task.energy === 'HIGH' && 'bg-red-50 text-red-600',
            task.energy === 'MEDIUM' && 'bg-amber-50 text-amber-600',
            task.energy === 'LOW' && 'bg-green-50 text-green-600'
          )}>
            {task.energy === 'HIGH' && '🚀'}
            {task.energy === 'MEDIUM' && '⚡'}
            {task.energy === 'LOW' && '🌱'} {task.energy.toLowerCase()}
          </span>
        )}
        {task.estimatedMinutes && (
          <span className="text-gray-500 dark:text-gray-400">{task.estimatedMinutes}m</span>
        )}
      </div>

      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.labels.slice(0, 2).map((label, index) => (
            <span key={index} className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200 px-2 py-1 rounded">
              {label}
            </span>
          ))}
          {task.labels.length > 2 && (
            <span className="text-xs text-gray-400 dark:text-gray-300">+{task.labels.length - 2}</span>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <TaskEditModal
        isOpen={isEditOpen}
        task={task}
        onClose={() => setIsEditOpen(false)}
      />
    </div>
  )
}
