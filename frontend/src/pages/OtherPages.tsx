// frontend/src/pages/SearchPage.tsx
import { useState, FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { searchApi } from '@/services/api'
import { Search, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import type { SearchResultItem, SearchType } from '@/types'
import { cn } from '@/utils/cn'

function ResultCard({ result }: { result: SearchResultItem }) {
  const [expanded, setExpanded] = useState(false)
  const score = Math.round(result.score * 100)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{result.document_name}</span>
            <span className="text-xs text-muted-foreground">
              p.{result.page_number} · chunk {result.chunk_index}
            </span>
            <span className={cn(
              'text-xs font-medium px-1.5 py-0.5 rounded-full',
              score >= 80 ? 'bg-green-500/20 text-green-400' :
              score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-muted text-muted-foreground'
            )}>
              {score}% match
            </span>
          </div>
          <p className={cn('mt-1 text-xs text-muted-foreground leading-relaxed', !expanded && 'line-clamp-3')}>
            {result.excerpt}
          </p>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('hybrid')

  const { mutate, data, isPending } = useMutation({
    mutationFn: searchApi.search,
  })

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    mutate({ query: query.trim(), search_type: searchType, n_results: 10 })
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">Semantic, keyword, and hybrid search across all documents</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your documents…"
            className="w-full rounded-xl border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={searchType}
          onChange={e => setSearchType(e.target.value as SearchType)}
          className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="hybrid">Hybrid</option>
          <option value="semantic">Semantic</option>
          <option value="keyword">Keyword</option>
        </select>
        <button
          type="submit"
          disabled={!query.trim() || isPending}
          className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground
                     hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          Search
        </button>
      </form>

      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {data.total} results in {data.elapsed_ms}ms · {data.search_type} search
          </div>
          {data.results.map((r, i) => <ResultCard key={i} result={r} />)}
          {data.results.length === 0 && (
            <div className="rounded-xl border border-border py-12 text-center text-sm text-muted-foreground">
              No results found for "{data.query}"
            </div>
          )}
        </div>
      )}

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-card" />
          ))}
        </div>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/pages/CollectionsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collectionsApi } from '@/services/api'
import { FolderOpen, Plus, Trash2 } from 'lucide-react'

