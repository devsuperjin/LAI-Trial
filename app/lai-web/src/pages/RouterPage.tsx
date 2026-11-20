import { PageHeader, PagePanel, PageTabs, RefreshAction } from '../layout/PageLayout.tsx'
import { RouterEvaluation } from '../components/RouterEvaluation.tsx'
import type { SessionListEntry } from '../api/gateway.ts'
import { RunDetailLoader } from '../components/RunDetailLoader.tsx'
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
  return <div className="space-y-5">
    <PageHeader page="router" actions={<><button className={button} onClick={onConfigure}>{t('Configure Superagent')}</button><RefreshAction onRefresh={() => { void load() }} /></>} />
    <PagePanel className="space-y-5">
    {error && <p role="alert" className="rounded-lg border border-fd-danger/30 p-3 text-sm text-fd-danger">{error}</p>}
    {state && <div className="flex flex-wrap items-center gap-4 rounded-lg bg-fd-secondary p-4 text-sm"><span>{state.setup.accounts?.repository ?? t('Not configured')}</span><span>{state.load.running} {t('Running')} · {state.load.queued} {t('Queued')}</span><button className={button} disabled={busy} onClick={() => { void action('executor/pause', { paused: !state.paused }) }}>{t(state.paused ? 'Resume processing' : 'Pause processing')}</button>{state.setup.problem && <span className="text-fd-warning">{state.setup.problem.detail ?? state.setup.problem.code}</span>}</div>}
    <PageTabs id="router" label="Router" items={[{ id: 'evaluation', name: 'Evaluation' }, { id: 'run', name: 'Router run' }]} value={tab} onChange={setTab} />
    {tab === 'evaluation' && <div role="tabpanel" id="router-panel-evaluation" aria-labelledby="router-tab-evaluation"><RouterEvaluation paused={state?.paused ?? false} onResume={() => { void action('executor/pause', { paused: false }) }} onConfigure={onConfigure} onOpenRun={onOpenRun} /></div>}
    {tab === 'run' && <section role="tabpanel" id="router-panel-run" aria-labelledby="router-tab-run" aria-label={t('Router run')} className="flex h-[65vh] min-h-[24rem] flex-col overflow-hidden rounded-xl border border-fd-border">{state && entries.some(entry => entry.sessionId === state.masterId) ? <RunDetailLoader hideResult title="Superagent" key={state.masterId} sessionId={state.masterId} running={entries.find(entry => entry.sessionId === state.masterId)?.running ?? false} entries={entries} /> : <p className="p-6 text-sm text-fd-muted-foreground">{t('No Router run yet. Configure a source in Plugin → Superagent.')}</p>}</section>}
    </PagePanel>
  </div>
}
