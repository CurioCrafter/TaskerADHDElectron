'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

// Theme context for ADHD-friendly theming
interface ThemeContextType {
  theme: 'light' | 'dark' | 'low-stim'
  setTheme: (theme: 'light' | 'dark' | 'low-stim') => void
  reducedMotion: boolean
  setReducedMotion: (reduced: boolean) => void
  highContrast: boolean
  setHighContrast: (contrast: boolean) => void
  focusMode: boolean
  setFocusMode: (focus: boolean) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Accessibility context for screen reader and keyboard navigation
interface A11yContextType {
  announceMessage: (message: string, priority?: 'polite' | 'assertive') => void
  skipToContent: () => void
  currentFocus: string | null
  setCurrentFocus: (focus: string | null) => void
}

const A11yContext = createContext<A11yContextType | undefined>(undefined)

export function useA11y() {
  const context = useContext(A11yContext)
  if (context === undefined) {
    throw new Error('useA11y must be used within an A11yProvider')
  }
  return context
}

// Theme Provider
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settingsStore = useSettingsStore()
  const [theme, setThemeState] = useState<'light' | 'dark' | 'low-stim'>('light')
  const [reducedMotion, setReducedMotion] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Initialize theme from settings and system preferences
  useEffect(() => {
    setMounted(true)
    const savedTheme = settingsStore.theme || 'light'
    const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const systemHighContrast = window.matchMedia('(prefers-contrast: high)').matches
    
    setThemeState(savedTheme as 'light' | 'dark' | 'low-stim')
    setReducedMotion(settingsStore.reducedMotion ?? systemReducedMotion)
    setHighContrast(settingsStore.highContrast ?? systemHighContrast)
    setFocusMode(settingsStore.focusMode ?? false)
  }, [settingsStore])

  // Apply theme to document (client-side only)
  useEffect(() => {
    if (!mounted) return
    
    const root = document.documentElement
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark', 'low-stim', 'reduced-motion', 'high-contrast', 'focus-mode')
    
    // Apply current theme
    root.classList.add(theme)
    
    if (reducedMotion) root.classList.add('reduced-motion')
    if (highContrast) root.classList.add('high-contrast')
    if (focusMode) root.classList.add('focus-mode')
    
    // Update theme-color meta tag
    const themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (themeColorMeta) {
      const colors = {
        light: '#ffffff',
        dark: '#0f172a',
        'low-stim': '#f8fafc'
      }
      themeColorMeta.setAttribute('content', colors[theme])
    }
  }, [mounted, theme, reducedMotion, highContrast, focusMode])

  const setTheme = (newTheme: 'light' | 'dark' | 'low-stim') => {
    setThemeState(newTheme)
    settingsStore.updateSettings({ theme: newTheme })
  }

  const setReducedMotionHandler = (reduced: boolean) => {
    setReducedMotion(reduced)
    settingsStore.updateSettings({ reducedMotion: reduced })
  }

  const setHighContrastHandler = (contrast: boolean) => {
    setHighContrast(contrast)
    settingsStore.updateSettings({ highContrast: contrast })
  }

  const setFocusModeHandler = (focus: boolean) => {
    setFocusMode(focus)
    settingsStore.updateSettings({ focusMode: focus })
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        reducedMotion,
        setReducedMotion: setReducedMotionHandler,
        highContrast,
        setHighContrast: setHighContrastHandler,
        focusMode,
        setFocusMode: setFocusModeHandler,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

// Accessibility Provider
function A11yProvider({ children }: { children: React.ReactNode }) {
  const [currentFocus, setCurrentFocus] = useState<string | null>(null)

  const announceMessage = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.getElementById('announcements')
    if (announcement) {
      announcement.setAttribute('aria-live', priority)
      announcement.textContent = message
      
      // Clear after announcement
      setTimeout(() => {
        announcement.textContent = ''
      }, 1000)
    }
  }

  const skipToContent = () => {
    const mainContent = document.getElementById('main-content')
    if (mainContent) {
      mainContent.focus()
      announceMessage('Skipped to main content')
    }
  }

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Global keyboard shortcuts
      if (event.altKey) {
        switch (event.key) {
          case 'c':
            event.preventDefault()
            skipToContent()
            break
          case 'f':
            event.preventDefault()
            // Toggle focus mode via settings store
            useSettingsStore.getState().toggleFocusMode()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <A11yContext.Provider
      value={{
        announceMessage,
        skipToContent,
        currentFocus,
        setCurrentFocus,
      }}
    >
      {children}
    </A11yContext.Provider>
  )
}

// Auth guard component
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading TaskerADHD...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

// Main Providers component
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <A11yProvider>
        <DndProvider backend={HTML5Backend}>
          <AuthGuard>
            {children}
          </AuthGuard>
        </DndProvider>
      </A11yProvider>
    </ThemeProvider>
  )
}
