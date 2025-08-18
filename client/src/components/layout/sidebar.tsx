'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useBoardStore } from '@/stores/board'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'

// Extend Window interface for Electron API
declare global {
  interface Window {
    electronAPI?: {
      shutdown?: () => Promise<void>
    }
  }
}

interface SidebarProps {
  className?: string
}

export function Sidebar({ className = '' }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const { boards, currentBoard } = useBoardStore()

  // Ensure we're on client side to avoid hydration issues
  useEffect(() => {
    setIsClient(true)
  }, [])

  const isActive = (path: string) => pathname === path || pathname.startsWith(path)

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: '🏠',
      description: 'Overview and today\'s tasks'
    },
    {
      name: 'Projects',
      href: '/projects',
      icon: '📁',
      description: 'Manage your projects'
    },
    {
      name: 'Time Track',
      href: '/timetrack',
      icon: '⏱️',
      description: 'Track time spent on tasks'
    },
    {
      name: 'Calendar',
      href: '/calendar',
      icon: '📅',
      description: 'Schedule and due dates'
    },
    {
      name: 'Settings',
      href: '/settings', 
      icon: '⚙️',
      description: 'App preferences'
    },
    {
      name: 'Debug',
      href: '/debug', 
      icon: '🔧',
      description: 'Debug information & tests'
    }
  ]

  const handleAbout = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Electron context
      alert(`TaskerADHD v1.0.0\n\nAn ADHD-friendly task management app built with:\n• Electron + Next.js\n• Voice capture and AI\n• Real-time collaboration\n\nCreated by CurioCrafter\nhttps://github.com/CurioCrafter/TaskerADHD`)
    } else {
      // Web context
      window.open('https://github.com/CurioCrafter/TaskerADHD', '_blank')
    }
  }

  const handleHelp = () => {
    window.open('https://github.com/CurioCrafter/TaskerADHD/wiki', '_blank')
  }

  const handleBugReport = () => {
    window.open('https://github.com/CurioCrafter/TaskerADHD/issues/new', '_blank')
  }

  const handleShutdown = async () => {
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.shutdown) {
      const confirmed = confirm('Are you sure you want to shutdown the application? This will close all servers and the app.')
      if (confirmed) {
        try {
          await window.electronAPI.shutdown()
        } catch (error) {
          console.error('Shutdown failed:', error)
        }
      }
    }
  }

  return (
    <div className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col ${collapsed ? 'w-16' : 'w-64'} transition-all duration-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center space-x-2">
              <span className="text-2xl">🎯</span>
              <span className="font-bold text-gray-900 dark:text-gray-100">TaskerADHD</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
        
        {!collapsed && currentBoard && (
          <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {currentBoard.name}
            </div>
            <div className="text-gray-500 dark:text-gray-400 text-xs">
              {currentBoard.type} • {currentBoard._count?.tasks || 0} tasks
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title={collapsed ? `${item.name}: ${item.description}` : undefined}
            onClick={(e) => {
              // In Electron, Next Link might not handle navigation; handle manually.
              if (typeof window !== 'undefined' && (window as any).electronAPI) {
                e.preventDefault()
                const target = item.href
                const before = isClient ? window.location.pathname : ''
                router.push(target)
                if (isClient) {
                  setTimeout(() => {
                    const after = window.location.pathname
                    if (after === before && after !== target) {
                      window.location.href = target
                    }
                  }, 300)
                }
              }
            }}
          >
            <span className="text-lg">{item.icon}</span>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {item.description}
                </div>
              </div>
            )}
          </Link>
        ))}
      </nav>

      {/* Quick Actions */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="space-y-2">
            <Link
              href="/dashboard"
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
            >
              <span>➕</span>
              <span>New Task</span>
            </Link>
            
            <button
              onClick={() => {
                // TODO: Implement voice capture
                console.log('Voice capture not implemented yet')
              }}
              className="w-full flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              <span>🎤</span>
              <span>Voice Capture</span>
            </button>
          </div>

          {/* Quick Board Switcher */}
          {boards.length > 1 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Quick Switch
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {boards.slice(0, 3).map((board) => (
                  <Link
                    key={board.id}
                    href={`/dashboard?board=${board.id}`}
                    className={`block px-2 py-1 text-xs rounded truncate transition-colors ${
                      currentBoard?.id === board.id
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {board.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed Mode Quick Actions */}
      {collapsed && (
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-12 h-10 text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
            title="New Task"
          >
            ➕
          </Link>
          <button
            onClick={() => {
              // TODO: Implement voice capture
              console.log('Voice capture not implemented yet')
            }}
            className="flex items-center justify-center w-12 h-10 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            title="Voice Capture"
          >
            🎤
          </button>
        </div>
      )}

      {/* System Menu */}
      <div className="mt-auto border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="space-y-2">
          <button
            onClick={handleAbout}
            className={`w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${collapsed ? 'justify-center' : ''}`}
            title="About TaskerADHD"
          >
            <span>ℹ️</span>
            {!collapsed && <span>About</span>}
          </button>
          <button
            onClick={handleHelp}
            className={`w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${collapsed ? 'justify-center' : ''}`}
            title="Help & Documentation"
          >
            <span>❓</span>
            {!collapsed && <span>Help</span>}
          </button>
          <button
            onClick={handleBugReport}
            className={`w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${collapsed ? 'justify-center' : ''}`}
            title="Report Bug"
          >
            <span>🐛</span>
            {!collapsed && <span>Report Bug</span>}
          </button>
          {isClient && typeof window !== 'undefined' && window.electronAPI && (
            <button
              onClick={handleShutdown}
              className={`w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${collapsed ? 'justify-center' : ''}`}
              title="Shutdown Application"
            >
              <span>⏻</span>
              {!collapsed && <span>Shutdown</span>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
