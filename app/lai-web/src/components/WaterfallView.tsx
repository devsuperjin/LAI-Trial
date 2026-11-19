import { useEffect, useMemo, useState } from 'react'
import type { PageResponse, SessionListEntry } from '../api/gateway.ts'
import { pageSubagentSession } from '../api/gateway.ts'
import { useInterval } from '../hooks/useInterval.ts'
import { useLanguage } from '../i18n.tsx'
import { flattenTiming, ownChildEvents, sessionTiming, timeLabel, timingDomain, timingEnd } from '../model/waterfall.ts'
import type { TimingKind, TimingSpan } from '../model/waterfall.ts'

interface ChildPage { page?: PageResponse; version: number; error?: string }
const PRESET_NAMES: Record<string, string> = { 'iqe-triage': 'Triage', 'iqe-reproduction': 'Reproduction', 'iqe-ticket': 'Ticket', 'iqe-reviewer': 'Reviewer', 'iqe-reporting': 'Reporter' }
const button = 'rounded-md border border-fd-border bg-fd-card px-2.5 py-1.5 text-xs disabled:opacity-40'
const color = (span: TimingSpan) => span.status === 'failed' ? 'bg-fd-danger' : span.status === 'running' ? 'bg-fd-warning' : span.status === 'unknown' ? 'bg-fd-muted-foreground/40' : span.kind === 'subagent' ? 'bg-fd-success' : span.kind === 'tool' ? 'bg-violet-500' : 'bg-fd-primary'

