// frontend/src/services/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import type {
  AuthTokens, AuthUser, Document, DocumentListResponse, UploadResponse,
  Collection, CollectionListResponse, ChatSession, ChatMessage, ChatResponse,
  SearchRequest, SearchResponse, User, UserListResponse,
  DashboardStats, AuditListResponse,
} from '@/types'

// ─── Client Setup ──────────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 300000,
})

const refreshClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
})

// ─── Token Storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = 'eka_access_token'
const REFRESH_KEY = 'eka_refresh_token'

export const tokenStorage = {
  getAccess: () => sessionStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (access: string, refresh: string) => {
    sessionStorage.setItem(TOKEN_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// ─── Interceptors ─────────────────────────────────────────────────────────────

// Attach access token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess()
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`)
    } else {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Auto-refresh on 401
let isRefreshing = false
let failedQueue: { resolve: (v: string) => void; reject: (e: unknown) => void }[] = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          if (original.headers && typeof original.headers.set === 'function') {
            original.headers.set('Authorization', `Bearer ${token}`)
          } else {
            original.headers.Authorization = `Bearer ${token}`
          }
          return apiClient(original)
        })
      }
      original._retry = true
      isRefreshing = true
      try {
        const refresh = tokenStorage.getRefresh()
        if (!refresh) throw new Error('No refresh token')
        const { data } = await refreshClient.post('/auth/refresh', { refresh_token: refresh })
        tokenStorage.setTokens(data.access_token, refresh)
        processQueue(null, data.access_token)
        
        if (original.headers && typeof original.headers.set === 'function') {
          original.headers.set('Authorization', `Bearer ${data.access_token}`)
        } else {
          original.headers.Authorization = `Bearer ${data.access_token}`
        }
        return apiClient(original)
      } catch (e) {
        processQueue(e)
        tokenStorage.clear()
        window.location.href = '/login'
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  }
)

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string): Promise<AuthTokens> => {
    const { data } = await apiClient.post<AuthTokens>('/auth/login', { email, password })
    tokenStorage.setTokens(data.access_token, data.refresh_token)
    return data
  },

  register: async (payload: {
    email: string; username: string; full_name: string
    password: string; department?: string
  }) => {
    const { data } = await apiClient.post('/auth/register', payload)
    return data
  },

  logout: async () => {
    const refresh = tokenStorage.getRefresh()
    await apiClient.post('/auth/logout', { refresh_token: refresh }).catch(() => {})
    tokenStorage.clear()
  },

  me: async (): Promise<AuthUser> => {
    const { data } = await apiClient.get<AuthUser>('/auth/me')
    return data
  },
}

// ─── Documents API ────────────────────────────────────────────────────────────

export const documentsApi = {
  upload: async (
    file: File,
    meta?: { collection_id?: string; department?: string; description?: string }
  ): Promise<UploadResponse> => {
    const form = new FormData()
    form.append('file', file)
    if (meta?.collection_id) form.append('collection_id', meta.collection_id)
    if (meta?.department)    form.append('department', meta.department)
    if (meta?.description)   form.append('description', meta.description)
    const { data } = await apiClient.post<UploadResponse>('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
    return data
  },

  list: async (params?: {
    page?: number; page_size?: number; collection_id?: string
    department?: string; status?: string; search?: string
  }): Promise<DocumentListResponse> => {
    const { data } = await apiClient.get<DocumentListResponse>('/documents/', { params })
    return data
  },

  get: async (id: string): Promise<Document> => {
    const { data } = await apiClient.get<Document>(`/documents/${id}`)
    return data
  },

  getStatus: async (id: string) => {
    const { data } = await apiClient.get(`/documents/${id}/status`)
    return data
  },

  delete: async (id: string) => {
    await apiClient.delete(`/documents/${id}`)
  },
}

// ─── Collections API ──────────────────────────────────────────────────────────

export const collectionsApi = {
  list: async (params?: { page?: number; page_size?: number }): Promise<CollectionListResponse> => {
    const { data } = await apiClient.get<CollectionListResponse>('/collections/', { params })
    return data
  },

  create: async (payload: {
    name: string; description?: string; department?: string
    color?: string; icon?: string; is_public?: boolean
  }): Promise<Collection> => {
    const { data } = await apiClient.post<Collection>('/collections/', payload)
    return data
  },

  update: async (id: string, payload: Partial<Collection>): Promise<Collection> => {
    const { data } = await apiClient.put<Collection>(`/collections/${id}`, payload)
    return data
  },

  delete: async (id: string) => {
    await apiClient.delete(`/collections/${id}`)
  },
}

// ─── Chat API ─────────────────────────────────────────────────────────────────

export const chatApi = {
  createSession: async (payload: {
    title?: string; collection_id?: string; model?: string
  }): Promise<ChatSession> => {
    const { data } = await apiClient.post<ChatSession>('/chat/sessions', payload)
    return data
  },

  listSessions: async (params?: { page?: number; page_size?: number }) => {
    const { data } = await apiClient.get('/chat/sessions', { params })
    return data
  },

  getSession: async (id: string): Promise<{ messages: ChatMessage[] } & ChatSession> => {
    const { data } = await apiClient.get(`/chat/sessions/${id}`)
    return data
  },

  sendMessage: async (payload: {
    session_id: string; message: string; model?: string
  }): Promise<ChatResponse> => {
    const { data } = await apiClient.post<ChatResponse>('/chat/message', payload)
    return data
  },

  streamMessage: async (
    payload: { session_id: string; message: string; model?: string },
    onChunk: (chunk: string) => void,
    onMetadata: (citations: any[]) => void,
    onDone: (messageId: string) => void,
    onError: (error: string) => void
  ) => {
    const token = tokenStorage.getAccess();
    try {
      const response = await fetch('/api/v1/chat/message/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (reader) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // SSE messages are separated by \n\n
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep the incomplete message in buffer

        for (const message of messages) {
          if (message.startsWith('data: ')) {
            try {
              const data = JSON.parse(message.slice(6));
              if (data.type === 'metadata') {
                onMetadata(data.citations || []);
              } else if (data.type === 'token') {
                onChunk(data.content || '');
              } else if (data.type === 'done') {
                onDone(data.message_id);
              } else if (data.type === 'error') {
                onError(data.content || 'Unknown streaming error');
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e, message);
            }
          }
        }
      }
    } catch (err: any) {
      onError(err.message || 'Stream connection failed');
    }
  },

  deleteSession: async (id: string) => {
    await apiClient.delete(`/chat/sessions/${id}`)
  },
}

// ─── Search API ───────────────────────────────────────────────────────────────

export const searchApi = {
  search: async (payload: SearchRequest): Promise<SearchResponse> => {
    const { data } = await apiClient.post<SearchResponse>('/search/', payload)
    return data
  },
}

// ─── Users API ────────────────────────────────────────────────────────────────

export const usersApi = {
  list: async (params?: { page?: number; page_size?: number }): Promise<UserListResponse> => {
    const { data } = await apiClient.get<UserListResponse>('/users/', { params })
    return data
  },

  update: async (id: string, payload: Partial<User>): Promise<void> => {
    await apiClient.put(`/users/${id}`, payload)
  },

  deactivate: async (id: string): Promise<void> => {
    await apiClient.delete(`/users/${id}`)
  },
}

// ─── Dashboard API ────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await apiClient.get<DashboardStats>('/dashboard/stats')
    return data
  },
}

// ─── Audit API ────────────────────────────────────────────────────────────────

export const auditApi = {
  list: async (params?: {
    page?: number; page_size?: number; user_id?: string; action?: string
  }): Promise<AuditListResponse> => {
    const { data } = await apiClient.get<AuditListResponse>('/audit/', { params })
    return data
  },
}
