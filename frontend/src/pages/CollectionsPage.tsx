// frontend/src/pages/CollectionsPage.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { collectionsApi } from '@/services/api'
import { useAuth } from '@/store/authStore'
import { FolderOpen, Plus, Trash2, Globe, Lock, FileText, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Collection } from '@/types'
import { formatDistanceToNow } from 'date-fns'

const COLLECTION_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
]

interface CreateFormData {
  name: string
  description: string
  department: string
  color: string
  is_public: boolean
}

function CollectionCard({
  collection,
  onDelete,
  canDelete,
}: {
  collection: Collection
  onDelete: (id: string) => void
  canDelete: boolean
}) {
  return (
    <div className="group rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${collection.color ?? '#3b82f6'}20` }}
          >
            <FolderOpen
              className="h-5 w-5"
              style={{ color: collection.color ?? '#3b82f6' }}
            />
          </div>
          <div>
            <p className="font-semibold text-sm">{collection.name}</p>
            <div className="mt-0.5 flex items-center gap-2">
              {collection.is_public
                ? <Globe className="h-3 w-3 text-muted-foreground" />
                : <Lock className="h-3 w-3 text-muted-foreground" />
              }
              <span className="text-xs text-muted-foreground">
                {collection.is_public ? 'Public' : 'Private'}
              </span>
              {collection.department && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{collection.department}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {canDelete && (
          <button
            onClick={() => {
              if (confirm(`Delete collection "${collection.name}"? Documents will not be deleted.`)) {
                onDelete(collection.id)
              }
            }}
            className="rounded p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100
                       hover:text-destructive transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {collection.description && (
        <p className="mt-3 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {collection.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span>{collection.doc_count} document{collection.doc_count !== 1 ? 's' : ''}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(collection.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  )
}

function CreateCollectionModal({
  open,
  onClose,
  onCreate,
  isLoading,
}: {
  open: boolean
  onClose: () => void
  onCreate: (data: CreateFormData) => void
  isLoading: boolean
}) {
  const [form, setForm] = useState<CreateFormData>({
    name: '',
    description: '',
    department: '',
    color: '#3b82f6',
    is_public: false,
  })

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onCreate(form)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Create Collection</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Legal Documents"
              autoFocus
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What documents belong here?"
              rows={2}
              className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                         placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Department</label>
              <input
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                placeholder="e.g. Finance"
                className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLLECTION_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={cn(
                      'h-6 w-6 rounded-full transition-transform hover:scale-110',
                      form.color === c && 'ring-2 ring-offset-2 ring-offset-card ring-white scale-110'
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <div
              onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
              className={cn(
                'relative h-5 w-9 rounded-full transition-colors',
                form.is_public ? 'bg-primary' : 'bg-secondary'
              )}
            >
              <div className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                form.is_public ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </div>
            <span className="text-sm">
              {form.is_public ? 'Public — visible to all users' : 'Private — only you can see this'}
            </span>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={!form.name.trim() || isLoading}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground
                         hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isLoading ? 'Creating…' : 'Create Collection'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CollectionsPage() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['collections', { page: 1, page_size: 100 }],
    queryFn: () => collectionsApi.list({ page: 1, page_size: 100 }),
    staleTime: 30_000,
  })

  const createMut = useMutation({
    mutationFn: collectionsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] })
      setShowCreate(false)
    },
  })

  const deleteMut = useMutation({
    mutationFn: collectionsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['collections'] }),
  })

  const canCreate = hasPermission('collections:create')
  const canDelete = hasPermission('collections:delete')

  const filtered = (data?.items ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Collections</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total ?? 0} collection{data?.total !== 1 ? 's' : ''}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium
                       text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            New Collection
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter collections…"
          className="w-full rounded-lg border border-border bg-secondary/50 py-2 pl-9 pr-3 text-sm
                     placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-card border border-border" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(col => (
            <CollectionCard
              key={col.id}
              collection={col}
              onDelete={(id) => deleteMut.mutate(id)}
              canDelete={canDelete}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
            <FolderOpen className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium">
            {search ? 'No matching collections' : 'No collections yet'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {search
              ? 'Try a different search term'
              : 'Create a collection to organise your documents'
            }
          </p>
          {canCreate && !search && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm
                         font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Create your first collection
            </button>
          )}
        </div>
      )}

      {/* Create modal */}
      <CreateCollectionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={(data) => createMut.mutate(data)}
        isLoading={createMut.isPending}
      />
    </div>
  )
}
