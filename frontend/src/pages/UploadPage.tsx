// frontend/src/pages/UploadPage.tsx
import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi, collectionsApi } from '@/services/api'
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

interface UploadItem {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  message?: string
  documentId?: string
}

const ALLOWED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadPage() {
  const qc = useQueryClient()
  const [items, setItems] = useState<UploadItem[]>([])
  const [collectionId, setCollectionId] = useState('')
  const [department, setDepartment] = useState('')

  const { data: collections } = useQuery({
    queryKey: ['collections', { page: 1, page_size: 100 }],
    queryFn: () => collectionsApi.list({ page: 1, page_size: 100 }),
  })

  const onDrop = useCallback((accepted: File[]) => {
    const newItems: UploadItem[] = accepted.map(f => ({ file: f, status: 'pending' }))
    setItems(prev => [...prev, ...newItems])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxSize: 50 * 1024 * 1024,
  })

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  const uploadAll = async () => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== 'pending') continue
      setItems(prev => prev.map((it, idx) => idx === i ? { ...it, status: 'uploading' } : it))
      try {
        const resp = await documentsApi.upload(items[i].file, {
          collection_id: collectionId || undefined,
          department: department || undefined,
        })
        setItems(prev => prev.map((it, idx) => idx === i
          ? { ...it, status: 'success', message: resp.message, documentId: resp.document_id }
          : it
        ))
      } catch (e: any) {
        const msg = e?.response?.data?.detail ?? 'Upload failed'
        setItems(prev => prev.map((it, idx) => idx === i
          ? { ...it, status: 'error', message: msg }
          : it
        ))
      }
    }
    qc.invalidateQueries({ queryKey: ['documents'] })
  }

  const pendingCount = items.filter(i => i.status === 'pending').length

  return (
    <div className="p-6 max-w-2xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold">Upload Documents</h1>
        <p className="text-sm text-muted-foreground">
          Supported: PDF, DOCX, TXT, XLSX · Max 50 MB per file
        </p>
      </div>

      {/* Metadata */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Collection (optional)</label>
          <select
            value={collectionId}
            onChange={e => setCollectionId(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">No collection</option>
            {collections?.items.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Department (optional)</label>
          <input
            value={department}
            onChange={e => setDepartment(e.target.value)}
            placeholder="e.g. Finance, Legal"
            className="w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-secondary/20'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        {isDragActive
          ? <p className="text-sm font-medium text-primary">Drop files here…</p>
          : (
            <>
              <p className="text-sm font-medium">Drag & drop files, or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">PDF · DOCX · TXT · XLSX</p>
            </>
          )
        }
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <File className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatSize(item.file.size)}
                  {item.message && ` · ${item.message}`}
                </p>
              </div>
              <div className="shrink-0">
                {item.status === 'pending' && (
                  <button onClick={() => removeItem(i)}>
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
                {item.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {item.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                {item.status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {pendingCount} pending · {items.filter(i => i.status === 'success').length} uploaded
            </p>
            <button
              onClick={uploadAll}
              disabled={pendingCount === 0}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium
                         text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              <Upload className="h-4 w-4" />
              Upload {pendingCount > 0 ? `${pendingCount} file${pendingCount !== 1 ? 's' : ''}` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
