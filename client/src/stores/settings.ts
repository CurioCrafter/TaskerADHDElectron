import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserSettings, EnergyLevel, TaskPriority } from '@/types'

interface SettingsState extends UserSettings {
  // Debug mode
  debugMode: boolean
  toggleDebugMode: () => void
  
  // Calendar settings
  showCalendarPlusButtons: boolean
  toggleCalendarPlusButtons: () => void
  
  // Actions
  updateSettings: (settings: Partial<UserSettings>) => void
  resetSettings: () => void
  toggleTheme: () => void
  toggleReducedMotion: () => void
  toggleHighContrast: () => void
  toggleFocusMode: () => void
  setVoiceSettings: (settings: Partial<UserSettings['voiceSettings']>) => void
  setTaskPreferences: (preferences: Partial<UserSettings['taskPreferences']>) => void
}

const defaultSettings: UserSettings = {
  theme: 'light',
  reducedMotion: false,
  highContrast: false,
  focusMode: false,
  timeFormat: '12h', // '12h' or '24h'
  voiceSettings: {
    autoStart: false,
    wakeWord: false,
    language: 'en-US',
    aiClarifyThreshold: 0.4
  },
  taskPreferences: {
    defaultEnergy: 'MEDIUM',
    defaultPriority: 'MEDIUM',
    maxTodayTasks: 7,
    showSubtasks: true
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Initialize with default settings
      ...defaultSettings,
      
      // Debug mode - separate from user settings, defaults to false
      debugMode: false,

      // Toggle debug mode
      toggleDebugMode: () => {
        set((state) => {
          const newDebugMode = !state.debugMode
          // Also sync with localStorage for backward compatibility
          if (typeof window !== 'undefined') {
            if (newDebugMode) {
              window.localStorage.setItem('debugMode', 'true')
            } else {
              window.localStorage.removeItem('debugMode')
            }
          }
          return { debugMode: newDebugMode }
        })
      },

      // Calendar settings - defaults to true
      showCalendarPlusButtons: true,

      // Toggle calendar plus buttons
      toggleCalendarPlusButtons: () => {
        set((state) => ({
          showCalendarPlusButtons: !state.showCalendarPlusButtons
        }))
      },

      // Update settings
      updateSettings: (newSettings: Partial<UserSettings>) => {
        set((state) => ({
          ...state,
          ...newSettings
        }))
      },

      // Reset to defaults
      resetSettings: () => {
        set(defaultSettings)
      },

      // Toggle theme between light, dark, and low-stim
      toggleTheme: () => {
        set((state) => {
          const themes: Array<'light' | 'dark' | 'low-stim'> = ['light', 'dark', 'low-stim']
          const currentIndex = themes.indexOf(state.theme || 'light')
          const nextIndex = (currentIndex + 1) % themes.length
          return { theme: themes[nextIndex] }
        })
      },

      // Toggle reduced motion
      toggleReducedMotion: () => {
        set((state) => ({
          reducedMotion: !state.reducedMotion
        }))
      },

      // Toggle high contrast
      toggleHighContrast: () => {
        set((state) => ({
          highContrast: !state.highContrast
        }))
      },

      // Toggle focus mode
      toggleFocusMode: () => {
        set((state) => ({
          focusMode: !state.focusMode
        }))
      },

      // Update voice settings
      setVoiceSettings: (newVoiceSettings: Partial<UserSettings['voiceSettings']>) => {
        set((state) => ({
          voiceSettings: {
            ...state.voiceSettings,
            ...newVoiceSettings
          }
        }))
      },

      // Update task preferences
      setTaskPreferences: (newTaskPreferences: Partial<UserSettings['taskPreferences']>) => {
        set((state) => ({
          taskPreferences: {
            ...state.taskPreferences,
            ...newTaskPreferences
          }
        }))
      }
    }),
    {
      name: 'taskeradhd-settings',
      storage: createJSONStorage(() => 
        typeof window !== 'undefined' ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {}
        }
      ),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migration between versions
        if (version === 0) {
          // Merge old settings with new defaults
          return {
            ...defaultSettings,
            ...persistedState
          }
        }
        return persistedState
      }
    }
  )
)

// Helper functions
export const getTheme = () => {
  return useSettingsStore.getState().theme || 'light'
}

export const isReducedMotion = () => {
  return useSettingsStore.getState().reducedMotion || false
}

export const isHighContrast = () => {
  return useSettingsStore.getState().highContrast || false
}

export const isFocusMode = () => {
  return useSettingsStore.getState().focusMode || false
}

export const getVoiceSettings = () => {
  return useSettingsStore.getState().voiceSettings || defaultSettings.voiceSettings
}

export const getTaskPreferences = () => {
  return useSettingsStore.getState().taskPreferences || defaultSettings.taskPreferences
}

export const isDebugMode = () => {
  if (typeof window === 'undefined') return false // SSR safe
  return useSettingsStore.getState().debugMode || false
}

// Apply settings to DOM
export const applySettingsToDOM = () => {
  const settings = useSettingsStore.getState()
  const root = document.documentElement

  // Remove existing classes
  root.classList.remove('light', 'dark', 'low-stim', 'reduced-motion', 'high-contrast', 'focus-mode')

  // Apply theme
  if (settings.theme) {
    root.classList.add(settings.theme)
  }

  // Apply accessibility settings
  if (settings.reducedMotion) {
    root.classList.add('reduced-motion')
  }

  if (settings.highContrast) {
    root.classList.add('high-contrast')
  }

  if (settings.focusMode) {
    root.classList.add('focus-mode')
  }

  // Update meta theme color
  const themeColorMeta = document.querySelector('meta[name="theme-color"]')
  if (themeColorMeta) {
    const colors = {
      light: '#ffffff',
      dark: '#0f172a',
      'low-stim': '#f8fafc'
    }
    themeColorMeta.setAttribute('content', colors[settings.theme || 'light'])
  }
}

// Initialize settings on app load
if (typeof window !== 'undefined') {
  // Check system preferences and update defaults
  const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const systemHighContrast = window.matchMedia('(prefers-contrast: high)').matches
  const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches

  // Update store with system preferences if not set
  const currentSettings = useSettingsStore.getState()
  
  if (currentSettings.reducedMotion === undefined) {
    useSettingsStore.getState().updateSettings({ reducedMotion: systemReducedMotion })
  }
  
  if (currentSettings.highContrast === undefined) {
    useSettingsStore.getState().updateSettings({ highContrast: systemHighContrast })
  }
  
  if (currentSettings.theme === 'light' && systemDarkMode) {
    useSettingsStore.getState().updateSettings({ theme: 'dark' })
  }

  // Apply settings to DOM
  applySettingsToDOM()

  // Listen for system preference changes
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    if (useSettingsStore.getState().reducedMotion === undefined) {
      useSettingsStore.getState().updateSettings({ reducedMotion: e.matches })
    }
  })

  window.matchMedia('(prefers-contrast: high)').addEventListener('change', (e) => {
    if (useSettingsStore.getState().highContrast === undefined) {
      useSettingsStore.getState().updateSettings({ highContrast: e.matches })
    }
  })

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (useSettingsStore.getState().theme === 'light') {
      useSettingsStore.getState().updateSettings({ theme: e.matches ? 'dark' : 'light' })
    }
  })
}
