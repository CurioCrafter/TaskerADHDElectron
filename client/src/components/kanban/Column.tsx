'use client'

import { useRef } from 'react'
import { useDrop } from 'react-dnd'
import type { Column as ColumnType, Task } from '@/types'
import { TaskCard } from './TaskCard'
import { useBoardStore } from '@/stores/board'

interface ColumnProps {
  column: ColumnType
}

export function Column({ column }: ColumnProps) {
  const moveTask = useBoardStore((s) => s.moveTask)

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: 'task',
      drop: async (item: any) => {
        const targetPosition = (column.tasks?.length || 0)
        await moveTask(item.id, column.id, targetPosition)
      },
      canDrop: (item: any) => item.sourceColumnId !== column.id,
      collect: (monitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop()
      })
    }),
    [column]
  )

  // Attach drop to a ref to satisfy React's ref typing
  const containerRef = useRef<HTMLDivElement>(null)
  drop(containerRef)

  return (
    <div ref={containerRef} className="kanban-column" aria-label={`Column ${column.name}`}>
      <div className="kanban-column-header">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">{column.name}</h4>
        <span className="text-sm text-gray-500 dark:text-gray-300">{column.tasks?.length || 0}</span>
      </div>

      <div className="space-y-3">
        {column.tasks && column.tasks.length > 0 ? (
          column.tasks.map((task: Task) => (
            <TaskCard key={task.id} task={task} sourceColumnId={column.id} />
          ))
        ) : (
          <div className={`text-center py-8 ${isOver && canDrop ? 'bg-blue-50 border border-blue-200 rounded-lg' : ''}`}>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-gray-400 text-xl">
                {column.name === 'Inbox' && '📥'}
                {column.name === 'To Do' && '📝'}
                {column.name === 'Doing' && '⚡'}
                {column.name === 'Done' && '✅'}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300">
              {isOver && canDrop ? 'Drop here to move' : 'No tasks yet'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
