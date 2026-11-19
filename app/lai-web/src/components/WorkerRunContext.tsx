import { useCallback, useEffect, useState } from 'react'
import { routerReasonText, superagentWorkerDetails } from '@lai/dsh-adapter/superagent'
import type { WorkerTicketDetails } from '@lai/dsh-adapter/superagent'
import { useLanguage } from '../i18n.tsx'

export function WorkerRunContext({ runId }: { runId: string }) {
  const { t, language } = useLanguage()
  const [data, setData] = useState<WorkerTicketDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError(null)
    try { const next = await superagentWorkerDetails(runId); if (!signal.aborted) setData(next) }
    catch (e) { if (!signal.aborted) setError(e instanceof Error ? e.message : String(e)) }
    finally { if (!signal.aborted) setLoading(false) }
  }, [runId])
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { const controller = new AbortController(); setData(null); void load(controller.signal); return () => controller.abort() }, [load, attempt])
  if (loading) return <p className="p-5 text-sm text-fd-muted-foreground">{t('Loading…')}</p>
  if (error) return <div role="alert" className="space-y-3 p-5 text-sm"><p className="text-fd-danger">{t('Worker task details unavailable.')} {error}</p><button className="text-fd-primary" onClick={() => setAttempt(value => value + 1)}>{t('Retry')}</button></div>
  if (!data) return null
  const actor = data.mandate.actor
  const factText = (value: string | { id: string; name: string }[] | undefined) => Array.isArray(value) ? value.map(rule => rule.name || rule.id).join(', ') : value ? t(value) : t('Yes')
  const rows: [string, string][] = [
    ...(data.decision ? [[t('Trigger'), data.decision.preview], [t('Decision'), `${t(data.decision.kind)} · ${routerReasonText(data.decision.reason)}`], [t('Decision time'), new Date(data.decision.at).toLocaleString()]] as [string, string][] : []),
    [t('Source'), actor.source], [t('Requested by'), actor.name?.[language] ?? actor.name?.en ?? actor.id],
    [t('Authorization strength'), t(data.mandate.strength)], [t('Scope'), data.mandate.scope || '—'],
    ...data.basis.facts.filter(fact => !(fact.name === 'sender' && (fact.value === actor.id || fact.value === actor.name?.[language] || fact.value === actor.name?.en))).map((fact): [string, string] => [t(fact.name), factText(fact.value)]),
    [t('Policy version'), data.mandate.policyVersion],
  ]
  return <div className="p-4 text-xs leading-5">
    <h3 className="mb-3 text-sm font-semibold">{t('Authorization details')}</h3>
    <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-4 gap-y-1.5">{rows.map(([label, value], index) => <div key={index} className="contents"><dt className="text-fd-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words">{value}</dd></div>)}</dl>
    {data.decision?.rules?.map(rule => <p key={rule.id} className="mt-2 text-fd-muted-foreground">{rule.matched ? '✓' : '○'} {rule.name} · {rule.reason}</p>)}
    <h3 className="mb-2 mt-4 border-t border-fd-border pt-3 text-sm font-semibold">{t('Execution environment')}</h3>
    {data.environment.length === 0 ? <p className="text-fd-muted-foreground">{t('Execution environment unavailable.')}</p> : <div className="divide-y divide-fd-border">{data.environment.map(variable => <div key={`${variable.owner}:${variable.key}`} className="grid min-w-0 gap-x-4 gap-y-1 py-2 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]"><div className="min-w-0"><code className="break-all text-[11px] font-medium">{variable.key}</code><span className="ml-2 text-[10px] text-fd-muted-foreground">{variable.owner}</span></div><div className="min-w-0"><p className="whitespace-pre-wrap break-all font-mono text-xs">{variable.value || '—'}</p><p className="mt-0.5 text-[11px] leading-4 text-fd-muted-foreground">{variable.description[language] ?? variable.description.en}</p></div></div>)}</div>}
  </div>
}
