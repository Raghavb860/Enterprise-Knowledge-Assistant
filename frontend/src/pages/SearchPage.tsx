// frontend/src/pages/SearchPage.tsx
import { useState, FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { searchApi } from '@/services/api'
import { Search, Clock, FileText, ChevronDown, ChevronUp, Zap, AlignLeft, Layers } from 'lucide-react'
import type { SearchResultItem, SearchType } from '@/types'
import { cn } from '@/utils/cn'

function ResultCard({ result, index }: { result: SearchResultItem; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const score = Math.round(result.score * 100)

  const scoreColor =
    score >= 80 ? 'bg-green-500/20 text-green-400' :
    score >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
    'bg-secondary text-muted-foreground'

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-fade-in">
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-mono text-primary">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 font-medium text-sm">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate">{result.document_name}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              Page {result.page_number} · Chunk {result.chunk_index}
            </span>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', scoreColor)}>
              {score}% match
            </span>
          </div>
          <p className={cn(
            'mt-2 text-xs text-muted-foreground leading-relaxed',
            !expanded && 'line-clamp-3'
          )}>
            {result.excerpt}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
          }
        </button>
      </div>
    </div>
  )
}

const SEARCH_TYPES: { value: SearchType; label: string; icon: React.ElementType; desc: string }[] = [
  { value: 'hybrid',   label: 'Hybrid',   icon: Layers,   desc: 'Best of both: vector + BM25 (recommended)' },
  { value: 'semantic', label: 'Semantic', icon: Zap,      desc: 'Vector similarity — great for concepts' },
  { value: 'keyword',  label: 'Keyword',  icon: AlignLeft, desc: 'BM25 keyword matching — exact terms' },
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('hybrid')
  const [nResults, setNResults] = useState(10)

  const { mutate, data, isPending, reset } = useMutation({
    mutationFn: searchApi.search,
  })

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    mutate({ query: q, search_type: searchType, n_results: nResults })
  }

  const handleClear = () => {
    setQuery('')
    reset()
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Search</h1>
        <p className="text-sm text-muted-foreground">
          Semantic, keyword, and hybrid search across all indexed documents
        </p>
      </div>

      {/* Search type selector */}
      <div className="grid grid-cols-3 gap-2">
        {SEARCH_TYPES.map(({ value, label, icon: Icon, desc }) => (
          <button
            key={value}
            onClick={() => setSearchType(value)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors',
              searchType === value
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border bg-card/50 text-muted-foreground hover:border-primary/40 hover:bg-secondary/40'
            )}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{label}</span>
            </div>
            <span className="text-[10px] leading-tight">{desc}</span>
          </button>
        ))}
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search your documents… (${searchType})`}
            className="w-full rounded-xl border border-border bg-secondary/50 py-3 pl-10 pr-28 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={!query.trim() || isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground
                         hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Search
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Results:</span>
          {[5, 10, 20, 50].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setNResults(n)}
              className={cn(
                'rounded px-2 py-0.5 transition-colors',
                nResults === n
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'hover:bg-secondary hover:text-foreground'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </form>

      {/* Loading skeleton */}
      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-card border border-border" />
          ))}
        </div>
      )}

      {/* Results */}
      {data && !isPending && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              <strong className="text-foreground">{data.total}</strong> results
              in <strong className="text-foreground">{data.elapsed_ms}ms</strong>
              {' '}· {data.search_type} search for "{data.query}"
            </span>
          </div>

          {data.results.length > 0
            ? data.results.map((r, i) => <ResultCard key={i} result={r} index={i} />)
            : (
              <div className="rounded-xl border border-border py-16 text-center">
                <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium">No results found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try different keywords or switch to semantic search
                </p>
              </div>
            )
          }
        </div>
      )}
    </div>
  )
}
