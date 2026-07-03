// frontend/src/types/index.ts

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  email: string
  username: string
  full_name: string
  department: string | null
  role: string
  permissions: string[]
  is_active: boolean
  last_login_at: string | null
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user_id: string
  username: string
  full_name: string
  role: string
  permissions: string[]
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type FileType = 'pdf' | 'docx' | 'txt' | 'xlsx'
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface Document {
  id: string
  original_name: string
  file_type: FileType
  file_size: number
  title: string | null
  author: string | null
  department: string | null
  description: string | null
  page_count: number | null
  word_count: number | null
  chunk_count: number
  status: DocumentStatus
  tags: string[] | null
  collection_id: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export interface DocumentListResponse {
  items: Document[]
  total: number
  page: number
  page_size: number
}

export interface UploadResponse {
  document_id: string
  filename: string
  status: string
  message: string
}

// ─── Collections ──────────────────────────────────────────────────────────────

export interface Collection {
  id: string
  name: string
  description: string | null
  department: string | null
  color: string | null
  icon: string | null
  is_public: boolean
  doc_count: number
  owner_id: string
  created_at: string
}

export interface CollectionListResponse {
  items: Collection[]
  total: number
  page: number
  page_size: number
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface Citation {
  document_name: string
  document_id: string
  page_number: number
  chunk_index: number
  similarity_score: number
  excerpt: string
}

export interface ChatSession {
  id: string
  title: string
  model_used: string
  collection_id: string | null
  message_count: number
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations: Citation[] | null
  model_used: string | null
  response_time_ms: number | null
  created_at: string
}

export interface ChatResponse {
  message_id: string
  answer: string
  citations: Citation[]
  model_used: string
  response_time_ms: number
}

// ─── Search ───────────────────────────────────────────────────────────────────

export type SearchType = 'hybrid' | 'semantic' | 'keyword'

export interface SearchRequest {
  query: string
  search_type?: SearchType
  collection_id?: string
  department?: string
  n_results?: number
}

export interface SearchResultItem {
  document_id: string
  document_name: string
  page_number: number
  chunk_index: number
  score: number
  excerpt: string
}

export interface SearchResponse {
  query: string
  results: SearchResultItem[]
  total: number
  search_type: string
  elapsed_ms: number
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  username: string
  full_name: string
  department: string | null
  is_active: boolean
  role: string
  created_at: string
  last_login_at: string | null
}

export interface UserListResponse {
  items: User[]
  total: number
  page: number
  page_size: number
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_documents: number
  total_users: number
  total_collections: number
  total_searches_today: number
  total_chats_today: number
  avg_response_time_ms: number
  documents_by_type: Record<string, number>
  queries_per_day: { date: string; count: number }[]
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: number
  user_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  status: 'success' | 'failure'
  created_at: string
}

export interface AuditListResponse {
  items: AuditLog[]
  total: number
  page: number
  page_size: number
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number
  page_size: number
}
