// frontend/src/pages/DocumentLibraryPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '@/services/api'
import { FileText, Trash2, RefreshCw, Search, Filter } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/utils/cn'
import { Link } from 'react-router-dom'
import type { Document, DocumentStatus } from '@/types'

const STATUS_COLORS: Record<DocumentStatus, string> = {
  pending:    'bg-yellow-500/20 text-yellow-400',
  processing: 'bg-blue-500/20 text-blue-400',
  ready:      'bg-green-500/20 text-green-400',
  failed:     'bg-red-500/20 text-red-400',
}

const FILE_ICONS: Record<string, string> = {
  pdf: '📄', docx: '📝', txt: '📃', xlsx: '📊',
}

export default function DocumentLibraryPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['documents', { search, statusFilter, page }],
    queryFn: () => documentsApi.list({
      page, page_size: 20,
      search: search || undefined,
      status: statusFilter || undefined,
    }),
  })

  const deleteMut = useMutation({
    mutationFn: documentsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })

  const totalPages = data ? Math.ceil(data.total / 20) : 1

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Document Library</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} documents</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search documents…"
            className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">All statuses</option>
          <option value="ready">Ready</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">File</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Chunks</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Uploaded</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 animate-pulse rounded bg-secondary" />
                    </td>
                  ))}
                </tr>
              ))
              : data?.items.map((doc) => (
                <tr key={doc.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span>{FILE_ICONS[doc.file_type] ?? '📎'}</span>
                      <div>
                        <p className="font-medium truncate max-w-xs">{doc.original_name}</p>
                        {doc.title && doc.title !== doc.original_name && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{doc.title}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs uppercase font-mono text-muted-foreground">
                    {doc.file_type}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[doc.status])}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.chunk_count}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${doc.original_name}"?`)) deleteMut.mutate(doc.id)
                      }}
                      className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {data?.items.length === 0 && !isLoading && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No documents found. <Link to="/upload" className="text-primary hover:underline">Upload one</Link>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {page} of {totalPages} · {data?.total} total
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-secondary transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-secondary transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
