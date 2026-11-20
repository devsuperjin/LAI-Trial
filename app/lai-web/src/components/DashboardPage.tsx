import { HelpTip } from './HelpTip.tsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLanguage } from '../i18n.tsx'
import { useInterval } from '../hooks/useInterval.ts'
import { sessionTurnCount } from '../api/gateway.ts'
import type { SessionListEntry } from '../api/gateway.ts'
import { superagentOverview, superagentState, superagentTickets, superagentSources } from '@lai/dsh-adapter/superagent'
import type { SuperagentOverview, SuperagentState, SuperagentTicket, TicketPage, SuperagentSourceStatus } from '@lai/dsh-adapter/superagent'
import { deriveDashboard, formatDuration, formatTokens } from '../model/dashboard.ts'

interface Snapshot { sources: SuperagentSourceStatus[] | null; state: SuperagentState; overview: SuperagentOverview; open: TicketPage; ended: TicketPage; at: number }
const PROBLEM_LABELS: Record<string, string> = { setup: 'Source setup required', 'no-source': 'No input source enabled', 'no-allowed': 'No allowed senders', 'source-error': 'Source connection issue', 'executor-paused': 'Processing is paused', 'runtime-error': 'Service issue', 'eval-overdue': 'Evaluation overdue', 'eval-unavailable': 'Evaluation unavailable', outgoing: 'Reply delivery failed' }
function taskStatus(task: SuperagentTicket): string {
  if (task.stage === 'person') return ({ review: 'Awaiting review', answer: 'Awaiting response', blocked: 'Blocked', failed: 'Failed', delivery: 'Delivery failed' } as Record<string, string>)[task.action ?? ''] ?? 'Needs attention'
  return task.action === 'queued' ? 'Queued' : ({ working: 'Running', idle: 'Idle', ended: 'Ended' } as Record<string, string>)[task.stage] ?? task.stage
}
function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const { t } = useLanguage()
  return <section className="min-w-0 rounded-xl border border-fd-border bg-fd-card p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{t(title)}</h2>{action}</div>{children}</section>
}
function Metric({ label, value, note, warning }: { label: string; value: string; note: string; warning?: boolean }) {
  const { t } = useLanguage()
  return <div className="rounded-xl border border-fd-border bg-fd-card p-4"><p className="text-xs text-fd-muted-foreground">{t(label)}</p><p className={`mt-2 text-2xl font-semibold tabular-nums ${warning ? 'text-fd-warning' : ''}`}>{value}</p><p className="mt-2 text-xs text-fd-muted-foreground">{note}</p></div>
}
export function DashboardPage({ entries, onOpenRun, onRouter, onRuns }: { entries: SessionListEntry[]; onOpenRun: (id: string) => void; onRouter: () => void; onRuns: () => void }) {
  const { t, language } = useLanguage()
  const model = useMemo(() => deriveDashboard(entries), [entries])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setBusy(true)
    try {
      const [state, overview, open, ended, sources] = await Promise.all([superagentState(), superagentOverview(), superagentTickets(), superagentTickets('ended'), superagentSources().catch(() => null)])
      setSnapshot({ state, overview, open, ended, sources, at: Date.now() }); setError(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useInterval(() => { void load() }, 10000)
  const sources = snapshot?.sources
  const sourceLabel = (source: SuperagentSourceStatus) => source.title[language]
  const sourceState = (source: SuperagentSourceStatus) => t(({ ready: 'Ready', paused: 'Paused', error: 'Error', off: 'Off', starting: 'Starting', setup: 'Setup required', missing: 'Unavailable' })[source.state])
  const sourceDetail = (part: SuperagentSourceStatus['health'][number]) => part.code === 'jenkinsUrlUnset' ? t('Waiting for a Jenkins URL to be configured') : part.code === 'sourceOff' ? t('Off') : part.code === 'feishuCliUnset' ? t('Feishu bot CLI is not configured') : part.detail
  const state = snapshot?.state
  const routerEntry = entries.find(entry => entry.sessionId === state?.masterId)
  const [routerTurns, setRouterTurns] = useState<{ id: string; count: number } | null>(null)
  useEffect(() => {
    const id = state?.masterId
    if (!id) return
    let active = true
    void sessionTurnCount(id).then(count => { if (active) setRouterTurns({ id, count }) }).catch(() => { if (active) setRouterTurns(null) })
    return () => { active = false }
  }, [state?.masterId, routerEntry?.updatedAt])
  const routerTokens = routerEntry?.projections?.values.tokenUsage
  const routerTokenTotal = routerTokens ? Object.values(routerTokens).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0) : null
  const overview = snapshot?.overview
  const recent = snapshot ? [...snapshot.open.items, ...snapshot.ended.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6) : []
  const routerReady = state?.health.runtime?.state === 'ready'
  const maxTokens = Math.max(1, ...model.modelBreakdown.map(item => item.tokens))
  const count = (value: number | undefined) => value === undefined ? '—' : String(value)
  const openTask = (task: SuperagentTicket) => { if (task.sessionId && model.runs.some(run => run.sessionId === task.sessionId)) onOpenRun(task.sessionId); else onRouter() }
  return <div className="mx-auto w-full max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h1 className="text-xl font-semibold">{t('Dashboard')}</h1><HelpTip text={t('Monitor intake, Worker execution and specialist activity.')} /></div></div><div className="flex flex-wrap items-center gap-2">{snapshot && <span className="mr-2 text-xs text-fd-muted-foreground">{t('Updated')} {new Date(snapshot.at).toLocaleTimeString([], { hour12: false })}</span>}<button type="button" aria-label={t(busy ? 'Refreshing…' : 'Refresh')} title={t('Refresh')} className="flex h-8 w-8 items-center justify-center rounded-lg text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground disabled:opacity-40" disabled={busy} onClick={() => { void load() }}><svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={busy ? 'animate-spin motion-reduce:animate-none' : ''}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17" /></svg></button></div></header>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-fd-border bg-fd-card px-4 py-3 text-xs"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${state?.paused ? 'bg-fd-warning' : routerReady ? 'bg-fd-success' : 'bg-fd-muted-foreground'}`} />{t(state ? state.paused ? 'Paused' : routerReady ? 'Ready' : 'Setup required' : 'Connecting…')}</span>{sources ? sources.filter(source => source.installed && source.enabled).map(source => <span key={source.id} className="flex min-w-0 flex-wrap items-center gap-2"><span className="font-medium">{sourceLabel(source)}</span>{source.target && <span className="max-w-sm truncate font-mono text-fd-muted-foreground" title={source.target}>{source.target}</span>}<span className={source.state === 'error' ? 'text-fd-danger' : source.state === 'paused' || source.state === 'setup' ? 'text-fd-warning' : 'text-fd-muted-foreground'}>{sourceState(source)}</span></span>) : <span className="text-fd-muted-foreground">{t('Loading sources…')}</span>}<span className="ml-auto"><HelpTip text={`${t('Task metrics: Superagent')} · ${t('Usage: recorded runs')}`} /></span></div>
    {error && <p role="alert" className="rounded-lg border border-fd-warning/30 bg-fd-warning/5 p-3 text-sm text-fd-warning">{t(snapshot ? 'Refresh failed. Showing the last successful snapshot.' : 'Task metrics unavailable. Run activity remains available.')} <span className="text-xs">{error}</span></p>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <Metric label="Received · 24h" value={count(overview?.flow.received)} note={`${count(overview?.flow.filtered)} ${t('filtered')}`} />
      <Metric label="Accepted · 24h" value={count(overview?.flow.accepted)} note={`${count(overview?.flow.evaluating)} ${t('evaluating now')}`} />
      <Metric label="Open tasks" value={count(snapshot?.open.total)} note={`${count(snapshot?.ended.total)} ${t('ended tasks')}`} />
      <Metric label="Workers" value={state ? `${state.load.running} / ${state.load.maxWorkers}` : '—'} note={`${count(state?.load.queued)} ${t('queued')}`} />
      <Metric label="Needs attention" value={count(overview?.person.length)} note={t('Review, questions or execution issues')} warning={!!overview?.person.length} />
    </div>
    <Panel title="Execution pipeline" action={<HelpTip text={`${t('Five native specialists · strictly sequential per Worker')} ${t('Stage totals include recorded, non-archived specialist runs. Durations use recorded active time.')}`} />}>
      <div className="grid gap-3 xl:grid-cols-[minmax(12rem,1fr)_auto_minmax(0,4fr)]">
        <section aria-label="Router" className="rounded-lg bg-fd-secondary/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-medium">Router<HelpTip text={t('Receive events, evaluate policy and dispatch tasks.')} /></h3><span className={`text-xs ${state?.paused ? 'text-fd-warning' : routerReady ? 'text-fd-success' : 'text-fd-muted-foreground'}`}>{t(state?.paused ? 'Paused' : routerReady ? 'Ready' : 'Unavailable')}</span></div>
          <button disabled={!state?.setup.accounts} className="mt-3 text-xs text-fd-primary disabled:opacity-40" onClick={onRouter}>{t('Open Router')} ↗</button>
          <dl className="mt-5 space-y-3 border-t border-fd-border pt-4 text-xs">
            <div className="flex items-center justify-between gap-3"><dt className="text-fd-muted-foreground">{t('Turns')}</dt><dd className="font-medium tabular-nums">{routerTurns?.id === state?.masterId ? routerTurns?.count : '—'}</dd></div>
            <div className="flex items-center justify-between gap-3"><dt className="text-fd-muted-foreground">Tokens</dt><dd className="font-medium tabular-nums" title={routerTokenTotal?.toLocaleString()}>{routerTokenTotal === null ? '—' : `${formatTokens(routerTokenTotal)} tok`}</dd></div>
          </dl>
        </section>
        <span aria-hidden className="self-center justify-self-center text-fd-muted-foreground"><span className="hidden xl:inline">→</span><span className="xl:hidden">↓</span></span>
        <section aria-label="Worker" className="min-w-0 rounded-lg bg-fd-secondary/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-medium">Worker<HelpTip text={t('One task workspace; delegate to five LAI specialists.')} /></h3><div className="flex items-center gap-4"><span className="text-xs text-fd-muted-foreground">{count(state?.load.running)} {t('active')}</span><button className="text-xs text-fd-primary" onClick={onRuns}>{t('Open Runs')} ↗</button></div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{model.stageStats.map((stage, index) => <div key={stage.id} className="relative min-w-0 rounded-lg border border-fd-border bg-fd-card p-3"><div className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ color: stage.hue, background: `color-mix(in srgb, ${stage.hue} 12%, transparent)` }}>{index + 1}</span><h3 className="text-sm font-medium">{t(stage.label)}</h3>{stage.active > 0 && <span className="ml-auto h-2 w-2 rounded-full bg-fd-warning" title={t('Running')} />}</div><p className="mt-3 text-xs text-fd-muted-foreground">{stage.runs} {t('recorded agents')} · {stage.active} {t('active')}</p><div className="mt-2 flex justify-between text-xs"><span>{formatTokens(stage.tokens)} tok</span><span className="text-fd-muted-foreground">{stage.avgMs === null ? '—' : formatDuration(stage.avgMs)}</span></div><p className="mt-2 text-[10px] text-fd-muted-foreground">{stage.completed} {t('completed')} · {stage.failed} {t('failed')}</p></div>)}</div>
        </section>
      </div>
    </Panel>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel title="Recent tasks" action={<button className="text-xs text-fd-primary" onClick={onRouter}>{t('Open Router')} ↗</button>}><div className="divide-y divide-fd-border">{recent.map(task => <button key={task.id} onClick={() => openTask(task)} className="flex w-full items-start justify-between gap-3 rounded-md py-3 text-left hover:bg-fd-secondary/40"><span className="min-w-0"><span className="block truncate text-sm font-medium">{task.title}</span><span className="mt-1 block text-xs text-fd-muted-foreground">{new Date(task.updatedAt).toLocaleString()}</span></span><span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${task.stage === 'person' ? 'bg-fd-warning/10 text-fd-warning' : 'bg-fd-secondary text-fd-muted-foreground'}`}>{t(taskStatus(task))}</span></button>)}{recent.length === 0 && <p className="py-8 text-center text-sm text-fd-muted-foreground">{t(snapshot ? 'No tasks yet. Configure a source and policy to get started.' : 'Waiting for task metrics…')}</p>}</div></Panel>
      <Panel title="Attention & service health"><div className="space-y-3">{overview?.problems.filter(problem => !(problem.kind === 'source-error' && sources?.some(source => source.id === problem.source?.id))).map((problem, index) => <div key={`${problem.kind}-${index}`} className="rounded-lg border border-fd-warning/25 bg-fd-warning/5 p-3"><p className="text-xs font-medium text-fd-warning">{t(PROBLEM_LABELS[problem.kind] ?? 'Service issue')}</p>{(problem.detail || problem.source?.health.detail || problem.outgoing?.error) && <p className="mt-1 break-words text-xs text-fd-muted-foreground">{problem.detail ?? problem.source?.health.detail ?? problem.outgoing?.error}</p>}</div>)}{overview && overview.problems.length === 0 && !sources?.some(source => source.enabled && source.state !== 'ready') && <p className="text-sm text-fd-success">{t('No service issues reported.')}</p>}{!snapshot && <p className="text-sm text-fd-muted-foreground">{t('Waiting for task metrics…')}</p>}{sources?.filter(source => source.installed).map(source => <div key={source.id} className="border-t border-fd-border pt-3 text-xs"><div className="flex items-center justify-between gap-3"><span className="font-medium">{sourceLabel(source)}</span><span className={source.state === 'error' ? 'text-fd-danger' : source.state === 'paused' || source.state === 'setup' ? 'text-fd-warning' : 'text-fd-muted-foreground'}>{sourceState(source)}</span></div>{source.problem?.detail && <p className="mt-1 break-words text-fd-warning">{source.problem.detail}</p>}{source.health.map(part => <p key={part.name} className="mt-1 break-words text-fd-muted-foreground">{sourceDetail(part)}</p>)}</div>)}{overview?.person.slice(0, 3).map(task => <button key={task.id} className="block w-full rounded-lg bg-fd-secondary/50 p-3 text-left text-xs hover:bg-fd-secondary" onClick={() => openTask(task)}><span className="font-medium">{task.title}</span><span className="mt-1 block text-fd-warning">{t(taskStatus(task))}</span></button>)}</div></Panel>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Panel title="Recorded model usage" action={<HelpTip text={t('Usage is grouped by each run’s actual model route; token counts are not a cost estimate.')} />}><p className="mb-4 text-2xl font-semibold tabular-nums">{formatTokens(model.totals.tokens)} <span className="text-xs font-normal text-fd-muted-foreground">tok · {formatTokens(model.totals.outputTokens)} {t('output')}</span></p><div className="space-y-4">{model.modelBreakdown.map(row => <div key={row.model}><div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-mono" title={row.model}>{t(row.model)}</span><span className="shrink-0 text-fd-muted-foreground">{formatTokens(row.tokens)} tok</span></div><div className="h-1.5 overflow-hidden rounded-full bg-fd-secondary"><div className="h-full rounded-full" style={{ width: `${row.tokens / maxTokens * 100}%`, background: row.hue }} /></div></div>)}</div>{model.modelBreakdown.length === 0 && <p className="text-sm text-fd-muted-foreground">{t('No recorded model usage.')}</p>}</Panel>
      <Panel title="Recent run activity" action={<span className="text-xs text-fd-muted-foreground">{model.totals.runs} {t('root runs')} · {model.totals.subagents} {t('subagents')}</span>}><div className="divide-y divide-fd-border">{model.runs.slice(0, 6).map(run => <button key={run.sessionId} className="flex w-full items-center gap-3 rounded-md py-3 text-left hover:bg-fd-secondary/40" onClick={() => onOpenRun(run.sessionId)}><span className={`h-2 w-2 shrink-0 rounded-full ${run.status === 'running' ? 'bg-fd-warning' : 'bg-fd-muted-foreground'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{run.title}</span><span className="mt-1 block text-[11px] text-fd-muted-foreground">{t(run.role)} · {run.childCount} {t('subagents')}</span></span><span className="text-right text-xs"><span>{formatTokens(run.tokens)} tok</span><span className="mt-1 block text-[10px] text-fd-muted-foreground">{t(run.status === 'running' ? 'Running' : 'Idle')}</span></span></button>)}{model.runs.length === 0 && <p className="py-6 text-sm text-fd-muted-foreground">{t('No run activity yet.')}</p>}</div></Panel>
    </div>
  </div>
}
