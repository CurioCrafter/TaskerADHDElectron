'use client'

import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { EnergyLevel, TaskPriority } from '@/types'
import { clsx } from 'clsx'

interface TaskFormProps {
	isOpen: boolean
	onClose: () => void
	onSubmit: (task: {
		title: string
		summary?: string
		priority?: TaskPriority
		energy?: EnergyLevel
		dueAt?: string
		estimateMin?: number
		labels?: string[]
		// Repeat data
		isRepeatable?: boolean
		repeatPattern?: 'daily' | 'weekly' | 'monthly' | 'custom'
		repeatInterval?: number
		repeatDays?: number[]
		repeatEndDate?: string
		repeatCount?: number
	}) => void
	isLoading?: boolean
	boardId?: string
}

export function TaskForm({ isOpen, onClose, onSubmit, isLoading = false, boardId }: TaskFormProps) {
	const [title, setTitle] = useState('')
	const [summary, setSummary] = useState('')
	const [priority, setPriority] = useState<TaskPriority | ''>('')
	
	// Reset form when modal closes
	useEffect(() => {
		if (!isOpen) {
			// Reset all form fields when modal closes
			setTitle('')
			setSummary('')
			setPriority('')
			setEnergy('')
			setDueAt('')
			setEstimateMin('')
			setLabels('')
			setIsRepeatable(false)
			setRepeatPattern('daily')
			setRepeatInterval('')
			setRepeatDays('')
			setRepeatEndDate('')
			setRepeatCount('')
		}
	}, [isOpen])
	const [energy, setEnergy] = useState<EnergyLevel | ''>('')
	const [dueAt, setDueAt] = useState('')
	const [estimateMin, setEstimateMin] = useState('')
	const [labels, setLabels] = useState('')
	
	// Repeat functionality state
	const [isRepeatable, setIsRepeatable] = useState(false)
	const [repeatPattern, setRepeatPattern] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily')
	const [repeatInterval, setRepeatInterval] = useState('1')
	const [repeatDays, setRepeatDays] = useState<number[]>([])
	const [repeatEndDate, setRepeatEndDate] = useState('')
	const [repeatCount, setRepeatCount] = useState('')

	// Reset form when modal closes
	useEffect(() => {
		if (!isOpen) {
			setTitle('')
			setSummary('')
			setPriority('')
			setEnergy('')
			setDueAt('')
			setEstimateMin('')
			setLabels('')
			setIsRepeatable(false)
			setRepeatPattern('daily')
			setRepeatInterval('1')
			setRepeatDays([])
			setRepeatEndDate('')
			setRepeatCount('')
		}
	}, [isOpen])

	// Handle Escape key to close modal
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isOpen) {
				onClose()
			}
		}

		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [isOpen, onClose])

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

		// Convert repeat end date to ISO string
		let repeatEndIso: string | undefined
		if (repeatEndDate && isRepeatable) {
			const endDate = new Date(repeatEndDate)
			endDate.setHours(23, 59, 59, 999)
			repeatEndIso = endDate.toISOString()
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
				.filter(Boolean),
			
			// Repeat data
			isRepeatable,
			repeatPattern: isRepeatable ? repeatPattern : undefined,
			repeatInterval: isRepeatable && repeatInterval ? parseInt(repeatInterval) : undefined,
			repeatDays: isRepeatable && repeatPattern === 'weekly' && repeatDays.length > 0 ? repeatDays : undefined,
			repeatEndDate: repeatEndIso,
			repeatCount: isRepeatable && repeatCount ? parseInt(repeatCount) : undefined
		})
	}

	// Don't render if modal is closed
	if (!isOpen) return null

	return (
		<div 
			className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
			onClick={(e) => {
				// Close modal if clicking on backdrop
				if (e.target === e.currentTarget) {
					onClose()
				}
			}}
		>
			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
				<div className="p-6">
					<h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
						➕ Add New Task
					</h2>
					
					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
							<label htmlFor="summary" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
								<label htmlFor="priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
								<label htmlFor="energy" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
								<label htmlFor="dueAt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
								<label htmlFor="estimateMin" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
							<label htmlFor="labels" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

						{/* Repeat Section */}
						<div className="border-t border-gray-200 dark:border-gray-700 pt-4">
							<div className="flex items-center space-x-2 mb-4">
								<input
									id="isRepeatable"
									type="checkbox"
									checked={isRepeatable}
									onChange={(e) => setIsRepeatable(e.target.checked)}
									className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
								/>
								<label htmlFor="isRepeatable" className="text-sm font-medium text-gray-700 dark:text-gray-300">
									🔄 Make this a repeating task
								</label>
							</div>

							{isRepeatable && (
								<div className="space-y-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
									<div>
										<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
											Repeat Pattern
										</label>
										<select
											value={repeatPattern}
											onChange={(e) => setRepeatPattern(e.target.value as any)}
											className="input w-full"
										>
											<option value="daily">Daily</option>
											<option value="weekly">Weekly</option>
											<option value="monthly">Monthly</option>
											<option value="custom">Custom</option>
										</select>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Every
											</label>
											<input
												type="number"
												value={repeatInterval}
												onChange={(e) => setRepeatInterval(e.target.value)}
												className="input w-full"
												min="1"
												max="365"
											/>
										</div>
										<div className="flex items-end">
											<span className="text-sm text-gray-600 dark:text-gray-400 pb-2">
												{repeatPattern === 'daily' ? 'day(s)' : 
												 repeatPattern === 'weekly' ? 'week(s)' : 
												 repeatPattern === 'monthly' ? 'month(s)' : 'day(s)'}
											</span>
										</div>
									</div>

									{repeatPattern === 'weekly' && (
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
												Repeat on
											</label>
											<div className="flex space-x-2">
												{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
													<button
														key={day}
														type="button"
														onClick={() => {
															const newDays = repeatDays.includes(index)
																? repeatDays.filter(d => d !== index)
																: [...repeatDays, index].sort()
															setRepeatDays(newDays)
														}}
														className={`px-2 py-1 text-xs rounded ${
															repeatDays.includes(index)
																? 'bg-primary-500 text-white'
																: 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
														}`}
													>
														{day}
													</button>
												))}
											</div>
										</div>
									)}

									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												End Date (optional)
											</label>
											<input
												type="date"
												value={repeatEndDate}
												onChange={(e) => setRepeatEndDate(e.target.value)}
												className="input w-full"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
												Or repeat count
											</label>
											<input
												type="number"
												value={repeatCount}
												onChange={(e) => setRepeatCount(e.target.value)}
												className="input w-full"
												placeholder="e.g., 10"
												min="1"
												max="1000"
											/>
										</div>
									</div>

									<div className="text-xs text-gray-500 dark:text-gray-400">
										💡 Tip: New instances will be created automatically when the current task is completed or when the due date passes.
									</div>
								</div>
							)}
						</div>

						<div className="flex justify-end space-x-3 pt-4">
							<button
								type="button"
								onClick={onClose}
								className="btn-secondary"
								disabled={isLoading}
							>
								Cancel
							</button>
							<button
								type="submit"
								className={clsx(
									'btn-primary',
									isLoading && 'opacity-50 cursor-not-allowed'
								)}
								disabled={!title.trim() || isLoading}
							>
								{isLoading ? 'Creating...' : 'Create Task'}
							</button>
						</div>
					</form>
				</div>
			</div>
		</div>
	)
}
