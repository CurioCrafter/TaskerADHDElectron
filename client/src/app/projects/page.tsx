'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { useBoardStore } from '@/stores/board'
import type { Board, BoardType, BoardPriority, BoardStatus } from '@/types'

// Project Templates
interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: 'work' | 'personal' | 'learning' | 'health' | 'creative'
  columns: string[]
  priority: BoardPriority
  estimatedDuration: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  defaultTasks: Array<{
    title: string
    column: string
    priority?: string
    energy?: string
  }>
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'software-project',
    name: 'Software Development Project',
    description: 'Complete development lifecycle with planning, development, testing, and deployment phases',
    category: 'work',
    columns: ['Backlog', 'Planning', 'Development', 'Testing', 'Review', 'Done'],
    priority: 'HIGH',
    estimatedDuration: '2-3 months',
    difficulty: 'intermediate',
    defaultTasks: [
      { title: 'Define project requirements', column: 'Planning', priority: 'HIGH', energy: 'MEDIUM' },
      { title: 'Create project architecture', column: 'Planning', priority: 'HIGH', energy: 'HIGH' },
      { title: 'Set up development environment', column: 'Backlog', priority: 'MEDIUM', energy: 'LOW' },
      { title: 'Write initial documentation', column: 'Backlog', priority: 'MEDIUM', energy: 'MEDIUM' }
    ]
  },
  {
    id: 'content-creation',
    name: 'Content Creation Project',
    description: 'Structured approach to creating content from ideation to publication',
    category: 'creative',
    columns: ['Ideas', 'Research', 'Writing', 'Editing', 'Review', 'Published'],
    priority: 'MEDIUM',
    estimatedDuration: '2-4 weeks',
    difficulty: 'beginner',
    defaultTasks: [
      { title: 'Brainstorm content topics', column: 'Ideas', priority: 'MEDIUM', energy: 'MEDIUM' },
      { title: 'Research target audience', column: 'Research', priority: 'HIGH', energy: 'MEDIUM' },
      { title: 'Create content outline', column: 'Writing', priority: 'HIGH', energy: 'MEDIUM' },
      { title: 'Draft first version', column: 'Writing', priority: 'HIGH', energy: 'HIGH' }
    ]
  },
  {
    id: 'learning-project',
    name: 'Learning & Skill Development',
    description: 'Structured learning path with practice, projects, and assessment',
    category: 'learning',
    columns: ['Resources', 'Learning', 'Practice', 'Projects', 'Assessment', 'Mastered'],
    priority: 'MEDIUM',
    estimatedDuration: '1-6 months',
    difficulty: 'intermediate',
    defaultTasks: [
      { title: 'Gather learning resources', column: 'Resources', priority: 'HIGH', energy: 'LOW' },
      { title: 'Set learning schedule', column: 'Learning', priority: 'MEDIUM', energy: 'LOW' },
      { title: 'Complete first module', column: 'Learning', priority: 'HIGH', energy: 'MEDIUM' },
      { title: 'Build practice project', column: 'Practice', priority: 'MEDIUM', energy: 'HIGH' }
    ]
  },
  {
    id: 'personal-project',
    name: 'Personal Goal Project',
    description: 'Achieve personal goals with clear milestones and accountability',
    category: 'personal',
    columns: ['Ideas', 'Planning', 'Action', 'Progress', 'Review', 'Achieved'],
    priority: 'MEDIUM',
    estimatedDuration: '1-3 months',
    difficulty: 'beginner',
    defaultTasks: [
      { title: 'Define clear goal', column: 'Planning', priority: 'HIGH', energy: 'MEDIUM' },
      { title: 'Break down into steps', column: 'Planning', priority: 'HIGH', energy: 'MEDIUM' },
      { title: 'Set weekly milestones', column: 'Planning', priority: 'MEDIUM', energy: 'LOW' },
      { title: 'Track daily progress', column: 'Action', priority: 'HIGH', energy: 'LOW' }
    ]
  }
]

