import type { SessionListEntry } from '../api/gateway.ts'
import { RunDetailLoader } from './RunsPage.tsx'
import { useCallback, useEffect, useState } from 'react'
import { superagentAction, superagentState, superagentTicket, superagentTickets } from '@lai/dsh-adapter/superagent'
import type { SuperagentState, SuperagentTicket, TicketPage } from '@lai/dsh-adapter/superagent'
import { useInterval } from '../hooks/useInterval.ts'
import { useLanguage } from '../i18n.tsx'
const button = 'rounded-md border border-fd-border bg-fd-secondary px-3 py-1.5 text-sm disabled:opacity-40'

export function RouterPage({ entries, onOpenRun, onConfigure }: { entries: SessionListEntry[]; onOpenRun: (id: string) => void; onConfigure: () => void }) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<'run' | 'tasks'>('run')
  const [state, setState] = useState<SuperagentState | null>(null)
  const [page, setPage] = useState<TicketPage | null>(null)
  const [filter, setFilter] = useState('open')
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<SuperagentTicket | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      const [status, tasks] = await Promise.all([superagentState(), superagentTickets(filter, offset)])
      setState(status); setPage(tasks)
      if (selected) setDetail(await superagentTicket(selected))
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [filter, offset, selected])
  useEffect(() => { void load() }, [load])
  useInterval(() => { void load() }, 5000)
  const action = async (path: string, body?: unknown) => { setBusy(true); try { await superagentAction(path, body); await load() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) } }
  return <div className="space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-lg font-semibold">Router</h1><p className="mt-1 text-sm text-fd-muted-foreground">{t('Monitor / Router → Worker → five LAI subagents')}</p></div><div className="flex gap-2"><button className={button} onClick={onConfigure}>{t('Configure Superagent')}</button><button className={button} onClick={() => { void load() }}>{t('Refresh')}</button></div></header>
    {error && <p role="alert" className="rounded-lg border border-fd-danger/30 p-3 text-sm text-fd-danger">{error}</p>}
    {state && <div className="flex flex-wrap items-center gap-4 rounded-lg bg-fd-secondary p-4 text-sm"><span>{state.setup.accounts?.repository ?? t('Not configured')}</span><span>{state.load.running} {t('Running')} · {state.load.queued} {t('Queued')}</span><button className={button} disabled={busy || !state.setup.accounts} onClick={() => onOpenRun(state.masterId)}>{t('Open Monitor / Router')}</button><button className={button} disabled={busy} onClick={() => { void action('executor/pause', { paused: !state.paused }) }}>{t(state.paused ? 'Resume processing' : 'Pause processing')}</button>{state.setup.problem && <span className="text-fd-warning">{state.setup.problem.detail ?? state.setup.problem.code}</span>}</div>}
    <div className="flex gap-2 border-b border-fd-border pb-3">{(['run', 'tasks'] as const).map(value => <button key={value} className={`${button} ${tab === value ? 'bg-fd-primary/10 text-fd-primary' : ''}`} onClick={() => setTab(value)}>{t(value === 'run' ? 'Router run' : 'Tasks')}</button>)}</div>
    {tab === 'run' && <section aria-label={t('Router run')} className="flex h-[65vh] min-h-[24rem] flex-col overflow-hidden rounded-xl border border-fd-border">{state && entries.some(entry => entry.sessionId === state.masterId) ? <RunDetailLoader key={state.masterId} sessionId={state.masterId} running={entries.find(entry => entry.sessionId === state.masterId)?.running ?? false} entries={entries} /> : <p className="p-6 text-sm text-fd-muted-foreground">{t('No Router run yet. Configure a source in Plugin → Superagent.')}</p>}</section>}
    {tab === 'tasks' && <>
    <div className="flex flex-wrap gap-2">{['open', 'working', 'person', 'idle', 'ended'].map(value => <button key={value} className={`${button} ${filter === value ? 'text-fd-primary' : ''}`} onClick={() => { setFilter(value); setOffset(0); setSelected(null); setDetail(null) }}>{t(value)}</button>)}</div>
    <div className="grid gap-5 xl:grid-cols-[minmax(16rem,1fr)_minmax(20rem,1.5fr)]"><section className="space-y-2">{page?.items.map(task => <button key={task.id} className={`w-full rounded-lg border p-4 text-left ${selected === task.id ? 'border-fd-primary bg-fd-primary/5' : 'border-fd-border hover:bg-fd-secondary'}`} onClick={() => { setSelected(task.id); setDetail(null) }}><div className="flex items-start justify-between gap-3"><span className="text-sm font-medium">{task.title}</span><span className="text-xs text-fd-muted-foreground">{task.action ?? task.stage}</span></div><div className="mt-2 text-xs text-fd-muted-foreground">{new Date(task.updatedAt).toLocaleString()}</div></button>)}{page && !page.items.length && <p className="py-8 text-center text-sm text-fd-muted-foreground">{t('No tasks yet. Configure a source in Plugin → Superagent.')}</p>}<div className="flex gap-2"><button className={button} disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 30))}>{t('Previous')}</button><button className={button} disabled={page?.next_offset == null} onClick={() => setOffset(page?.next_offset ?? offset)}>{t('Next')}</button></div></section>
    <section className="min-w-0 rounded-xl border border-fd-border p-5">{detail ? <div className="space-y-4"><h2 className="font-semibold">{detail.title}</h2><p className="text-sm">{detail.stage} {detail.action}</p><div className="flex flex-wrap gap-2">{detail.sessionId && <button className={button} onClick={() => onOpenRun(detail.sessionId!)}>{t('Open Worker run')}</button>}{detail.actions?.retry && <button className={button} disabled={busy} onClick={() => { void action(`tickets/${detail.id}/retry`) }}>{t('Retry')}</button>}{detail.actions?.stop && <button className={button} disabled={busy} onClick={() => { void action(`tickets/${detail.id}/stop`) }}>{t('Stop')}</button>}</div><p className="break-all font-mono text-xs text-fd-muted-foreground">{detail.directory}</p><p className="whitespace-pre-wrap break-words text-sm">{detail.summary}</p>{detail.threads?.map(thread => <div key={thread.key} className="text-sm">{thread.url ? <a className="text-fd-primary" href={thread.url} target="_blank" rel="noreferrer">{thread.title} ↗</a> : thread.title}</div>)}{Array.isArray(detail.assignments) && detail.assignments.map(assignment => <div key={assignment.id} className="rounded-lg bg-fd-secondary p-3 text-sm"><span className="text-xs text-fd-muted-foreground">{assignment.report?.state}</span><p className="mt-1 whitespace-pre-wrap break-words">{assignment.report?.summary}</p></div>)}</div> : <p className="text-sm text-fd-muted-foreground">{t('Select a task to view its Worker and results.')}</p>}</section></div>
    </>}
  </div>
}
