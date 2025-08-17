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
	// Repeat fields (using any to align with API fields if not in Task type)
	const [isRepeatable, setIsRepeatable] = useState<boolean>(Boolean((task as any).isRepeatable))
	const [repeatPattern, setRepeatPattern] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>(((task as any).repeatPattern as any) || 'daily')
	const [repeatInterval, setRepeatInterval] = useState<string>(((task as any).repeatInterval ? String((task as any).repeatInterval) : '1'))
	const [repeatDays, setRepeatDays] = useState<number[]>((((task as any).repeatDays ? JSON.parse((task as any).repeatDays) : []) || []))
	const [repeatEndDate, setRepeatEndDate] = useState<string>(((task as any).repeatEndDate ? new Date((task as any).repeatEndDate).toISOString().slice(0,10) : ''))
	const [repeatCount, setRepeatCount] = useState<string>(((task as any).repeatCount ? String((task as any).repeatCount) : ''))

	useEffect(() => {
		if (isOpen) {
			setTitle(task.title || '')
			setSummary(task.summary || '')
			setPriority(task.priority || '')
			setEnergy(task.energy || '')
			setDueAt(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : '')
			setEstimateMin(task.estimateMin ? String(task.estimateMin) : '')
			setLabels((task.labels || []).map(l => l.label?.name).filter(Boolean).join(', '))
			setIsRepeatable(Boolean((task as any).isRepeatable))
			setRepeatPattern(((task as any).repeatPattern as any) || 'daily')
			setRepeatInterval(((task as any).repeatInterval ? String((task as any).repeatInterval) : '1'))
			setRepeatDays((((task as any).repeatDays ? JSON.parse((task as any).repeatDays) : []) || []))
			setRepeatEndDate(((task as any).repeatEndDate ? new Date((task as any).repeatEndDate).toISOString().slice(0,10) : ''))
			setRepeatCount(((task as any).repeatCount ? String((task as any).repeatCount) : ''))
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

			// Repeat updates
			const repeat: any = {}
			if (isRepeatable) {
				repeat.isRepeatable = true
				repeat.repeatPattern = repeatPattern
				repeat.repeatInterval = repeatInterval ? parseInt(repeatInterval) : undefined
				repeat.repeatDays = repeatPattern === 'weekly' && repeatDays.length ? JSON.stringify(repeatDays) : undefined
				repeat.repeatEndDate = repeatEndDate ? new Date(repeatEndDate).toISOString() : undefined
				repeat.repeatCount = repeatCount ? parseInt(repeatCount) : undefined
			} else {
				repeat.isRepeatable = false
				repeat.repeatPattern = null
				repeat.repeatInterval = null
				repeat.repeatDays = null
				repeat.repeatEndDate = null
				repeat.repeatCount = null
			}
			Object.assign(updates as any, repeat)

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

						{/* Repeat Section */}
						<div className="border-t border-gray-200 dark:border-gray-700 pt-4">
							<div className="flex items-center space-x-2 mb-4">
								<input id="edit-isRepeatable" type="checkbox" checked={isRepeatable} onChange={(e) => setIsRepeatable(e.target.checked)} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
								<label htmlFor="edit-isRepeatable" className="text-sm font-medium text-gray-700 dark:text-gray-300">🔄 Make this a repeating task</label>
							</div>
							{isRepeatable && (
								<div className="space-y-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
									<div>
										<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repeat Pattern</label>
										<select value={repeatPattern} onChange={(e) => setRepeatPattern(e.target.value as any)} className="input w-full">
											<option value="daily">Daily</option>
											<option value="weekly">Weekly</option>
											<option value="monthly">Monthly</option>
											<option value="custom">Custom</option>
										</select>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Every</label>
											<input type="number" value={repeatInterval} onChange={(e) => setRepeatInterval(e.target.value)} className="input w-full" min="1" max="365" />
										</div>
										<div className="flex items-end"><span className="text-sm text-gray-600 dark:text-gray-400 pb-2">{repeatPattern === 'daily' ? 'day(s)' : repeatPattern === 'weekly' ? 'week(s)' : repeatPattern === 'monthly' ? 'month(s)' : 'day(s)'}
										</span></div>
									</div>
									{repeatPattern === 'weekly' && (
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repeat on</label>
											<div className="flex space-x-2">
												{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
													<button key={d} type="button" onClick={() => setRepeatDays(repeatDays.includes(i) ? repeatDays.filter(x => x!==i) : [...repeatDays, i].sort())} className={`px-2 py-1 text-xs rounded ${repeatDays.includes(i) ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}>{d}</button>
												))}
											</div>
										</div>
									)}
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date (optional)</label>
											<input type="date" value={repeatEndDate} onChange={(e) => setRepeatEndDate(e.target.value)} className="input w-full" />
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Or repeat count</label>
											<input type="number" value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)} className="input w-full" placeholder="e.g., 10" min="1" max="1000" />
										</div>
									</div>
								</div>
							)}
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


