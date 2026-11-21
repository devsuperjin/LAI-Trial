import { SelectionGroup, SelectionIndicator } from './SelectionMotion.tsx'
import { useCallback, useEffect, useState } from 'react'
import { superagentDecisions, superagentTicket } from '@lai/dsh-adapter/superagent'
import type { RouterDecisions } from '@lai/dsh-adapter/superagent'
import { useLanguage } from '../i18n.tsx'
import { useInterval } from '../hooks/useInterval.ts'

const filters = [{ label: 'Accept & continue', kind: 'accept,reopen' }, { label: 'Stop', kind: 'stop' }, { label: 'Ignore', kind: 'ignore' }, { label: 'Incomplete', kind: 'unavailable' }, { label: 'All', kind: '' }]
export function RouterEvaluation({ paused, onResume, onConfigure, onOpenRun }: { paused: boolean; onResume: () => void; onConfigure: () => void; onOpenRun: (id: string) => void }) {
  const { t } = useLanguage()
  const [kind, setKind] = useState('accept,reopen')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState<RouterDecisions | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { try { setData(await superagentDecisions(kind, offset)); setError(null) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } }, [kind, offset])
  useEffect(() => { setData(null); void load() }, [load])
  useInterval(() => { void load() }, 5000)
  return <section className="space-y-6">
    <div className="flex items-center justify-between"><h2 className="text-base font-semibold">{t('Evaluation status')}</h2><button className="text-sm text-fd-muted-foreground hover:text-fd-primary" onClick={onConfigure}>{t('Settings')} ↗</button></div>
    {paused && <p className="rounded-xl bg-fd-warning/10 px-5 py-4 text-sm">{t('Processing is paused. New triggers are recorded but will not be evaluated.')} <button className="text-fd-primary" onClick={onResume}>{t('Resume processing')}</button></p>}
    <SelectionGroup><div className="flex flex-wrap gap-2">{filters.map(filter => <button key={filter.label} type="button" aria-pressed={kind === filter.kind} className={`relative isolate rounded-full border border-transparent px-3 py-1.5 text-sm ${kind === filter.kind ? 'text-fd-foreground' : 'border-transparent text-fd-muted-foreground hover:bg-fd-secondary/50'}`} onClick={() => { setKind(filter.kind); setOffset(0) }}>{kind === filter.kind && <SelectionIndicator className="rounded-full border border-fd-border bg-fd-secondary" />}<span className="relative">{t(filter.label)}</span></button>)}</div></SelectionGroup>
    {error && <p role="alert" className="text-sm text-fd-danger">{error}</p>}
    <div className="divide-y divide-fd-border">{data?.items.map(decision => <article key={decision.id} className="grid gap-4 py-6 sm:grid-cols-[9rem_minmax(0,1fr)]"><div className="flex items-start gap-2 text-sm text-fd-muted-foreground"><span className={['accept', 'reopen'].includes(decision.kind) ? 'text-fd-success' : ''}>{['accept', 'reopen'].includes(decision.kind) ? '✓' : '○'}</span>{t(decision.kind)}</div><div className="min-w-0 space-y-2 sm:border-l sm:border-fd-border sm:pl-6"><h3 className="text-sm font-semibold">{decision.ticketTitle ?? decision.threadTitle ?? t('Untitled')}</h3><p className="whitespace-pre-wrap break-words text-sm text-fd-muted-foreground">{decision.preview}</p><p className="whitespace-pre-wrap break-words text-xs text-fd-muted-foreground">{decision.reason}</p><div className="flex flex-wrap items-center gap-4 text-xs text-fd-muted-foreground"><time>{new Date(decision.at).toLocaleString()}</time>{decision.ticketId && <button className="text-fd-primary" onClick={() => { void (async () => { try { const ticket = await superagentTicket(decision.ticketId!); if (!ticket.sessionId) throw new Error(t('Worker run is not available yet.')); onOpenRun(ticket.sessionId) } catch (e) { setError(e instanceof Error ? e.message : String(e)) } })() }}>{t('View run')} ↗</button>}</div></div></article>)}</div>
    {!data && !error && <p className="text-sm text-fd-muted-foreground">{t('Loading…')}</p>}{data?.items.length === 0 && <p className="py-10 text-center text-sm text-fd-muted-foreground">{t('No evaluation records.')}</p>}
    <div className="flex gap-4 text-sm"><button disabled={offset === 0} className="text-fd-muted-foreground disabled:opacity-30" onClick={() => setOffset(Math.max(0, offset - 30))}>{t('Previous')}</button><button disabled={data?.next_offset == null} className="text-fd-muted-foreground disabled:opacity-30" onClick={() => setOffset(data?.next_offset ?? offset)}>{t('Next')}</button></div>
  </section>
}
