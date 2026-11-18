import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import type { PageResponse, SessionListEntry } from '../api/gateway.ts'
import { deriveDag } from '../model/dag.ts'
import { DagView } from './DagView.tsx'

type Tab = 'timeline' | 'dag' | 'result'

const TABS: readonly Tab[] = ['timeline', 'dag', 'result']

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour12: false })
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map(part => (typeof part === 'object' && part !== null && 'text' in part ? String((part as { text: unknown }).text) : ''))
      .join('')
  }
  return ''
}

export function TaskDetail(props: { page: PageResponse | null; sessionId: string; running: boolean; entries: SessionListEntry[] }) {
  const [tab, setTab] = useState<Tab>('timeline')
  const events = useMemo(() => props.page?.records.map(record => record.event) ?? [], [props.page])
  const dag = useMemo(() => deriveDag(events), [events])
  const title = dag.taskLabel
  const hasError = dag.toolCounts.errors > 0
  // The last turn/end decides the outcome; a recovered tool error alone is not a failed task.
  const failed = dag.turnEnd !== undefined ? dag.turnEnd !== 'completed' : hasError
  const status = props.running ? 'running' : failed ? 'failed' : 'completed'
  const statusClass = props.running ? 'bg-fd-primary/10 text-fd-primary border-fd-primary/30' : hasError ? 'bg-fd-danger/10 text-fd-danger border-fd-danger/30' : 'bg-fd-success/10 text-fd-success border-fd-success/30'

  if (props.page === null) {
    return <div className="flex h-full items-center justify-center text-fd-muted-foreground">loading…</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-fd-border bg-fd-card px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${statusClass}`}>
            {status === 'running' ? 'Running' : status === 'failed' ? 'Failed' : 'Completed'}
          </span>
          {status === 'running' && <span className="text-xs text-fd-muted-foreground">refreshing live…</span>}
        </div>
        <div className="mt-1 flex items-center gap-3 font-mono text-xs text-fd-muted-foreground">
          <span className="truncate">{props.sessionId}</span>
          <span>{dag.toolCounts.total} tool calls{hasError ? ` · ${dag.toolCounts.errors} failed` : ''}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b border-fd-border px-3 py-2">
        {TABS.map(candidate => (
          <button
            className={`relative rounded-md px-3 py-1.5 text-sm transition-colors ${tab === candidate ? 'text-fd-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground'}`}
            key={candidate}
            onClick={() =>{  setTab(candidate) }}
            type="button"
          >
            {tab === candidate && (
              <motion.span className="absolute inset-0 rounded-md bg-fd-secondary" layoutId="detail-tab" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
            <span className="relative capitalize">{candidate}</span>
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {/* Hidden documents pause animations; an exit-gated swap would never mount the next tab. */}
        <div className="h-full" key={tab}>
          {tab === 'timeline' && <TimelineView events={events} />}
          {tab === 'dag' && <DagView entries={props.entries} page={props.page} running={props.running} sessionId={props.sessionId} />}
          {tab === 'result' && <ResultView events={events} />}
        </div>
      </div>
    </div>
  )
}

function TimelineView(props: { events: PageResponse['records'][number]['event'][] }) {
  const rows = props.events.filter(event => event.type !== 'turn/start' && event.type !== 'turn/end')
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-2">
        {rows.map((event) => {
          const data = event.data
          if (event.type === 'user/message') {
            const source = data.source as { kind?: string; taskId?: string } | undefined
            const isTask = source?.taskId !== undefined
            return (
              <Row
                chip={isTask ? 'task' : 'context'}
                chipClass={isTask ? 'bg-fd-primary/10 text-fd-primary' : 'bg-fd-secondary text-fd-muted-foreground'}
                key={event.seq}
                preview={textOf(data.content)}
                time={formatTime(event.time)}
                title={isTask ? 'Task received' : 'Runtime context'}
              />
            )
          }
          if (event.type === 'assistant/message') {
            const turn = Number(data.turn ?? 0)
            return (
              <Row chip="agent" chipClass="bg-fd-secondary text-fd-foreground" key={event.seq} preview={textOf((data.message as { content?: unknown } | undefined)?.content)} time={formatTime(event.time)} title={`Turn ${turn}`} />
            )
          }
          if (event.type === 'tool/call') {
            const toolName = typeof data.name === 'string' ? data.name : 'tool'
            return (
              <Row chip="tool" chipClass="bg-fd-warning/10 text-fd-warning" key={event.seq} preview={JSON.stringify(data.arguments ?? null).slice(0, 160)} time={formatTime(event.time)} title={toolName} />
            )
          }
          if (event.type === 'tool/result') {
            const message = data.message as { toolCallId?: string; isError?: boolean } | undefined
            const errorText = typeof data.error === 'string' ? data.error : 'tool failed'
            return (
              <Row
                chip={message?.isError ? 'error' : 'ok'}
                chipClass={message?.isError ? 'bg-fd-danger/10 text-fd-danger' : 'bg-fd-success/10 text-fd-success'}
                key={event.seq}
                preview={message?.isError ? errorText : 'result returned'}
                time={formatTime(event.time)}
                title={message?.isError ? 'Tool failed' : 'Tool result'}
              />
            )
          }
          return null
        })}
        {rows.length === 0 && <p className="py-8 text-center text-sm text-fd-muted-foreground">no events yet</p>}
      </div>
    </div>
  )
}

function Row(props: { chip: string; chipClass: string; preview: string; time: string; title: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-fd-border bg-fd-card px-3 py-2">
      <span className="shrink-0 pt-0.5 font-mono text-xs text-fd-muted-foreground">{props.time}</span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${props.chipClass}`}>{props.chip}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{props.title}</div>
        {props.preview !== '' && <div className="mt-0.5 line-clamp-2 text-xs text-fd-muted-foreground">{props.preview}</div>}
      </div>
    </div>
  )
}

function ResultView(props: { events: PageResponse['records'][number]['event'][] }) {
  const assistantEvents = props.events.filter(event => event.type === 'assistant/message')
  const last = assistantEvents.at(-1)
  if (last === undefined) {
    return <div className="flex h-full items-center justify-center text-fd-muted-foreground">no result yet</div>
  }
  const data = last.data
  const usage = (data.usage ?? {}) as Record<string, unknown>
  const usageEntries = Object.entries(usage).filter(([, value]) => typeof value === 'number')
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="rounded-lg border border-fd-border bg-fd-card p-4">
        <div className="mb-2 text-xs uppercase tracking-wide text-fd-muted-foreground">Final answer</div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{textOf((data.message as { content?: unknown } | undefined)?.content) || '—'}</pre>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {usageEntries.map(([key, value]) => (
          <div className="rounded-lg border border-fd-border bg-fd-card px-3 py-2" key={key}>
            <div className="text-xs text-fd-muted-foreground">{key}</div>
            <div className="font-mono text-sm">{(value as number).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
