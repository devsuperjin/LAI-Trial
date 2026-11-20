import { HelpTip } from './HelpTip.tsx'
import { RouterEvaluation } from './RouterEvaluation.tsx'
import type { SessionListEntry } from '../api/gateway.ts'
import { RunDetailLoader } from './RunsPage.tsx'
import { useCallback, useEffect, useState } from 'react'
import { superagentAction, superagentState } from '@lai/dsh-adapter/superagent'
import type { SuperagentState } from '@lai/dsh-adapter/superagent'
import { useInterval } from '../hooks/useInterval.ts'
import { useLanguage } from '../i18n.tsx'
const button = 'rounded-md border border-fd-border bg-fd-secondary px-3 py-1.5 text-sm disabled:opacity-40'

export function RouterPage({ entries, onOpenRun, onConfigure }: { entries: SessionListEntry[]; onOpenRun: (id: string) => void; onConfigure: () => void }) {
  const { t } = useLanguage()
  const [tab, setTab] = useState<'evaluation' | 'run'>('evaluation')
  const [state, setState] = useState<SuperagentState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      setState(await superagentState())
      setError(null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }, [])
  useEffect(() => { void load() }, [load])
  useInterval(() => { void load() }, 5000)
  const action = async (path: string, body?: unknown) => { setBusy(true); try { await superagentAction(path, body); await load() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) } }
  return <div className="space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><h1 className="text-lg font-semibold">Router</h1><HelpTip text={t('Monitor / Router → Worker → five LAI subagents')} /></div><div className="flex gap-2"><button className={button} onClick={onConfigure}>{t('Configure Superagent')}</button><button className={button} onClick={() => { void load() }}>{t('Refresh')}</button></div></header>
    {error && <p role="alert" className="rounded-lg border border-fd-danger/30 p-3 text-sm text-fd-danger">{error}</p>}
    {state && <div className="flex flex-wrap items-center gap-4 rounded-lg bg-fd-secondary p-4 text-sm"><span>{state.setup.accounts?.repository ?? t('Not configured')}</span><span>{state.load.running} {t('Running')} · {state.load.queued} {t('Queued')}</span><button className={button} disabled={busy} onClick={() => { void action('executor/pause', { paused: !state.paused }) }}>{t(state.paused ? 'Resume processing' : 'Pause processing')}</button>{state.setup.problem && <span className="text-fd-warning">{state.setup.problem.detail ?? state.setup.problem.code}</span>}</div>}
    <div role="tablist" aria-label="Router" className="flex gap-1 border-b border-fd-border py-2">{(['evaluation', 'run'] as const).map(value => <button key={value} type="button" role="tab" aria-selected={tab === value} className={`rounded-md px-3 py-2 text-sm ${tab === value ? 'bg-fd-secondary font-medium' : 'text-fd-muted-foreground hover:bg-fd-secondary/50'}`} onClick={() => setTab(value)}>{t(value === 'run' ? 'Router run' : 'Evaluation')}</button>)}</div>
    {tab === 'evaluation' && <RouterEvaluation paused={state?.paused ?? false} onResume={() => { void action('executor/pause', { paused: false }) }} onConfigure={onConfigure} onOpenRun={onOpenRun} />}
    {tab === 'run' && <section aria-label={t('Router run')} className="flex h-[65vh] min-h-[24rem] flex-col overflow-hidden rounded-xl border border-fd-border">{state && entries.some(entry => entry.sessionId === state.masterId) ? <RunDetailLoader hideResult title="Superagent" key={state.masterId} sessionId={state.masterId} running={entries.find(entry => entry.sessionId === state.masterId)?.running ?? false} entries={entries} /> : <p className="p-6 text-sm text-fd-muted-foreground">{t('No Router run yet. Configure a source in Plugin → Superagent.')}</p>}</section>}
  </div>
}