export function CollectionsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: () => collectionsApi.list({ page: 1, page_size: 50 }),
  })

  const createMut = useMutation({
    mutationFn: collectionsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['collections'] }); setShowForm(false); setName('') },
  })
  const deleteMut = useMutation({
    mutationFn: collectionsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  })

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Collections</h1>
          <p className="text-sm text-muted-foreground">Organise documents into groups</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New collection
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">Create collection</h2>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Collection name"
            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate({ name, description: desc })} disabled={!name.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40">
              Create
            </button>
            <button onClick={() => setShowForm(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-card" />)
          : data?.items.map(col => (
            <div key={col.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{col.name}</p>
                    <p className="text-xs text-muted-foreground">{col.doc_count} documents</p>
                  </div>
                </div>
                <button onClick={() => { if (confirm('Delete collection?')) deleteMut.mutate(col.id) }}
                  className="text-muted-foreground hover:text-destructive p-1">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {col.description && <p className="mt-3 text-xs text-muted-foreground line-clamp-2">{col.description}</p>}
              {col.is_public && <span className="mt-2 inline-block text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Public</span>}
            </div>
          ))
        }
        {data?.items.length === 0 && !isLoading && (
          <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
            No collections yet. Create your first one above.
          </div>
        )}
      </div>
    </div>
  )
}
export default CollectionsPage


// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/pages/UsersPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { usersApi } from '@/services/api'
import { Users, Shield } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function UsersPage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => usersApi.list({ page, page_size: 20 }),
  })

  const deactivateMut = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold">User Management</h1>
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} registered users</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Last login</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Joined</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-secondary" /></td>
                ))}</tr>
              ))
              : data?.items.map(u => (
                <tr key={u.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {u.full_name[0]}
                      </div>
                      <div>
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Shield className="h-3 w-3" />{u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium', u.is_active ? 'text-green-400' : 'text-muted-foreground')}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {u.last_login_at ? formatDistanceToNow(new Date(u.last_login_at), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.is_active && (
                      <button
                        onClick={() => { if (confirm('Deactivate user?')) deactivateMut.mutate(u.id) }}
                        className="text-xs text-destructive hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
export default UsersPage


// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/pages/AuditLogsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { auditApi } from '@/services/api'
import { format } from 'date-fns'
import { ScrollText } from 'lucide-react'

export function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, action],
    queryFn: () => auditApi.list({ page, page_size: 50, action: action || undefined }),
  })

  const ACTION_ICONS: Record<string, string> = {
    'user.login': '🔐', 'user.logout': '🚪',
    'document.upload': '📤', 'document.delete': '🗑️',
    'search.perform': '🔍', 'chat.query': '💬',
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} events</p>
        </div>
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1) }}
          className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">All actions</option>
          {Object.keys(ACTION_ICONS).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Resource</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">IP</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-secondary" /></td>
                ))}</tr>
              ))
              : data?.items.map(log => (
                <tr key={log.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-xs font-medium">
                      <span>{ACTION_ICONS[log.action] ?? '📋'}</span>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {log.user_id?.slice(0, 8) ?? 'system'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {log.resource_type && `${log.resource_type}/${log.resource_id?.slice(0, 8)}`}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{log.ip_address}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-medium', log.status === 'success' ? 'text-green-400' : 'text-destructive')}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}
export default AuditLogsPage


// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/pages/SettingsPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { state } = useAuth()
  return (
    <div className="p-6 space-y-6 max-w-xl animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Account and system preferences</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Account</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Full name</span>
            <span>{state.user?.full_name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Email</span>
            <span>{state.user?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Role</span>
            <span className="capitalize">{state.user?.role?.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Username</span>
            <span>{state.user?.username}</span>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h2 className="text-sm font-semibold">Permissions</h2>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {state.user?.permissions.map(p => (
            <span key={p} className="text-[11px] font-mono bg-secondary px-2 py-1 rounded text-muted-foreground">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
export default SettingsPage


// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/pages/NotFoundPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom'
export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <p className="text-6xl font-bold text-muted-foreground/30">404</p>
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link to="/dashboard" className="text-sm text-primary hover:underline">Go to Dashboard</Link>
    </div>
  )
}
export default NotFoundPage


// ─────────────────────────────────────────────────────────────────────────────
// frontend/src/pages/RegisterPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { authApi } from '@/services/api'
import { Brain, Loader2 } from 'lucide-react'

const schema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  full_name: z.string().min(2),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  department: z.string().optional(),
})
type Form = z.infer<typeof schema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    setError('')
    try {
      await authApi.register(data)
      navigate('/login')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Registration failed')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">Create account</h1>
            <p className="text-sm text-muted-foreground">Join your team's knowledge workspace</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">{error}</div>}
          {[
            { name: 'email', label: 'Email', type: 'email', placeholder: 'you@company.com' },
            { name: 'username', label: 'Username', type: 'text', placeholder: 'johndoe' },
            { name: 'full_name', label: 'Full Name', type: 'text', placeholder: 'John Doe' },
            { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
            { name: 'department', label: 'Department (optional)', type: 'text', placeholder: 'Engineering' },
          ].map(({ name, label, type, placeholder }) => (
            <div key={name} className="space-y-1.5">
              <label className="text-sm font-medium">{label}</label>
              <input type={type} {...register(name as keyof Form)} placeholder={placeholder}
                className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
              {errors[name as keyof Form] && <p className="text-xs text-destructive">{errors[name as keyof Form]?.message}</p>}
            </div>
          ))}
          <button type="submit" disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create account
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
export default RegisterPage
