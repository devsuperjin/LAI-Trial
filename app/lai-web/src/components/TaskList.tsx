import { SelectionGroup, SelectionIndicator } from './SelectionMotion.tsx'
import { readableRunTitle } from '../model/runs.ts'
import { useLanguage } from '../i18n.tsx'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
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
  workersOnly?: boolean
  onToggleWorkers?: () => void
  entries: SessionListEntry[]
  selectedId: string | null
  onSelect: (sessionId: string) => void
}) {
  const { t } = useLanguage()
  const reduced = useReducedMotion()
  const [filter, setFilter] = useState<Filter>('All')
  const visible = props.entries.filter(entry => matches(filter, statusOf(entry)))

  return (
    <aside aria-label={t("Runs list")} className="flex max-h-48 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-card md:max-h-none md:w-72 xl:w-80">
      <SelectionGroup><div className="flex items-center gap-1 px-3 pt-3">
        {FILTERS.map(candidate => (
          <button
            aria-pressed={filter === candidate}
            className={`relative isolate rounded-md px-2.5 py-1 text-xs transition-colors ${filter === candidate ? 'text-fd-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground'}`}
            key={candidate}
            onClick={() =>{  setFilter(candidate) }}
            type="button"
          >
            {filter === candidate && <SelectionIndicator />}
            <span className="relative">{t(candidate)}</span>
          </button>
        ))}
        {props.onToggleWorkers && <button type="button" aria-label={t('Worker runs only')} title={t(props.workersOnly ? 'Showing Worker runs. Click to show all runs.' : 'Showing all runs. Click to show Worker runs only.')} aria-pressed={props.workersOnly} onClick={props.onToggleWorkers} className={`ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${props.workersOnly ? 'bg-fd-primary/10 text-fd-primary' : 'text-fd-muted-foreground hover:bg-fd-secondary'}`}><svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h18l-7 8v7l-4 2v-9Z" /></svg></button>}
      </div></SelectionGroup>
      <SelectionGroup><motion.div layoutScroll className="min-h-0 flex-1 overflow-y-auto p-2">
        <AnimatePresence initial={false}>
          {visible.map((entry) => {
            const status = statusOf(entry)
            const title = readableRunTitle(entry.projections?.values.title, entry.sessionId)
            const tokens = entry.projections?.values.tokenUsage
            return (
              <motion.button
                animate={{ opacity: 1, y: 0 }}
                className={`relative isolate mb-1 block w-full rounded-lg border border-transparent px-3 py-2 text-left transition-colors ${props.selectedId === entry.sessionId ? '' : 'hover:bg-fd-secondary/50'}`}
                exit={{ opacity: 0 }}
                initial={reduced ? false : { opacity: 0, y: 4 }}
                key={entry.sessionId}
                aria-pressed={props.selectedId === entry.sessionId}
                layout={!reduced}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() =>{  props.onSelect(entry.sessionId) }}
                type="button"
              >
                {props.selectedId === entry.sessionId && <SelectionIndicator className="rounded-lg border border-fd-primary/40 bg-fd-secondary" />}
                <div className="relative flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]} ${status === 'running' ? 'animate-pulse motion-reduce:animate-none' : ''}`} />
                  <span className="min-w-0 flex-1 truncate text-sm">{title}</span>
                  <span className="shrink-0 text-xs text-fd-muted-foreground">{formatTime(entry.updatedAt)}</span>
                </div>
                <div className="relative mt-1 flex items-center gap-2 pl-4 text-xs text-fd-muted-foreground">
                  <span className="truncate font-mono">{entry.sessionId}</span>
                  {tokens !== undefined && (
                    <span className="shrink-0">{(tokens.outputTokens + tokens.cacheReadTokens + tokens.cacheWriteTokens + tokens.uncachedInputTokens).toLocaleString()}{t(" tok")}</span>
                  )}
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>
        {visible.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-fd-muted-foreground">{t("no tasks match this filter")}</p>
        )}
      </motion.div></SelectionGroup>
    </aside>
  )
}
