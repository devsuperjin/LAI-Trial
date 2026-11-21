import { useAppearance } from '../appearance.tsx'
import { SelectionGroup, SelectionIndicator } from './SelectionMotion.tsx'
import { readableRunTitle } from '../model/runs.ts'
import { useLanguage } from '../i18n.tsx'
import { AnimatePresence, motion } from 'motion/react'
import type { SessionListEntry } from '../api/gateway.ts'
import { useState } from 'react'

type TaskStatus = 'running' | 'queued' | 'done'

function statusOf(entry: SessionListEntry): TaskStatus {
  if (entry.running) return 'running'
  if (entry.blank) return 'queued'
  return 'done'
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  running: 'text-fd-primary', queued: 'text-fd-muted-foreground', done: 'text-fd-success',
}
const STATUS_LABEL: Record<TaskStatus, string> = { running: 'Running', queued: 'Queued', done: 'Completed' }

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
  const { reduceMotion: reduced } = useAppearance()
  const [filter, setFilter] = useState<Filter>('All')
  const visible = props.entries.filter(entry => matches(filter, statusOf(entry)))

  return (
    <aside aria-label={t("Runs list")} className="run-list flex max-h-48 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-fd-border bg-fd-card md:max-h-none">
      <div className="run-list-compact-filter hidden items-center gap-2 px-2 pt-2"><select aria-label={t('Run status filter')} value={filter} onChange={event => setFilter(event.target.value as Filter)} className="min-w-0 flex-1 rounded-md border border-fd-border bg-fd-card px-2 py-1.5 text-xs">{FILTERS.map(candidate => <option key={candidate} value={candidate}>{t(candidate)}</option>)}</select>{props.onToggleWorkers && <button type="button" aria-label={t('Worker runs only')} aria-pressed={props.workersOnly} onClick={props.onToggleWorkers} className={`rounded-md p-1.5 ${props.workersOnly ? 'bg-fd-primary/10 text-fd-primary' : 'text-fd-muted-foreground'}`}><svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 4h18l-7 8v7l-4 2v-9Z" /></svg></button>}</div>
      <SelectionGroup><div className="run-list-filters flex items-center gap-1 px-3 pt-3">
        {FILTERS.map(candidate => (
          <button
            aria-pressed={filter === candidate}
            className={`relative isolate rounded-md px-2 py-1.5 text-xs transition-colors ${filter === candidate ? 'text-fd-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground'}`}
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
            return (
              <motion.button
                animate={{ opacity: 1, y: 0 }}
                className={`relative isolate mb-2 block w-full rounded-lg border border-fd-border px-3 py-3 text-left transition-colors ${props.selectedId === entry.sessionId ? '' : 'hover:bg-fd-secondary/50'}`}
                exit={{ opacity: 0 }}
                initial={reduced ? false : { opacity: 0, y: 4 }}
                key={entry.sessionId}
                aria-pressed={props.selectedId === entry.sessionId}
                layout={!reduced}
                transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
                onClick={() =>{  props.onSelect(entry.sessionId) }}
                type="button"
              >
                {props.selectedId === entry.sessionId && <SelectionIndicator className="rounded-lg ring-1 ring-fd-primary/60 bg-fd-primary/5" />}
                <div className="relative flex min-w-0 items-center gap-2.5">
                  <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${STATUS_COLOR[status]} ${status === 'running' ? 'animate-spin motion-reduce:animate-none' : ''}`}>
                    {status === 'running' ? <path d="M21 12a9 9 0 1 1-9-9" /> : <><circle cx="12" cy="12" r="9" />{status === 'done' ? <path d="m8 12 3 3 5-6" /> : <path d="M12 7v5l3 2" />}</>}
                  </svg>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{title}</p><p className="mt-1 truncate text-xs text-fd-muted-foreground">{entry.sessionId}</p></div>
                  <time className="run-list-time shrink-0 text-xs tabular-nums text-fd-muted-foreground">{formatTime(entry.updatedAt)}</time>
                  <span className={`run-list-status shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[status]} ${status === 'done' ? 'bg-fd-success/10' : status === 'running' ? 'bg-fd-primary/10' : 'bg-fd-secondary'}`}>{t(STATUS_LABEL[status])}</span>
                  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="run-list-chevron shrink-0 text-fd-muted-foreground"><path d="m9 5 7 7-7 7" /></svg>
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
