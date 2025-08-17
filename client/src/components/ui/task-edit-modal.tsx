'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { toast } from 'react-hot-toast'
import { useBoardStore } from '@/stores/board'
import type { Task, TaskPriority, EnergyLevel } from '@/types'

interface TaskEditModalProps {
	isOpen: boolean
	onClose: () => void
	task: Task
}

export function TaskEditModal({ isOpen, onClose, task }: TaskEditModalProps) {
	const { updateTask, isLoading } = useBoardStore()

	const [title, setTitle] = useState(task.title || '')
	const [summary, setSummary] = useState(task.summary || '')
	const [priority, setPriority] = useState<TaskPriority | ''>(task.priority || '')
	const [energy, setEnergy] = useState<EnergyLevel | ''>(task.energy || '')
	const [dueAt, setDueAt] = useState<string>(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : '')
	const [estimateMin, setEstimateMin] = useState<string>(task.estimateMin ? String(task.estimateMin) : '')
	const [labels, setLabels] = useState<string>((task.labels || []).map(l => l.label?.name).filter(Boolean).join(', '))

	useEffect(() => {
		if (isOpen) {
			setTitle(task.title || '')
			setSummary(task.summary || '')
			setPriority(task.priority || '')
			setEnergy(task.energy || '')
			setDueAt(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : '')
			setEstimateMin(task.estimateMin ? String(task.estimateMin) : '')
			setLabels((task.labels || []).map(l => l.label?.name).filter(Boolean).join(', '))
		}
	}, [isOpen, task])

	if (!isOpen) return null

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!title.trim()) return

		try {
			console.log('🔧 Updating task:', task.id, { title, summary, priority, energy, dueAt, estimateMin, labels })
			
			const updates: Partial<Task> = {
				title: title.trim(),
				summary: summary.trim() || undefined,
				priority: priority || undefined,
				energy: energy || undefined,
				dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
				estimateMin: estimateMin ? parseInt(estimateMin) : undefined,
				labels: labels
					.split(',')
					.map(l => l.trim())
					.filter(Boolean) as any
			} as any

			console.log('🔧 Update payload:', updates)
			
			await updateTask(task.id, updates)
			console.log('✅ Task update successful')
			toast.success('✅ Task updated successfully!')
			onClose()
		} catch (error) {
			console.error('🚨 Failed to update task:', error)
			toast.error(`❌ Failed to update task: ${error}`)
		}
	}

	return (
		<div 
			className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
			onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
		>
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
				<div className="p-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
						✏️ Edit Task
					</h2>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
							<input value={title} onChange={e => setTitle(e.target.value)} className="input w-full" required />
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
							<textarea value={summary} onChange={e => setSummary(e.target.value)} className="input w-full h-20 resize-none" />
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
								<select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} className="input w-full">
									<option value="">Select...</option>
									<option value="LOW">🟢 Low</option>
									<option value="MEDIUM">🟡 Medium</option>
									<option value="HIGH">🟠 High</option>
									<option value="URGENT">🔴 Urgent</option>
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Energy</label>
								<select value={energy} onChange={e => setEnergy(e.target.value as EnergyLevel)} className="input w-full">
									<option value="">Select...</option>
									<option value="LOW">🌱 Low</option>
									<option value="MEDIUM">⚡ Medium</option>
									<option value="HIGH">🚀 High</option>
								</select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due Date</label>
								<input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)} className="input w-full" />
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time (minutes)</label>
								<input type="number" min="1" max="1440" value={estimateMin} onChange={e => setEstimateMin(e.target.value)} className="input w-full" />
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Labels</label>
							<input value={labels} onChange={e => setLabels(e.target.value)} className="input w-full" placeholder="work, personal, urgent" />
							<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Comma separated</p>
						</div>

						<div className="flex justify-end gap-3 pt-4">
							<button type="button" onClick={onClose} className="btn-secondary" disabled={isLoading}>Cancel</button>
							<button type="submit" className={clsx('btn-primary', isLoading && 'opacity-50 cursor-not-allowed')} disabled={!title.trim() || isLoading}>
								{isLoading ? 'Saving...' : 'Save Changes'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	)
}


