/**
 * Application constants and configuration
 * Centralizes magic strings, numbers, and settings
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  TIMEOUT: 10000, // 10 seconds
  RETRY_ATTEMPTS: 3
} as const

// Application Settings
export const APP_CONFIG = {
  NAME: 'TaskerADHD',
  VERSION: '1.0.0',
  DESCRIPTION: 'ADHD-friendly task management',
  REPOSITORY: 'https://github.com/CurioCrafter/TaskerADHD'
} as const

// ADHD-Friendly Limits
export const ADHD_LIMITS = {
  MAX_DAILY_TASKS: 7,
  MAX_QUICK_WINS: 5,
  MAX_BOARD_COLUMNS: 8,
  DEFAULT_TASK_ESTIMATE: 15, // minutes
  FOCUS_SESSION_LENGTH: 25, // Pomodoro
  BREAK_LENGTH: 5
} as const

// Board Defaults
export const BOARD_DEFAULTS = {
  PERSONAL_COLUMNS: ['Inbox', 'To Do', 'Doing', 'Done'],
  PROJECT_COLUMNS: ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'],
  COLORS: {
    PERSONAL: 'blue',
    PROJECT: 'green',
    TEAM: 'purple'
  }
} as const

// Task Configuration
export const TASK_CONFIG = {
  PRIORITIES: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const,
  ENERGY_LEVELS: ['LOW', 'MEDIUM', 'HIGH'] as const,
  STATUSES: ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const,
  MIN_ESTIMATE: 1,
  MAX_ESTIMATE: 1440, // 24 hours in minutes
  QUICK_WIN_THRESHOLD: 30 // minutes
} as const

// UI Constants
export const UI_CONFIG = {
  SIDEBAR_WIDTH: {
    EXPANDED: 'w-64',
    COLLAPSED: 'w-16'
  },
  ANIMATION_DURATION: 200,
  TOAST_DURATION: 4000,
  MODAL_Z_INDEX: 50,
  LOADING_DELAY: 300 // ms before showing spinner
} as const

// Color Schemes
export const COLORS = {
  PRIORITY: {
    LOW: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-200 dark:border-green-700',
      dot: 'bg-green-500'
    },
    MEDIUM: {
      bg: 'bg-blue-50 dark:bg-blue-900/20', 
      text: 'text-blue-600 dark:text-blue-400',
      border: 'border-blue-200 dark:border-blue-700',
      dot: 'bg-blue-500'
    },
    HIGH: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      text: 'text-orange-600 dark:text-orange-400', 
      border: 'border-orange-200 dark:border-orange-700',
      dot: 'bg-orange-500'
    },
    URGENT: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-200 dark:border-red-700', 
      dot: 'bg-red-500'
    }
  },
  ENERGY: {
    LOW: {
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-200 dark:border-gray-700',
      icon: '🌱'
    },
    MEDIUM: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-200 dark:border-yellow-700',
      icon: '⚡'
    },
    HIGH: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'border-purple-200 dark:border-purple-700',
      icon: '🚀'
    }
  }
} as const

// Storage Keys
export const STORAGE_KEYS = {
  AUTH: 'taskeradhd-auth',
  BOARD: 'taskeradhd-board', 
  SETTINGS: 'taskeradhd-settings',
  VOICE: 'taskeradhd-voice',
  THEME: 'taskeradhd-theme',
  ENERGY: 'taskeradhd-energy',
  STAGING: 'taskeradhd-staging'
} as const

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  NEW_TASK: 'CmdOrCtrl+N',
  QUICK_SEARCH: 'CmdOrCtrl+K',
  FOCUS_MODE: 'CmdOrCtrl+F',
  VOICE_CAPTURE: 'CmdOrCtrl+Shift+V',
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  SPACE: 'Space'
} as const

// Development Settings
export const DEV_CONFIG = {
  MOCK_DELAY: 500, // ms for mock API responses
  DEBUG_LOGS: process.env.NODE_ENV === 'development',
  BYPASS_AUTH: process.env.NODE_ENV === 'development',
  SHOW_DEBUG_INFO: process.env.NODE_ENV === 'development'
} as const

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your connection.',
  AUTH_FAILED: 'Authentication failed. Please try again.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
  BOARD_NOT_FOUND: 'Board not found. Please select a valid board.',
  TASK_CREATE_FAILED: 'Failed to create task. Please try again.',
  FILE_UPLOAD_FAILED: 'File upload failed. Please try again.'
} as const

// Success Messages
export const SUCCESS_MESSAGES = {
  TASK_CREATED: 'Task created successfully! 🎯',
  TASK_UPDATED: 'Task updated! ✨',
  TASK_DELETED: 'Task deleted! 🗑️',
  BOARD_CREATED: 'Board created successfully! 📋',
  BOARD_UPDATED: 'Board updated! ✨',
  SETTINGS_SAVED: 'Settings saved! ⚙️',
  VOICE_PROCESSED: 'Voice note processed! 🎤'
} as const

// Feature Flags
export const FEATURES = {
  VOICE_CAPTURE: true,
  AI_SUGGESTIONS: true,
  CALENDAR_INTEGRATION: true,
  DARK_MODE: true,
  FOCUS_MODE: true,
  COLLABORATIVE_BOARDS: false, // Future feature
  ADVANCED_ANALYTICS: false,   // Future feature
  MOBILE_APP: false            // Future feature
} as const

// Export helper functions
export const getTaskPriorityColor = (priority?: string) => {
  const key = priority as keyof typeof COLORS.PRIORITY
  return COLORS.PRIORITY[key] || COLORS.PRIORITY.LOW
}

export const getEnergyLevelColor = (energy?: string) => {
  const key = energy as keyof typeof COLORS.ENERGY  
  return COLORS.ENERGY[key] || COLORS.ENERGY.LOW
}

export const isQuickWin = (estimateMin?: number) => {
  return (estimateMin || 0) <= TASK_CONFIG.QUICK_WIN_THRESHOLD
}

export const getDefaultColumns = (boardType: 'PERSONAL' | 'PROJECT' = 'PERSONAL') => {
  return boardType === 'PROJECT' ? BOARD_DEFAULTS.PROJECT_COLUMNS : BOARD_DEFAULTS.PERSONAL_COLUMNS
}
