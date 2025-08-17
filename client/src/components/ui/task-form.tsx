'use client'

import { useState } from 'react'
import { EnergyLevel, TaskPriority } from '@/types'
import { clsx } from 'clsx'

interface TaskFormProps {
	onSubmit: (task: {
		title: string
		summary?: string
		priority?: TaskPriority
		energy?: EnergyLevel
		dueAt?: string
		estimateMin?: number
		labels?: string[]
	}) => void
	onCancel: () => void
	isSubmitting?: boolean
}

export function TaskForm({ onSubmit, onCancel, isSubmitting = false }: TaskFormProps) {
	const [title, setTitle] = useState('')
	const [summary, setSummary] = useState('')
	const [priority, setPriority] = useState<TaskPriority | ''>('')
	const [energy, setEnergy] = useState<EnergyLevel | ''>('')
	const [dueAt, setDueAt] = useState('')
	const [estimateMin, setEstimateMin] = useState('')
	const [labels, setLabels] = useState('')

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		
		if (!title.trim()) return

		// Convert YYYY-MM-DD to ISO string at local midnight
		let dueIso: string | undefined
		if (dueAt) {
			const date = new Date(dueAt)
			date.setHours(0, 0, 0, 0)
			dueIso = date.toISOString()
		}

		onSubmit({
			title: title.trim(),
			summary: summary.trim() || undefined,
			priority: priority || undefined,
			energy: energy || undefined,
			dueAt: dueIso,
			estimateMin: estimateMin ? parseInt(estimateMin) : undefined,
			labels: labels
				.split(',')
				.map(l => l.trim())
				.filter(Boolean)
		})

		// Reset form
		setTitle('')
		setSummary('')
		setPriority('')
		setEnergy('')
		setDueAt('')
		setEstimateMin('')
		setLabels('')
	}

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
			<div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
				<div className="p-6">
					<h2 className="text-xl font-semibold text-gray-900 mb-4">
						➕ Add New Task
					</h2>
					
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
								Task Title *
							</label>
							<input
								id="title"
								type="text"
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="input w-full"
								placeholder="What needs to be done?"
								required
								autoFocus
							/>
						</div>

						<div>
							<label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
								Description
							</label>
							<textarea
								id="summary"
								value={summary}
								onChange={(e) => setSummary(e.target.value)}
								className="input w-full h-20 resize-none"
								placeholder="Add more details (optional)"
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
									Priority
								</label>
								<select
									id="priority"
									value={priority}
									onChange={(e) => setPriority(e.target.value as TaskPriority)}
									className="input w-full"
								>
									<option value="">Select...</option>
									<option value="LOW">🟢 Low</option>
									<option value="MEDIUM">🟡 Medium</option>
									<option value="HIGH">🟠 High</option>
									<option value="URGENT">🔴 Urgent</option>
								</select>
							</div>

							<div>
								<label htmlFor="energy" className="block text-sm font-medium text-gray-700 mb-1">
									Energy Level
								</label>
								<select
									id="energy"
									value={energy}
									onChange={(e) => setEnergy(e.target.value as EnergyLevel)}
									className="input w-full"
								>
									<option value="">Select...</option>
									<option value="LOW">🌱 Low Energy</option>
									<option value="MEDIUM">⚡ Medium Energy</option>
									<option value="HIGH">🚀 High Energy</option>
								</select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<label htmlFor="dueAt" className="block text-sm font-medium text-gray-700 mb-1">
									Due Date
								</label>
								<input
									id="dueAt"
									type="date"
									value={dueAt}
									onChange={(e) => setDueAt(e.target.value)}
									className="input w-full"
								/>
							</div>

							<div>
								<label htmlFor="estimateMin" className="block text-sm font-medium text-gray-700 mb-1">
									Time (minutes)
								</label>
								<input
									id="estimateMin"
									type="number"
									value={estimateMin}
									onChange={(e) => setEstimateMin(e.target.value)}
									className="input w-full"
									placeholder="15"
									min="1"
									max="1440"
								/>
							</div>
						</div>

						<div>
							<label htmlFor="labels" className="block text-sm font-medium text-gray-700 mb-1">
								Labels
							</label>
							<input
								id="labels"
								type="text"
								value={labels}
								onChange={(e) => setLabels(e.target.value)}
								className="input w-full"
								placeholder="work, personal, urgent (comma separated)"
							/>
						</div>

						<div className="flex justify-end space-x-3 pt-4">
							<button
								type="button"
								onClick={onCancel}
								className="btn-secondary"
								disabled={isSubmitting}
							>
								Cancel
							</button>
							<button
								type="submit"
								className={clsx(
									'btn-primary',
									isSubmitting && 'opacity-50 cursor-not-allowed'
								)}
								disabled={!title.trim() || isSubmitting}
							>
								{isSubmitting ? 'Creating...' : 'Create Task'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	)
}
