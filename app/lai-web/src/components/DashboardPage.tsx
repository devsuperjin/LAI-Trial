import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLanguage } from '../i18n.tsx'
import { useInterval } from '../hooks/useInterval.ts'
import type { SessionListEntry } from '../api/gateway.ts'
import { superagentOverview, superagentState, superagentTickets } from '@lai/dsh-adapter/superagent'
import type { SuperagentOverview, SuperagentState, SuperagentTicket, TicketPage } from '@lai/dsh-adapter/superagent'
import { deriveDashboard, formatDuration, formatTokens } from '../model/dashboard.ts'

interface Snapshot { state: SuperagentState; overview: SuperagentOverview; open: TicketPage; ended: TicketPage; at: number }
const button = 'rounded-lg border border-fd-border bg-fd-card px-3 py-2 text-xs hover:bg-fd-secondary disabled:opacity-40'
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
export function DashboardPage({ entries, onOpenRun, onRouter, onConfigure }: { entries: SessionListEntry[]; onOpenRun: (id: string) => void; onRouter: () => void; onConfigure: () => void }) {
  const { t } = useLanguage()
  const model = useMemo(() => deriveDashboard(entries), [entries])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setBusy(true)
    try {
      const [state, overview, open, ended] = await Promise.all([superagentState(), superagentOverview(), superagentTickets(), superagentTickets('ended')])
      setSnapshot({ state, overview, open, ended, at: Date.now() }); setError(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useInterval(() => { void load() }, 10000)
  const state = snapshot?.state
  const overview = snapshot?.overview
  const recent = snapshot ? [...snapshot.open.items, ...snapshot.ended.items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6) : []
  const routerReady = state?.health.runtime?.state === 'ready'
  const maxTokens = Math.max(1, ...model.modelBreakdown.map(item => item.tokens))
  const count = (value: number | undefined) => value === undefined ? '—' : String(value)
  const openTask = (task: SuperagentTicket) => { if (task.sessionId && model.runs.some(run => run.sessionId === task.sessionId)) onOpenRun(task.sessionId); else onRouter() }
  return <div className="mx-auto w-full max-w-7xl space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-semibold">{t('Dashboard')}</h1><p className="mt-1 text-sm text-fd-muted-foreground">{t('Monitor intake, Worker execution and specialist activity.')}</p></div><div className="flex flex-wrap items-center gap-2">{snapshot && <span className="mr-2 text-xs text-fd-muted-foreground">{t('Updated')} {new Date(snapshot.at).toLocaleTimeString([], { hour12: false })}</span>}<button className={button} onClick={onConfigure}>Superagent ↗</button><button className={button} disabled={busy} onClick={() => { void load() }}>{t(busy ? 'Refreshing…' : 'Refresh')}</button></div></header>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-fd-border bg-fd-card px-4 py-3 text-xs"><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${state?.paused ? 'bg-fd-warning' : routerReady ? 'bg-fd-success' : 'bg-fd-muted-foreground'}`} />{t(state ? state.paused ? 'Paused' : routerReady ? 'Ready' : 'Setup required' : 'Connecting…')}</span><span className="font-mono">{state?.setup.accounts?.repository ?? t('No repository configured')}</span>{state?.setup.accounts?.agent && <span className="text-fd-muted-foreground">@{state.setup.accounts.agent}</span>}<span className="ml-auto text-fd-muted-foreground">{t('Task metrics: Superagent')} · {t('Usage: recorded runs')}</span></div>
    {error && <p role="alert" className="rounded-lg border border-fd-warning/30 bg-fd-warning/5 p-3 text-sm text-fd-warning">{t(snapshot ? 'Refresh failed. Showing the last successful snapshot.' : 'Task metrics unavailable. Run activity remains available.')} <span className="text-xs">{error}</span></p>}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <Metric label="Received · 24h" value={count(overview?.flow.received)} note={`${count(overview?.flow.filtered)} ${t('filtered')}`} />
      <Metric label="Accepted · 24h" value={count(overview?.flow.accepted)} note={`${count(overview?.flow.evaluating)} ${t('evaluating now')}`} />
      <Metric label="Open tasks" value={count(snapshot?.open.total)} note={`${count(snapshot?.ended.total)} ${t('ended tasks')}`} />
      <Metric label="Workers" value={state ? `${state.load.running} / ${state.load.maxWorkers}` : '—'} note={`${count(state?.load.queued)} ${t('queued')}`} />
      <Metric label="Needs attention" value={count(overview?.person.length)} note={t('Review, questions or execution issues')} warning={!!overview?.person.length} />
    </div>
    <Panel title="Execution pipeline" action={<span className="text-xs text-fd-muted-foreground">{t('Five native specialists · strictly sequential per Worker')}</span>}>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto_1fr]"><div className="rounded-lg bg-fd-secondary/50 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Monitor / Router</span><span className={`text-xs ${routerReady ? 'text-fd-success' : 'text-fd-muted-foreground'}`}>{t(state?.paused ? 'Paused' : routerReady ? 'Ready' : 'Unavailable')}</span></div><p className="mt-1 text-xs text-fd-muted-foreground">{t('Receive events, evaluate policy and dispatch tasks.')}</p><button disabled={!state?.setup.accounts} className="mt-3 text-xs text-fd-primary disabled:opacity-40" onClick={() => onRouter()}>{t('Open Router')} ↗</button></div><span aria-hidden className="hidden self-center text-fd-muted-foreground md:block">→</span><div className="rounded-lg bg-fd-secondary/50 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Worker</span><span className="text-xs text-fd-muted-foreground">{count(state?.load.running)} {t('active')}</span></div><p className="mt-1 text-xs text-fd-muted-foreground">{t('One task workspace; delegate to five LAI specialists.')}</p><button className="mt-3 text-xs text-fd-primary" onClick={onRouter}>{t('Open Router')} ↗</button></div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{model.stageStats.map((stage, index) => <div key={stage.id} className="relative rounded-lg border border-fd-border p-3"><div className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold" style={{ color: stage.hue, background: `color-mix(in srgb, ${stage.hue} 12%, transparent)` }}>{index + 1}</span><h3 className="text-sm font-medium">{t(stage.label)}</h3>{stage.active > 0 && <span className="ml-auto h-2 w-2 rounded-full bg-fd-warning" title={t('Running')} />}</div><p className="mt-3 text-xs text-fd-muted-foreground">{stage.runs} {t('recorded agents')} · {stage.active} {t('active')}</p><div className="mt-2 flex justify-between text-xs"><span>{formatTokens(stage.tokens)} tok</span><span className="text-fd-muted-foreground">{stage.avgMs === null ? '—' : formatDuration(stage.avgMs)}</span></div><p className="mt-2 text-[10px] text-fd-muted-foreground">{stage.completed} {t('completed')} · {stage.failed} {t('failed')}</p></div>)}</div>
      <p className="mt-3 text-[11px] text-fd-muted-foreground">{t('Stage totals include recorded, non-archived specialist runs. Durations use recorded active time.')}</p>
    </Panel>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel title="Recent tasks" action={<button className="text-xs text-fd-primary" onClick={onRouter}>{t('Open Router')} ↗</button>}><div className="divide-y divide-fd-border">{recent.map(task => <button key={task.id} onClick={() => openTask(task)} className="flex w-full items-start justify-between gap-3 rounded-md py-3 text-left hover:bg-fd-secondary/40"><span className="min-w-0"><span className="block truncate text-sm font-medium">{task.title}</span><span className="mt-1 block text-xs text-fd-muted-foreground">{new Date(task.updatedAt).toLocaleString()}</span></span><span className={`shrink-0 rounded-md px-2 py-1 text-[10px] ${task.stage === 'person' ? 'bg-fd-warning/10 text-fd-warning' : 'bg-fd-secondary text-fd-muted-foreground'}`}>{t(taskStatus(task))}</span></button>)}{recent.length === 0 && <p className="py-8 text-center text-sm text-fd-muted-foreground">{t(snapshot ? 'No tasks yet. Configure a source and policy to get started.' : 'Waiting for task metrics…')}</p>}</div></Panel>
      <Panel title="Attention & service health"><div className="space-y-3">{overview?.problems.map((problem, index) => <div key={`${problem.kind}-${index}`} className="rounded-lg border border-fd-warning/25 bg-fd-warning/5 p-3"><p className="text-xs font-medium text-fd-warning">{t(PROBLEM_LABELS[problem.kind] ?? 'Service issue')}</p>{(problem.detail || problem.source?.health.detail || problem.outgoing?.error) && <p className="mt-1 break-words text-xs text-fd-muted-foreground">{problem.detail ?? problem.source?.health.detail ?? problem.outgoing?.error}</p>}</div>)}{overview && overview.problems.length === 0 && <p className="text-sm text-fd-success">{t('No service issues reported.')}</p>}{!snapshot && <p className="text-sm text-fd-muted-foreground">{t('Waiting for task metrics…')}</p>}{state?.health.github && <div className="border-t border-fd-border pt-3 text-xs"><span className="font-medium">GitHub · {t(state.health.github.state)}</span><p className="mt-1 text-fd-muted-foreground">{state.health.github.detail}</p></div>}{overview?.person.slice(0, 3).map(task => <button key={task.id} className="block w-full rounded-lg bg-fd-secondary/50 p-3 text-left text-xs hover:bg-fd-secondary" onClick={() => openTask(task)}><span className="font-medium">{task.title}</span><span className="mt-1 block text-fd-warning">{t(taskStatus(task))}</span></button>)}</div></Panel>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <Panel title="Recorded model usage"><p className="mb-4 text-2xl font-semibold tabular-nums">{formatTokens(model.totals.tokens)} <span className="text-xs font-normal text-fd-muted-foreground">tok · {formatTokens(model.totals.outputTokens)} {t('output')}</span></p><div className="space-y-4">{model.modelBreakdown.map(row => <div key={row.model}><div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-mono" title={row.model}>{t(row.model)}</span><span className="shrink-0 text-fd-muted-foreground">{formatTokens(row.tokens)} tok</span></div><div className="h-1.5 overflow-hidden rounded-full bg-fd-secondary"><div className="h-full rounded-full" style={{ width: `${row.tokens / maxTokens * 100}%`, background: row.hue }} /></div></div>)}</div>{model.modelBreakdown.length === 0 && <p className="text-sm text-fd-muted-foreground">{t('No recorded model usage.')}</p>}<p className="mt-4 text-[11px] text-fd-muted-foreground">{t('Usage is grouped by each run’s actual model route; token counts are not a cost estimate.')}</p></Panel>
      <Panel title="Recent run activity" action={<span className="text-xs text-fd-muted-foreground">{model.totals.runs} {t('root runs')} · {model.totals.subagents} {t('subagents')}</span>}><div className="divide-y divide-fd-border">{model.runs.slice(0, 6).map(run => <button key={run.sessionId} className="flex w-full items-center gap-3 rounded-md py-3 text-left hover:bg-fd-secondary/40" onClick={() => onOpenRun(run.sessionId)}><span className={`h-2 w-2 shrink-0 rounded-full ${run.status === 'running' ? 'bg-fd-warning' : 'bg-fd-muted-foreground'}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm">{run.title}</span><span className="mt-1 block text-[11px] text-fd-muted-foreground">{t(run.role)} · {run.childCount} {t('subagents')}</span></span><span className="text-right text-xs"><span>{formatTokens(run.tokens)} tok</span><span className="mt-1 block text-[10px] text-fd-muted-foreground">{t(run.status === 'running' ? 'Running' : 'Idle')}</span></span></button>)}{model.runs.length === 0 && <p className="py-6 text-sm text-fd-muted-foreground">{t('No run activity yet.')}</p>}</div></Panel>
    </div>
  </div>
}
