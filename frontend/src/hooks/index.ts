// frontend/src/hooks/useDocuments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/services/api'
import type { Document } from '@/types'

export const DOCS_KEY = ['documents'] as const

export function useDocuments(params?: {
  page?: number; page_size?: number; collection_id?: string
  department?: string; status?: string; search?: string
}) {
  return useQuery({
    queryKey: [...DOCS_KEY, params],
    queryFn: () => documentsApi.list(params),
    staleTime: 30_000,
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: [...DOCS_KEY, id],
    queryFn: () => documentsApi.get(id),
    enabled: !!id,
  })
}

export function useDocumentStatus(id: string, enabled = true) {
  return useQuery({
    queryKey: [...DOCS_KEY, id, 'status'],
    queryFn: () => documentsApi.getStatus(id),
    enabled: !!id && enabled,
    refetchInterval: (data) => {
      // Stop polling once ready or failed
      if (data?.status === 'ready' || data?.status === 'failed') return false
      return 3000
    },
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, meta }: {
      file: File;
      meta?: { collection_id?: string; department?: string; description?: string }
    }) => documentsApi.upload(file, meta),
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCS_KEY }),
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: DOCS_KEY }),
  })
}


// frontend/src/hooks/useCollections.ts
import { collectionsApi } from '@/services/api'
import type { Collection } from '@/types'

export const COLS_KEY = ['collections'] as const

export function useCollections(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: [...COLS_KEY, params],
    queryFn: () => collectionsApi.list(params),
    staleTime: 60_000,
  })
}

export function useCreateCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Omit<Collection, 'id' | 'doc_count' | 'owner_id' | 'created_at'>) =>
      collectionsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: COLS_KEY }),
  })
}

export function useDeleteCollection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => collectionsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: COLS_KEY }),
  })
}


// frontend/src/hooks/useChat.ts
import { chatApi } from '@/services/api'
import type { ChatSession, ChatMessage, ChatResponse } from '@/types'

export const CHAT_KEY = ['chat'] as const

export function useChatSessions(params?: { page?: number }) {
  return useQuery({
    queryKey: [...CHAT_KEY, 'sessions', params],
    queryFn: () => chatApi.listSessions(params),
    staleTime: 10_000,
  })
}

export function useChatSession(id: string) {
  return useQuery({
    queryKey: [...CHAT_KEY, 'session', id],
    queryFn: () => chatApi.getSession(id),
    enabled: !!id,
  })
}

export function useCreateChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { title?: string; collection_id?: string; model?: string }) =>
      chatApi.createSession(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...CHAT_KEY, 'sessions'] }),
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { session_id: string; message: string; model?: string }) =>
      chatApi.sendMessage(payload),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: [...CHAT_KEY, 'session', variables.session_id] })
      qc.invalidateQueries({ queryKey: [...CHAT_KEY, 'sessions'] })
    },
  })
}


// frontend/src/hooks/useSearch.ts
import { searchApi } from '@/services/api'
import type { SearchRequest, SearchResponse } from '@/types'
import { useState } from 'react'

export function useSearch() {
  const qc = useQueryClient()
  const [lastQuery, setLastQuery] = useState<SearchRequest | null>(null)

  const mutation = useMutation({
    mutationFn: (req: SearchRequest) => {
      setLastQuery(req)
      return searchApi.search(req)
    },
  })

  return { ...mutation, lastQuery }
}


// frontend/src/hooks/useDashboard.ts
import { dashboardApi } from '@/services/api'

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.getStats,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}


// frontend/src/hooks/useUsers.ts
import { usersApi } from '@/services/api'
import type { User } from '@/types'

export const USERS_KEY = ['users'] as const

export function useUsers(params?: { page?: number; page_size?: number }) {
  return useQuery({
    queryKey: [...USERS_KEY, params],
    queryFn: () => usersApi.list(params),
    staleTime: 30_000,
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<User> }) =>
      usersApi.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  })
}


// frontend/src/hooks/useAudit.ts
import { auditApi } from '@/services/api'

export function useAuditLogs(params?: {
  page?: number; page_size?: number; user_id?: string; action?: string
}) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => auditApi.list(params),
    staleTime: 30_000,
  })
}


// frontend/src/hooks/useToast.ts
import { useState, useCallback } from 'react'

interface Toast {
  id: string
  title: string
  description?: string
  variant: 'default' | 'destructive'
}

let toastCounter = 0

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = String(++toastCounter)
    setToasts(prev => [...prev, { ...opts, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, toast, dismiss }
}
