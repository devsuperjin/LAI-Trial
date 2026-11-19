import type { SessionListEntry, WireEvent } from '../api/gateway.ts'
import { record, textOf } from './dag.ts'

export type TimingKind = 'session' | 'subagent' | 'turn' | 'tool'
export type TimingStatus = 'running' | 'completed' | 'failed' | 'unknown'
export interface TimingSpan {
  id: string
  label: string
  kind: TimingKind
  status: TimingStatus
  start: number
  end: number | null
  observedThrough: number
  partial: boolean
  detail: string
  children: TimingSpan[]
}
const content = (value: unknown) => textOf(value).slice(0, 12000)
const terminalStatus = (event: WireEvent): TimingStatus => { const kind = record(event.data.reason).kind; return kind === 'completed' ? 'completed' : typeof kind === 'string' ? 'failed' : 'unknown' }

/** Borrowed parent history must not appear as child execution. */
export function ownChildEvents(events: WireEvent[], entry: SessionListEntry): WireEvent[] {
  const boundary = entry.projections?.values.subagent?.seq ?? events.findLast(event => event.type === 'subagent/descriptor')?.seq
  return boundary === undefined ? events : events.filter(event => event.seq >= boundary)
}

/** Use recorded boundaries only; an absent end remains unknown when the session is settled. */
export function sessionTiming(input: { id: string; label: string; events: WireEvent[]; running: boolean; child?: boolean; startedAt?: number; partial?: boolean }): TimingSpan | null {
  const events = input.events.filter(event => Number.isFinite(event.time)).slice().sort((a, b) => a.seq - b.seq)
  const first = events.find(event => ['turn/start', 'assistant/message', 'tool/call'].includes(event.type)) ?? events[0]
  if (!first && input.startedAt === undefined) return null
  const start = input.startedAt ?? first!.time
  const through = Math.max(start, ...events.map(event => event.time))
  const root: TimingSpan = { id: input.id, label: input.label, kind: input.child ? 'subagent' : 'session', status: input.running ? 'running' : 'unknown', start, end: null, observedThrough: through, partial: input.partial === true, detail: input.id, children: [] }
  const pending = new Map<string, TimingSpan>()
  let current: TimingSpan | undefined
  let number = 0
  let lastEnd: WireEvent | undefined
  const newTurn = (event: WireEvent, partial: boolean): TimingSpan => {
    const local = ++number
    const turn = typeof event.data.turn === 'number' ? event.data.turn : local
    const span: TimingSpan = { id: `${input.id}:turn:${event.seq}`, label: `Turn ${turn}`, kind: 'turn', status: 'unknown', start: event.time, end: null, observedThrough: event.time, partial, detail: '', children: [] }
    root.children.push(span); current = span
    return span
  }
  for (const event of events) {
    if (event.type === 'turn/start') { newTurn(event, false); continue }
    if (event.type === 'turn/end') {
      if (current) { current.end = Math.max(current.start, event.time); current.observedThrough = current.end; current.status = terminalStatus(event) }
      lastEnd = event; current = undefined; continue
    }
    if (event.type === 'assistant/message') {
      const turn = current ?? newTurn(event, true)
      turn.detail = content(record(event.data.message).content)
      turn.observedThrough = Math.max(turn.observedThrough, event.time)
    }
    if (event.type === 'tool/call') {
      const turn = current ?? newTurn(event, true)
      const callId = String(event.data.callId ?? event.data.id ?? event.seq)
      const span: TimingSpan = { id: `${input.id}:tool:${event.seq}`, label: String(event.data.name ?? 'tool'), kind: 'tool', status: 'unknown', start: event.time, end: null, observedThrough: event.time, partial: false, detail: JSON.stringify(event.data.arguments ?? {}, null, 2).slice(0, 12000), children: [] }
      turn.children.push(span); pending.set(callId, span); turn.observedThrough = Math.max(turn.observedThrough, event.time)
    }
    if (event.type === 'tool/result') {
      const message = record(event.data.message)
      const span = pending.get(String(message.toolCallId ?? event.data.toolCallId ?? ''))
      if (span) {
        span.end = Math.max(span.start, event.time); span.observedThrough = span.end
        span.status = message.isError === true ? 'failed' : 'completed'
        span.detail += `\n\n${content(message.content)}`
        pending.delete(String(message.toolCallId ?? event.data.toolCallId ?? ''))
      }
    }
  }
  if (current) {
    current.observedThrough = through
    current.status = input.running ? 'running' : 'unknown'
    for (const tool of current.children.filter(tool => tool.end === null)) { tool.status = current.status; tool.observedThrough = through }
  }
  if (!input.running && lastEnd && !current) { root.end = Math.max(start, lastEnd.time); root.status = terminalStatus(lastEnd) }
  root.detail += root.partial ? '\nEarlier events are not loaded.' : ''
  return root
}

export function timingEnd(span: TimingSpan, now: number): number {
  return Math.max(span.start, span.end ?? (span.status === 'running' ? Math.max(now, span.observedThrough) : span.observedThrough))
}
export function flattenTiming(root: TimingSpan, expanded: ReadonlySet<string>, filter: 'all' | TimingKind = 'all'): { span: TimingSpan; depth: number }[] {
  const rows: { span: TimingSpan; depth: number }[] = []
  const visit = (span: TimingSpan, depth: number) => {
    if (filter === 'all' || filter === span.kind) rows.push({ span, depth })
    if (filter !== 'all' || expanded.has(span.id)) for (const child of span.children) visit(child, filter === 'all' ? depth + 1 : 0)
  }
  visit(root, 0)
  return rows
}
export function timingDomain(root: TimingSpan, now: number): { start: number; end: number; duration: number } {
  const all: TimingSpan[] = []
  const visit = (span: TimingSpan) => { all.push(span); span.children.forEach(visit) }; visit(root)
  // Include child sessions that can outlive the parent's dispatch turn.
  const start = Math.min(root.start, ...all.map(span => span.start))
  const end = Math.max(start + 1, ...all.map(span => timingEnd(span, now)))
  return { start, end, duration: end - start }
}
export function timeLabel(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`
  return `${(ms / 60000).toFixed(1)} min`
}
