// frontend/src/pages/AuditLogsPage.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditApi } from '@/services/api'
import { ScrollText, Search, Download, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { format, formatDistanceToNow } from 'date-fns'
import type { AuditLog } from '@/types'

const ACTION_META: Record<string, { emoji: string; color: string; label: string }> = {
  'user.login':      { emoji: '🔐', color: 'text-blue-400',   label: 'Login' },
  'user.logout':     { emoji: '🚪', color: 'text-slate-400',  label: 'Logout' },
  'document.upload': { emoji: '📤', color: 'text-green-400',  label: 'Upload' },
  'document.delete': { emoji: '🗑️', color: 'text-red-400',    label: 'Delete' },
  'search.perform':  { emoji: '🔍', color: 'text-purple-400', label: 'Search' },
  'chat.query':      { emoji: '💬', color: 'text-primary',    label: 'Chat' },
}

const KNOWN_ACTIONS = Object.keys(ACTION_META)

function AuditRow({ log }: { log: AuditLog }) {
  const meta = ACTION_META[log.action] ?? { emoji: '📋', color: 'text-muted-foreground', label: log.action }
  const isSuccess = log.status === 'success'

  return (
    <tr className="hover:bg-secondary/20 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{meta.emoji}</span>
          <span className={cn('text-xs font-medium', meta.color)}>{log.action}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <code className="text-xs text-muted-foreground">
          {log.user_id ? log.user_id.slice(0, 8) + '…' : 'system'}
        </code>
      </td>
      <td className="px-4 py-3">
        {log.resource_type ? (
          <span className="text-xs text-muted-foreground">
            {log.resource_type}
            {log.resource_id && (
              <code className="ml-1 text-[10px]">/{log.resource_id.slice(0, 8)}</code>
            )}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/30">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {log.details && Object.keys(log.details).length > 0 ? (
          <span className="text-xs text-muted-foreground max-w-[160px] truncate block">
            {Object.entries(log.details)
              .map(([k, v]) => `${k}: ${String(v).slice(0, 40)}`)
              .join(' · ')}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/30">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <code className="text-[11px] text-muted-foreground">{log.ip_address ?? '—'}</code>
      </td>
      <td className="px-4 py-3">
        {isSuccess
          ? <CheckCircle className="h-3.5 w-3.5 text-green-400" />
          : <XCircle className="h-3.5 w-3.5 text-destructive" />
        }
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">
            {format(new Date(log.created_at), 'MMM d, yyyy')}
          </p>
          <p className="text-[10px] text-muted-foreground/60">
            {format(new Date(log.created_at), 'HH:mm:ss')}
          </p>
        </div>
      </td>
    </tr>
  )
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit', { page, page_size: 50, action }],
    queryFn: () => auditApi.list({ page, page_size: 50, action: action || undefined }),
    staleTime: 15_000,
  })

  const totalPages = data ? Math.ceil(data.total / 50) : 1

  // Client-side search filter on user_id / action
  const filtered = (data?.items ?? []).filter(log => {
    if (!search) return true
    return (
      log.action.includes(search.toLowerCase()) ||
      log.user_id?.includes(search) ||
      log.ip_address?.includes(search) ||
      JSON.stringify(log.details ?? {}).toLowerCase().includes(search.toLowerCase())
    )
  })

  // Export as JSON
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data?.items ?? [], null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} recorded events
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={!data?.items.length}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm
                     hover:bg-secondary disabled:opacity-40 transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export JSON
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by user, IP, details…"
            className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={action}
          onChange={e => { setAction(e.target.value); setPage(1) }}
          className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All actions</option>
          {KNOWN_ACTIONS.map(a => (
            <option key={a} value={a}>{ACTION_META[a].emoji} {a}</option>
          ))}
        </select>
      </div>

      {/* Stats bar */}
      {data && (
        <div className="flex gap-4 flex-wrap">
          {KNOWN_ACTIONS.map(a => {
            const count = data.items.filter(l => l.action === a).length
            if (count === 0) return null
            const m = ACTION_META[a]
            return (
              <button
                key={a}
                onClick={() => setAction(action === a ? '' : a)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  action === a
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                )}
              >
                <span>{m.emoji}</span>
                <span className={m.color}>{m.label}</span>
                <span className="font-mono">{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                {['Action', 'User ID', 'Resource', 'Details', 'IP Address', 'Status', 'Timestamp'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-secondary" />
                      </td>
                    ))}
                  </tr>
                ))
                : filtered.map(log => <AuditRow key={log.id} log={log} />)
              }
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && !isLoading && (
          <div className="py-16 text-center">
            <ScrollText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No audit logs found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · {data?.total} events
          </p>
          <div className="flex gap-2">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'h-7 w-7 rounded text-xs font-medium transition-colors',
                  p === page
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border hover:bg-secondary text-muted-foreground'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
