/**
 * Centralized API service layer
 * Reduces duplication and provides consistent error handling
 */

import { getAuthHeaders } from '@/stores/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// API Response type for consistent structure
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// HTTP Methods
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

// API Client Configuration
interface ApiClientConfig {
  method?: HttpMethod
  body?: any
  headers?: Record<string, string>
  requireAuth?: boolean
}

/**
 * Core API client with consistent error handling
 */
class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * Make HTTP request with consistent error handling
   */
  async request<T = any>(
    endpoint: string,
    config: ApiClientConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      requireAuth = true
    } = config

    try {
      const url = `${this.baseUrl}${endpoint}`
      
      // Prepare headers
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers
      }

      // Add auth headers if required
      if (requireAuth) {
        const authHeaders = getAuthHeaders()
        Object.assign(requestHeaders, authHeaders)
      }

      // Make request
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined
      })

      // Handle response
      if (response.ok) {
        const data = await response.json()
        return {
          success: true,
          data: data.data || data // Handle both wrapped and direct responses
        }
      } else {
        // Handle error responses
        let errorMessage = 'Request failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorData.message || errorMessage
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }

        // Development mode handling for auth errors
        if (response.status === 401 && process.env.NODE_ENV === 'development') {
          console.log('Dev mode: Handling 401 gracefully')
          return {
            success: false,
            error: 'Development mode: Auth bypassed'
          }
        }

        return {
          success: false,
          error: errorMessage
        }
      }
    } catch (error) {
      console.error('API request failed:', error)
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      }
    }
  }

  // Convenience methods
  async get<T>(endpoint: string, requireAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', requireAuth })
  }

  async post<T>(endpoint: string, body?: any, requireAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, requireAuth })
  }

  async patch<T>(endpoint: string, body?: any, requireAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body, requireAuth })
  }

  async put<T>(endpoint: string, body?: any, requireAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, requireAuth })
  }

  async delete<T>(endpoint: string, requireAuth = true): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', requireAuth })
  }
}

// Create singleton instance
export const apiClient = new ApiClient(API_URL)

// Specific API services
export class AuthApi {
  static async checkAuth() {
    return apiClient.get('/api/auth/me')
  }

  static async requestMagicLink(email: string) {
    return apiClient.post('/api/auth/magic-link/start', { email }, false)
  }

  static async verifyMagicLink(token: string) {
    return apiClient.post('/api/auth/magic-link/verify', { token }, false)
  }

  static async logout() {
    return apiClient.post('/api/auth/logout')
  }
}

export class BoardApi {
  static async fetchBoards() {
    return apiClient.get('/api/boards')
  }

  static async fetchBoard(boardId: string) {
    return apiClient.get(`/api/boards/${boardId}`)
  }

  static async createBoard(boardData: any) {
    return apiClient.post('/api/boards', boardData)
  }

  static async updateBoard(boardId: string, updates: any) {
    return apiClient.patch(`/api/boards/${boardId}`, updates)
  }

  static async deleteBoard(boardId: string) {
    return apiClient.delete(`/api/boards/${boardId}`)
  }
}

export class TaskApi {
  static async createTask(taskData: any) {
    return apiClient.post('/api/tasks', taskData)
  }

  static async updateTask(taskId: string, updates: any) {
    return apiClient.patch(`/api/tasks/${taskId}`, updates)
  }

  static async deleteTask(taskId: string) {
    return apiClient.delete(`/api/tasks/${taskId}`)
  }

  static async moveTask(taskId: string, columnId: string, position: number) {
    return apiClient.post(`/api/tasks/${taskId}/move`, { columnId, position })
  }
}

// Export the main client for custom requests
export default apiClient
