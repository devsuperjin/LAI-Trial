import { AnimatePresence, motion } from 'motion/react'
import type { SessionListEntry } from '../api/gateway.ts'
import { useState } from 'react'

type TaskStatus = 'running' | 'queued' | 'done'

function statusOf(entry: SessionListEntry): TaskStatus {
  if (entry.running) return 'running'
  if (entry.blank) return 'queued'
  return 'done'
}

const STATUS_DOT: Record<TaskStatus, string> = {
  running: 'bg-fd-primary',
  queued: 'bg-fd-muted-foreground',
  done: 'bg-fd-success',
}

const FILTERS = ['All', 'Running', 'Completed'] as const
type Filter = (typeof FILTERS)[number]

function matches(filter: Filter, status: TaskStatus): boolean {
  if (filter === 'All') return true
  if (filter === 'Running') return status === 'running' || status === 'queued'
  return status === 'done'
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour12: false })
}

export function TaskList(props: {
  entries: SessionListEntry[]
  selectedId: string | null
  onSelect: (sessionId: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('All')
  const visible = props.entries.filter(entry => matches(filter, statusOf(entry)))

  return (
    <aside className="flex w-80 shrink-0 flex-col border-r border-fd-border bg-fd-muted/50">
      <div className="flex items-center gap-1 px-3 pt-3">
        {FILTERS.map(candidate => (
          <button
            className={`relative rounded-md px-2.5 py-1 text-xs transition-colors ${filter === candidate ? 'text-fd-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground'}`}
            key={candidate}
            onClick={() =>{  setFilter(candidate) }}
            type="button"
          >
            {filter === candidate && (
              <motion.span className="absolute inset-0 rounded-md bg-fd-secondary" layoutId="filter-pill" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
            <span className="relative">{candidate}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <AnimatePresence initial={false}>
          {visible.map((entry) => {
            const status = statusOf(entry)
            const title = entry.projections?.values.title ?? entry.sessionId
            const tokens = entry.projections?.values.tokenUsage
            return (
              <motion.button
                animate={{ opacity: 1, y: 0 }}
                className={`mb-1 block w-full rounded-lg border px-3 py-2 text-left transition-colors ${props.selectedId === entry.sessionId ? 'border-fd-primary/40 bg-fd-secondary' : 'border-transparent hover:bg-fd-secondary/50'}`}
                exit={{ opacity: 0 }}
                initial={{ opacity: 0, y: 4 }}
                key={entry.sessionId}
                layout
                onClick={() =>{  props.onSelect(entry.sessionId) }}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]} ${status === 'running' ? 'animate-pulse' : ''}`} />
                  <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
                  <span className="shrink-0 text-xs text-fd-muted-foreground">{formatTime(entry.updatedAt)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 pl-4 text-xs text-fd-muted-foreground">
                  <span className="truncate font-mono">{entry.sessionId}</span>
                  {tokens !== undefined && (
                    <span className="shrink-0">{(tokens.outputTokens + tokens.cacheReadTokens + tokens.cacheWriteTokens + tokens.uncachedInputTokens).toLocaleString()} tok</span>
                  )}
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>
        {visible.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-fd-muted-foreground">no tasks match this filter</p>
        )}
      </div>
    </aside>
  )
}
