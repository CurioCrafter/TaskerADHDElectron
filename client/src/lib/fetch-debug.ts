'use client'

// Dev-only fetch wrapper that logs requests/responses with durations
export function wrapFetchWithDebug() {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV !== 'development') return
  if ((window as any).__fetchDebugWrapped) return

  const originalFetch = window.fetch.bind(window)
  ;(window as any).__fetchDebugWrapped = true

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const id = Math.random().toString(36).slice(2, 8)
    const start = Date.now()
    try {
      const res = await originalFetch(input, init)
      const ms = Date.now() - start
      const method = (init?.method || 'GET').toUpperCase()
      // Only log app API calls
      const url = input.toString()
      if (url.includes('/api/')) {
        console.log(`[FETCH] ${id} ${method} ${url} -> ${res.status} in ${ms}ms`)
      }
      return res
    } catch (err) {
      const ms = Date.now() - start
      const method = (init?.method || 'GET').toUpperCase()
      const url = input.toString()
      if (url.includes('/api/')) {
        console.error(`[FETCH] ${id} ${method} ${url} -> ERROR in ${ms}ms`, err)
      }
      throw err
    }
  }
}