export default function ProjectsPage() {
  const router = useRouter()
  const { boards, fetchBoards, createBoard, deleteBoard, isLoading } = useBoardStore()
  const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'analytics'>('overview')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    priority: 'MEDIUM' as BoardPriority,
    status: 'PLANNING' as BoardStatus,
    dueDate: '',
    tags: [] as string[],
    tagInput: ''
  })

  // Load boards on mount
  useEffect(() => {
    fetchBoards()
  }, [fetchBoards])

  // Filter to show all boards except templates
  const projectBoards = boards.filter(board => board.type !== 'TEMPLATE')

  // Filter projects based on search and status
  const filteredProjects = projectBoards.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = filterStatus === 'all' || project.status.toLowerCase() === filterStatus.toLowerCase()
    return matchesSearch && matchesStatus
  })

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast.error('Project name is required')
      return
    }

    try {
      console.log('Creating project with data:', {
        ...newProject,
        type: 'PROJECT',
        dueDate: newProject.dueDate || undefined,
        tags: newProject.tags
      })

      const board = await createBoard({
        ...newProject,
        type: 'PROJECT',
        dueDate: newProject.dueDate || undefined,
        tags: newProject.tags
      })

      console.log('Created board:', board)

      if (board) {
        toast.success(`✅ Project "${newProject.name}" created successfully!`)
        setShowCreateModal(false)
        setNewProject({
          name: '',
          description: '',
          priority: 'MEDIUM',
          status: 'PLANNING',
          dueDate: '',
          tags: [],
          tagInput: ''
        })
        // Refresh the projects list
        await fetchBoards()
      } else {
        toast.error('Failed to create project - no board returned')
      }
    } catch (error) {
      console.error('Project creation error:', error)
      toast.error(`Failed to create project: ${error}`)
    }
  }

  const handleCreateFromTemplate = async (template: ProjectTemplate) => {
    try {
      console.log('Creating project from template:', template.name)
      
      const board = await createBoard({
        name: `${template.name} Project`,
        description: template.description,
        type: 'PROJECT',
        priority: template.priority,
        status: 'PLANNING',
        tags: [template.category, template.difficulty],
        metadata: {
          template: template.id,
          estimatedDuration: template.estimatedDuration,
          difficulty: template.difficulty
        }
      })

      console.log('Created template board:', board)

      if (board) {
        toast.success(`✅ Project created from "${template.name}" template!`)
        setShowTemplateModal(false)
        // Refresh the projects list
        await fetchBoards()
        // Navigate to the new project board
        router.push(`/dashboard?board=${board.id}`)
      } else {
        toast.error('Failed to create project from template - no board returned')
      }
    } catch (error) {
      console.error('Template creation error:', error)
      toast.error(`Failed to create project from template: ${error}`)
    }
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (window.confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      try {
        await deleteBoard(projectId)
        toast.success(`Project "${projectName}" deleted successfully`)
      } catch (error) {
        toast.error('Failed to delete project')
      }
    }
  }

  const addTag = () => {
    if (newProject.tagInput.trim() && !newProject.tags.includes(newProject.tagInput.trim())) {
      setNewProject(prev => ({
        ...prev,
        tags: [...prev.tags, prev.tagInput.trim()],
        tagInput: ''
      }))
    }
  }

  const removeTag = (tagToRemove: string) => {
    setNewProject(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const getStatusColor = (status: BoardStatus) => {
    switch (status) {
      case 'PLANNING': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'ACTIVE': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'ON_HOLD': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'COMPLETED': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
      case 'ARCHIVED': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getPriorityColor = (priority: BoardPriority) => {
    switch (priority) {
      case 'LOW': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'HIGH': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300'
      case 'URGENT': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getTaskStats = (board: Board) => {
    const totalTasks = board._count?.tasks || 0
    const completedTasks = board.columns?.find(col => col.name.toLowerCase().includes('done'))?.tasks?.length || 0
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    return { totalTasks, completedTasks, progress }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Boards & Projects</h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Manage all your boards, from personal task lists to complex project workflows
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                + New Board
              </button>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="btn-secondary"
              >
                📋 Templates
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8">
            {['overview', 'templates', 'analytics'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {/* Filters and Search */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-4">
                <div>
                  <input
                    type="text"
                    placeholder="Search boards and projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input w-64"
                  />
                </div>
                <div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="input"
                  >
                    <option value="all">All Status</option>
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'text-gray-400'}`}
                >
                  ⊞
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'text-gray-400'}`}
                >
                  ☰
                </button>
              </div>
            </div>

            {/* Boards Grid/List */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="spinner w-8 h-8"></div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {projectBoards.length === 0 ? 'No boards yet' : 'No boards match your search'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {projectBoards.length === 0 
                    ? 'Create your first board or project to get started with organized task management'
                    : 'Try adjusting your search or filter criteria'
                  }
                </p>
                {projectBoards.length === 0 && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn-primary"
                  >
                    Create Your First Board
                  </button>
                )}
              </div>
            ) : (
              <div className={viewMode === 'grid' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
              }>
                {filteredProjects.map((project) => {
                  const stats = getTaskStats(project)
                  return (
                    <div
                      key={project.id}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => router.push(`/dashboard?board=${project.id}`)}
                    >
                      <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                              {project.name}
                            </h3>
                            {project.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                {project.description}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteProject(project.id, project.name)
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Status and Priority */}
                        <div className="flex items-center justify-between text-xs mb-4">
                          <span className={`px-2 py-1 rounded-full font-medium ${getStatusColor(project.status)}`}>
                            {project.status?.replace('_', ' ') || 'Unknown'}
                          </span>
                          <span className={`px-2 py-1 rounded-full font-medium ${getPriorityColor(project.priority)}`}>
                            {project.priority}
                          </span>
                        </div>

                        {/* Progress */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-600 dark:text-gray-400">Progress</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {stats.completedTasks}/{stats.totalTasks} tasks
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${stats.progress}%` }}
                            />
                          </div>
                        </div>

                        {/* Due Date */}
                        {project.dueDate && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            Due: {new Date(project.dueDate).toLocaleDateString()}
                          </div>
                        )}

                        {/* Tags */}
                        {project.tags && project.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {project.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {project.tags.length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                                +{project.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROJECT_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {template.name}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      template.category === 'work' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' :
                      template.category === 'personal' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' :
                      template.category === 'learning' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300' :
                      template.category === 'creative' ? 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {template.category}
                    </span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    template.difficulty === 'beginner' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                    template.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                    'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                  }`}>
                    {template.difficulty}
                  </span>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {template.description}
                </p>

                <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Duration: {template.estimatedDuration}
                </div>

                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Workflow:</div>
                  <div className="flex flex-wrap gap-1">
                    {template.columns.map((column, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                        {column}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleCreateFromTemplate(template)}
                  className="w-full btn-primary text-sm"
                >
                  Use Template
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Project Status Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Project Status</h3>
              <div className="space-y-3">
                {['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'].map(status => {
                  const count = projectBoards.filter(p => p.status === status).length
                  const percentage = projectBoards.length > 0 ? (count / projectBoards.length) * 100 : 0
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {status?.replace('_', ' ').toLowerCase() || 'Unknown'}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-primary-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-8">
                          {count}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Projects</h3>
              <div className="space-y-3">
                {projectBoards
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .slice(0, 5)
                  .map(project => (
                    <div key={project.id} className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {project.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Updated {new Date(project.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(project.status)}`}>
                        {project.status?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Overall Progress */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Overall Stats</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                    {projectBoards.length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Projects</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {projectBoards.filter(p => p.status === 'COMPLETED').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {projectBoards.filter(p => p.status === 'ACTIVE').length}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Create New Project</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                    className="input w-full"
                    placeholder="Enter project name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                    className="input w-full"
                    rows={3}
                    placeholder="Describe your project"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Priority
                    </label>
                    <select
                      value={newProject.priority}
                      onChange={(e) => setNewProject(prev => ({ ...prev, priority: e.target.value as BoardPriority }))}
                      className="input w-full"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <select
                      value={newProject.status}
                      onChange={(e) => setNewProject(prev => ({ ...prev, status: e.target.value as BoardStatus }))}
                      className="input w-full"
                    >
                      <option value="PLANNING">Planning</option>
                      <option value="ACTIVE">Active</option>
                      <option value="ON_HOLD">On Hold</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newProject.dueDate}
                    onChange={(e) => setNewProject(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tags
                  </label>
                  <div className="flex space-x-2 mb-2">
                    <input
                      type="text"
                      value={newProject.tagInput}
                      onChange={(e) => setNewProject(prev => ({ ...prev, tagInput: e.target.value }))}
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      className="input flex-1"
                      placeholder="Add a tag"
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="btn-secondary"
                    >
                      Add
                    </button>
                  </div>
                  {newProject.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newProject.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-1 bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300 text-sm rounded"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="ml-1 text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={!newProject.name.trim() || isLoading}
                  className="btn-primary flex-1"
                >
                  {isLoading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Project Templates</h2>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PROJECT_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => handleCreateFromTemplate(template)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{template.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        template.difficulty === 'beginner' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                        template.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      }`}>
                        {template.difficulty}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      {template.description}
                    </p>

                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Duration: {template.estimatedDuration}
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {template.columns.slice(0, 4).map((column, idx) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded">
                          {column}
                        </span>
                      ))}
                      {template.columns.length > 4 && (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded">
                          +{template.columns.length - 4}
                        </span>
                      )}
                    </div>

                    <button className="w-full btn-primary text-sm">
                      Use This Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
