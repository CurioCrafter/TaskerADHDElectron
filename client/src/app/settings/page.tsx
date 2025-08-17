'use client'

import Link from 'next/link'
import { useTheme } from '@/components/providers'
import { useSettingsStore } from '@/stores/settings'

// Force dynamic rendering to avoid localStorage issues during prerendering
export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const { theme, setTheme, reducedMotion, setReducedMotion, highContrast, setHighContrast, focusMode, setFocusMode } = useTheme()
  const settings = useSettingsStore()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                🎯 TaskerADHD
              </Link>
              <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">Settings</span>
            </div>
            <Link href="/dashboard" className="btn-secondary">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            ⚙️ Settings
          </h1>

          {/* Theme Settings */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🎨 Appearance</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Theme
                </label>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setTheme('light')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      theme === 'light' 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    🌞 Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      theme === 'dark' 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    🌙 Dark
                  </button>
                  <button
                    onClick={() => setTheme('low-stim')}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      theme === 'low-stim' 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    🧘 Low-Stim
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Reduced Motion
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Minimizes animations and transitions
                  </p>
                </div>
                <button
                  onClick={() => setReducedMotion(!reducedMotion)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    reducedMotion ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      reducedMotion ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    High Contrast
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Increases contrast for better visibility
                  </p>
                </div>
                <button
                  onClick={() => setHighContrast(!highContrast)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    highContrast ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      highContrast ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Focus Settings */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🎯 Focus & Productivity</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Focus Mode
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Highlights current task and dims others
                  </p>
                </div>
                <button
                  onClick={() => setFocusMode(!focusMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    focusMode ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      focusMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">🚧 Coming Soon</h3>
                <ul className="text-amber-800 dark:text-amber-200 text-sm space-y-1">
                  <li>• Pomodoro timer settings</li>
                  <li>• Energy level preferences</li>
                  <li>• Task estimation defaults</li>
                  <li>• Daily task limits</li>
                </ul>
              </div>
            </div>
          </section>

          {/* API Settings */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🔑 API Configuration</h2>
            <div className="space-y-6">
              {/* OpenAI API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  OpenAI API Key
                </label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    placeholder="sk-..."
                    className="input flex-1"
                    defaultValue={localStorage.getItem('openai_api_key') || ''}
                    id="openai-key"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('openai-key') as HTMLInputElement
                      if (input?.value) {
                        localStorage.setItem('openai_api_key', input.value)
                        alert('OpenAI API key saved!')
                      }
                    }}
                    className="btn-primary"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Used for AI chat and voice transcription (Realtime API). Stored locally in your browser.
                </p>
              </div>

              {/* Deepgram API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Deepgram API Key (Recommended for Voice)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="password"
                    placeholder="dgk-..."
                    className="input flex-1"
                    defaultValue={localStorage.getItem('deepgram_api_key') || ''}
                    id="deepgram-key"
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById('deepgram-key') as HTMLInputElement
                      if (input?.value) {
                        localStorage.setItem('deepgram_api_key', input.value)
                        alert('Deepgram API key saved!')
                      }
                    }}
                    className="btn-primary"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Preferred for voice transcription with confidence scores and real-time streaming.
                </p>
              </div>

              {/* STT Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Speech-to-Text Provider
                </label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="stt-deepgram"
                      name="stt-provider"
                      value="deepgram"
                      defaultChecked={true}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <label htmlFor="stt-deepgram" className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Deepgram</strong> - ✅ Ready to use • Real-time streaming • Word confidence • Interim results
                    </label>
                  </div>
                  <div className="flex items-center space-x-3 opacity-60">
                    <input
                      type="radio"
                      id="stt-openai"
                      name="stt-provider"
                      value="openai"
                      disabled={true}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                    />
                    <label htmlFor="stt-openai" className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>OpenAI Realtime</strong> - 🚧 Coming soon • Browser authentication in development
                    </label>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Currently, only Deepgram is supported for voice capture. OpenAI Realtime API support is in development.
                </p>
              </div>

              {/* Setup Helper */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🚀 Quick Setup</h3>
                <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <p>
                    <strong>Deepgram:</strong> Sign up at{' '}
                    <a href="https://console.deepgram.com" target="_blank" rel="noopener noreferrer" className="underline">
                      console.deepgram.com
                    </a>{' '}
                    for $200 free credit
                  </p>
                  <p>
                    <strong>OpenAI:</strong> Get API key at{' '}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                      platform.openai.com/api-keys
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* System Controls */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">🔧 System Controls</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Application Control
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Safely shut down all servers to prevent connection errors on restart.
                </p>
                <button
                  onClick={async () => {
                    if (confirm('This will safely shut down all servers and close the application. Continue?')) {
                      try {
                        // Check if running in Electron
                        if (typeof window !== 'undefined' && (window as any).electronAPI) {
                          await (window as any).electronAPI.shutdown()
                        } else {
                          // Fallback for web version
                          alert('Shutdown feature is only available in the desktop app.')
                        }
                      } catch (error) {
                        console.error('Shutdown error:', error)
                        alert('Failed to shutdown cleanly. You may need to close the app manually.')
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  🛑 Shutdown Application
                </button>
              </div>
            </div>
          </section>

          {/* About */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">📱 About TaskerADHD</h2>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                Version: 1.0.0-beta
              </p>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                Built with ❤️ for the neurodivergent community
              </p>
              <div className="flex space-x-4 mt-4">
                <Link href="/docs" className="btn-secondary btn-sm">
                  📚 Documentation
                </Link>
                <button className="btn-ghost btn-sm" onClick={() => window.location.reload()}>
                  🔄 Reload App
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
