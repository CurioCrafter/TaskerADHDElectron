'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { useBoardStore } from '@/stores/board'
import { TimeDisplay } from '@/components/ui/time-display'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
  showSidebar?: boolean
}

export function AppLayout({ children, title, showSidebar = true }: AppLayoutProps) {
  const { fetchBoards, currentBoard } = useBoardStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Fetch boards only if not already loaded to avoid extra network during navigation
    if (!Array.isArray((useBoardStore.getState() as any).boards) || (useBoardStore.getState() as any).boards.length === 0) {
      fetchBoards()
    }
  }, [fetchBoards])

  // Avoid hydration mismatch by deferring certain client-only UI until mounted
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle Electron menu actions
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const handleMenuAction = (action: string) => {
        console.log('Menu action received:', action)
        
        switch (action) {
          case 'new-task':
            // Navigate to dashboard for new task
            window.location.href = '/dashboard'
            break
          case 'about':
            // Show about dialog
            alert(`TaskerADHD v1.0.0

ADHD-friendly task management with voice capture and AI assistance.

Features:
• Voice-to-task capture
• AI-powered task breakdown  
• Kanban board organization
• Focus modes & energy tracking
• Calendar integration
• Graceful shutdown system

Built with ❤️ for the neurodivergent community.

Based on original work by CurioCrafter
Repository: https://github.com/CurioCrafter/TaskerADHD`)
            break
          default:
            console.log('Unhandled menu action:', action)
        }
      }

      ;(window as any).electronAPI.onMenuAction(handleMenuAction)

      return () => {
        ;(window as any).electronAPI.removeMenuActionListener()
      }
    }
  }, [])

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      {showSidebar && <Sidebar />}
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {title && (
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h1>
              )}
              {/* Always render placeholder to keep SSR/CSR markup stable */}
              <div className="text-sm text-gray-500 dark:text-gray-400 min-h-[1rem]">
                {mounted && currentBoard ? (
                  <span>Board: {currentBoard.name}</span>
                ) : null}
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Time Display */}
              <TimeDisplay size="sm" showDate={false} showTimezone={false} />
              
              {/* Electron-specific controls - render wrapper always to prevent hydration mismatch */}
              <div className="flex items-center space-x-2">
                {mounted && typeof window !== 'undefined' && (window as any).electronAPI ? (
                  <>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Reload App"
                    >
                      🔄 Reload
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm('Safely shut down all servers and close the application?')) {
                          try {
                            await (window as any).electronAPI.shutdown()
                          } catch (error) {
                            console.error('Shutdown error:', error)
                            alert('Failed to shutdown cleanly. You may need to close the app manually.')
                          }
                        }
                      }}
                      className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                      title="Shutdown App"
                    >
                      🛑 Shutdown
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