/** A shared clock makes native parent/child overlap visible; tools stay under their owning Turns. */
export function WaterfallView({ page, sessionId, running, entries }: { page: PageResponse; sessionId: string; running: boolean; entries: SessionListEntry[] }) {
  const { t } = useLanguage()
  const [children, setChildren] = useState<Record<string, ChildPage>>({})
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([sessionId]))
  const [filter, setFilter] = useState<'all' | TimingKind>('all')
  const [zoom, setZoom] = useState(1)
  const [selected, setSelected] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now)
  const [poll, setPoll] = useState(0)
  const [retry, setRetry] = useState(0)
  const childKey = JSON.stringify(entries.filter(entry => entry.parentSessionId === sessionId).map(entry => [entry.sessionId, entry.updatedAt, entry.running]))
  const direct = useMemo(() => entries.filter(entry => entry.parentSessionId === sessionId), [entries, sessionId])
  const active = running || direct.some(entry => entry.running)
  useInterval(() => setNow(Date.now()), active ? 1000 : null)
  useInterval(() => setPoll(value => value + 1), active ? 2500 : null)
  useEffect(() => {
    let current = true
    const targets = direct.filter(entry => !children[entry.sessionId] || entry.running || children[entry.sessionId]!.version !== entry.updatedAt || children[entry.sessionId]!.error && retry > 0)
    void Promise.allSettled(targets.map(async entry => {
      try {
        const result = await pageSubagentSession(sessionId, entry.sessionId, 500)
        if (current) setChildren(previous => ({ ...previous, [entry.sessionId]: { page: result, version: entry.updatedAt } }))
      } catch (e) {
        if (current) setChildren(previous => ({ ...previous, [entry.sessionId]: { ...previous[entry.sessionId], version: entry.updatedAt, error: e instanceof Error ? e.message : String(e) } }))
      }
    }))
    return () => { current = false }
    // The signature prevents identical list polls from refetching settled child histories.
  }, [sessionId, childKey, poll, retry])

  const root = useMemo(() => {
    const events = page.records.map(row => row.event)
    const parent = sessionTiming({ id: sessionId, label: 'Session', events, running, partial: page.hasMore })
    if (!parent) return null
    const catalog = entries.find(entry => entry.sessionId === sessionId)?.projections?.values.subagentCatalog ?? []
    for (const entry of direct) {
      const loaded = children[entry.sessionId]?.page
      const start = catalog.find(child => child.id === entry.sessionId)?.createdAt
      const values = entry.projections?.values
      const label = PRESET_NAMES[values?.agentPreset ?? ''] ?? values?.subagent?.label ?? values?.title ?? entry.sessionId
      const child = sessionTiming({ id: entry.sessionId, label, events: loaded ? ownChildEvents(loaded.records.map(row => row.event), entry) : [], running: entry.running, child: true, ...(start === undefined ? {} : { startedAt: start }), partial: !loaded || loaded.hasMore })
      if (child) parent.children.push(child)
    }
    parent.children.sort((a, b) => a.start - b.start)
    return parent
  }, [page, sessionId, running, entries, direct, children])
  const rows = useMemo(() => root ? flattenTiming(root, expanded, filter) : [], [root, expanded, filter])
  const selectedSpan = useMemo(() => {
    let result: TimingSpan | undefined
    const visit = (span: TimingSpan) => { if (span.id === selected) result = span; span.children.forEach(visit) }
    if (root) visit(root)
    return result
  }, [root, selected])
  const errors = Object.entries(children).filter(([, child]) => child.error)
  const loading = direct.filter(entry => !children[entry.sessionId]).length
  if (!root) return <div className="p-6 text-sm text-fd-muted-foreground">{t('No timing events available.')}</div>
  const domain = timingDomain(root, now)
  const gridWidth = 880 + (zoom - 1) * 700
  const grid = { gridTemplateColumns: '260px minmax(620px, 1fr)' }
  const ticks = Array.from({ length: 6 }, (_, index) => index / 5)
  const toggle = (id: string) => setExpanded(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const duration = (span: TimingSpan) => span.end === null && span.status !== 'running' ? '—' : timeLabel(timingEnd(span, now) - span.start)
  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-fd-border bg-fd-card px-4 py-2">
      <select aria-label={t('Timing filter')} className={button} value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>{[['all', 'All activity'], ['turn', 'Turns'], ['tool', 'Tools'], ['subagent', 'Subagents']].map(([value, label]) => <option key={value} value={value}>{t(label!)}</option>)}</select>
      <button type="button" className={button} disabled={zoom === 1} onClick={() => setZoom(value => Math.max(1, value / 2))} aria-label={t('Zoom out')}>−</button>
      <span className="w-12 text-center font-mono text-xs text-fd-muted-foreground">{Math.round(zoom * 100)}%</span>
      <button type="button" className={button} disabled={zoom >= 32} onClick={() => setZoom(value => Math.min(32, value * 2))} aria-label={t('Zoom in')}>+</button>
      <button type="button" className={button} onClick={() => setZoom(1)}>{t('Fit')}</button>
      <span className="ml-auto text-xs text-fd-muted-foreground">{new Date(domain.start).toLocaleTimeString([], { hour12: false })} · {timeLabel(domain.duration)}</span>
    </div>
    {(page.hasMore || loading > 0 || errors.length > 0) && <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-fd-border px-4 py-2 text-xs text-fd-muted-foreground">
      {page.hasMore && <span>{t('Earlier events are not loaded.')}</span>}{loading > 0 && <span>{t('Loading subagent timing…')} ({loading})</span>}
      {errors.length > 0 && <><span className="text-fd-danger" title={errors.map(([, child]) => child.error).join('\n')}>{t('Some subagent timing could not be loaded.')} ({errors.length})</span><button className={button} onClick={() => setRetry(value => value + 1)}>{t('Retry')}</button></>}
    </div>}
    <div className="fd-scroll min-h-0 flex-1 overflow-auto">
      <div role="table" aria-label={t('Execution waterfall')} style={{ minWidth: gridWidth }}>
        <div role="row" className="sticky top-0 z-30 grid h-11 border-b border-fd-border bg-fd-card" style={grid}>
          <div role="columnheader" className="sticky left-0 z-40 flex items-center border-r border-fd-border bg-fd-card px-4 text-xs font-medium">{t('Name / duration')}</div>
          <div role="columnheader" className="relative mx-4 font-mono text-[10px] text-fd-muted-foreground">{ticks.map(fraction => <span key={fraction} className="absolute bottom-2 top-0 border-l border-fd-border" style={{ left: `${fraction * 100}%` }}><span className={`absolute bottom-0 whitespace-nowrap ${fraction === 1 ? '-translate-x-full pr-1' : 'pl-1'}`}>{timeLabel(domain.duration * fraction)}</span></span>)}</div>
        </div>
        {rows.map(({ span, depth }) => {
          const end = timingEnd(span, now)
          const left = (span.start - domain.start) / domain.duration * 100
          const width = Math.max(0, (end - span.start) / domain.duration * 100)
          const title = `${span.label}\n${t(span.status)}\n${new Date(span.start).toLocaleTimeString([], { hour12: false })}\n${duration(span)}${span.partial ? `\n${t('Partial history')}` : ''}`
          return <div key={span.id} role="row" className={`grid min-h-11 border-b border-fd-border/60 ${selected === span.id ? 'bg-fd-primary/5' : 'hover:bg-fd-secondary/50'}`} style={grid}>
            <div role="cell" className="sticky left-0 z-20 flex min-w-0 items-center gap-1 border-r border-fd-border bg-fd-card pr-3" style={{ paddingLeft: 8 + Math.min(depth, 3) * 14 }}>
              {span.children.length > 0 ? <button type="button" aria-label={`${t(expanded.has(span.id) ? 'Collapse' : 'Expand')} ${span.label}`} aria-expanded={expanded.has(span.id)} className="h-7 w-5 shrink-0 rounded text-xs text-fd-muted-foreground hover:bg-fd-secondary" onClick={() => toggle(span.id)}>{expanded.has(span.id) ? '▾' : '▸'}</button> : <span className="w-5 shrink-0" />}
              <button type="button" title={title} className="min-w-0 flex-1 py-1.5 text-left" onClick={() => setSelected(current => current === span.id ? null : span.id)}><span className="block truncate text-xs font-medium">{span.label}</span><span className="flex gap-2 text-[10px] text-fd-muted-foreground"><span>{t(span.kind)}</span><span>{duration(span)}</span>{span.partial && <span>{t('Partial history')}</span>}</span></button>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color(span)}`} title={t(span.status)} />
            </div>
            <div role="cell" className="relative mx-4 min-h-11">{ticks.map(fraction => <span key={fraction} className="pointer-events-none absolute inset-y-0 border-l border-fd-border/60" style={{ left: `${fraction * 100}%` }} />)}
              <button type="button" aria-label={`${span.label} ${duration(span)} ${t(span.status)}`} title={title} onClick={() => setSelected(current => current === span.id ? null : span.id)} className={`absolute top-3 h-5 min-w-1 rounded-sm border border-black/10 text-left outline-offset-2 focus-visible:outline-2 focus-visible:outline-fd-primary ${color(span)} ${span.status === 'running' ? 'animate-pulse motion-reduce:animate-none' : ''} ${span.status === 'unknown' ? 'border-dashed opacity-60' : 'opacity-85'}`} style={{ left: `${left}%`, width: `${width}%` }} />
            </div>
          </div>
        })}
        {rows.length === 0 && <p className="p-6 text-sm text-fd-muted-foreground">{t('No activity matches this filter.')}</p>}
      </div>
    </div>
    {selectedSpan && <section aria-label={t('Timing details')} className="fd-scroll max-h-[40%] shrink-0 overflow-auto border-t border-fd-border bg-fd-card p-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{selectedSpan.label}</h3><button className={button} onClick={() => setSelected(null)}>{t('Close')}</button></div><p className="mt-1 text-xs text-fd-muted-foreground">{t(selectedSpan.status)} · +{timeLabel(selectedSpan.start - domain.start)} · {duration(selectedSpan)}{selectedSpan.end === null && selectedSpan.status !== 'running' ? ` · ${t('End not recorded')}` : ''}</p><pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs text-fd-muted-foreground">{selectedSpan.detail}</pre></section>}
  </div>
}
