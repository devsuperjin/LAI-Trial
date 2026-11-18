import { useLanguage } from '../i18n.tsx'
import { useEffect, useState } from 'react'
import type { SettingsNamespaceView, ModelCatalog } from '../api/gateway.ts'
import { describeSettings, mutateSettings, modelCatalog } from '../api/gateway.ts'
import { record } from '../model/dag.ts'

const ROLES = [
  ['orchestrator', 'Worker orchestrator'], ['triage', 'Triage'], ['reproduce', 'Reproduction'],
  ['ticket', 'Ticket'], ['review', 'Review'], ['report', 'Reporter'],
] as const

function routeKey(value: unknown): string { const route = record(value); return typeof route.provider === 'string' && typeof route.model === 'string' ? JSON.stringify({ provider: route.provider, model: route.model }) : '' }

/** Edit the lai-agents plugin's prompts through ordinary DSH settings. */
export function AgentPrompts() {
  const { t } = useLanguage()
  const [namespace, setNamespace] = useState<SettingsNamespaceView | null>(null)
  const [writable, setWritable] = useState(false)
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [routes, setRoutes] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const load = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const [settings, models] = await Promise.all([describeSettings(), modelCatalog()])
      setCatalog(models)
      const ns = settings.namespaces.find(item => item.ns === 'lai-agents') ?? null
      setNamespace(ns)
      setWritable(settings.writable)
      const configured = record(ns?.value.models)
      setRoutes(Object.fromEntries(ROLES.filter(([id]) => id !== 'orchestrator').map(([id]) => [id, routeKey(configured[id])])))
      const prompts = record(ns?.value.prompts)
      setDraft(Object.fromEntries(ROLES.map(([id]) => [id, typeof prompts[id] === 'string' ? prompts[id] : ''])))
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])
  const save = async (): Promise<void> => {
    if (!namespace) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (ROLES.some(([id]) => !draft[id]?.trim())) throw new Error('Each agent needs a non-empty prompt.')
      const original = record(namespace.value.prompts)
      const ops: Parameters<typeof mutateSettings>[1] = ROLES.filter(([id]) => draft[id] !== original[id]).map(([id]) => ({ op: 'set' as const, path: ['prompts', id], value: draft[id] }))
      const models = record(namespace.value.models)
      for (const [id] of ROLES) if (id !== 'orchestrator' && (routes[id] ?? '') !== routeKey(models[id])) {
        ops.push(routes[id] ? { op: 'set', path: ['models', id], value: JSON.parse(routes[id]!) } : { op: 'unset', path: ['models', id] })
      }
      if (ops.length) setNamespace(await mutateSettings(namespace.ns, ops, namespace.revision))
      setNotice('Configuration saved. Prompts apply at the next assembly; model overrides apply to new children.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  const original = record(namespace?.value.prompts)
  const originalModels = record(namespace?.value.models)
  const dirty = ROLES.some(([id]) => draft[id] !== original[id] || id !== 'orchestrator' && (routes[id] ?? '') !== routeKey(originalModels[id]))
  return <section className="rounded-xl border border-fd-border bg-fd-card p-5" aria-label={t("LAI agents")}>
    <h2 className="text-base font-medium">{t("LAI agents")}</h2>
    <p className="mt-1 text-sm text-fd-muted-foreground">{t("A Superagent Worker orchestrator with five specialist subagents. Monitor / Router prompts are configured in Plugin → Superagent. Prompts are stored in the independent lai-agents plugin.")}</p>
    {!namespace && !busy && !error && <p className="mt-3 text-sm text-fd-warning">{t("The lai-agents plugin is not enabled in this profile.")}</p>}
    {namespace && <div className="mt-4 space-y-2">{ROLES.map(([id, title]) => <details className="rounded-lg border border-fd-border p-3" key={id}>
      <summary className="cursor-pointer text-sm font-medium">{t(title)}</summary>
      {id === 'orchestrator' ? <p className="mt-3 text-xs text-fd-muted-foreground">{t('Configure the Worker model in Plugin → Superagent → Execution.')}</p> : <label className="mt-3 block text-sm">{t('Role model')}<select aria-label={`${t(title)} model`} className="mt-1 w-full rounded-md border border-fd-border bg-fd-muted px-3 py-2 text-sm" disabled={busy || !writable} value={routes[id] ?? ''} onChange={event => setRoutes(current => ({ ...current, [id]: event.target.value }))}><option value="">{t('Inherit Worker model')}</option>{routes[id] && !catalog?.groups.some(group => group.models.some(model => JSON.stringify({ provider: group.id, model: model.id }) === routes[id])) && <option value={routes[id]}>{routes[id]}</option>}{catalog?.groups.map(group => <optgroup key={group.id} label={group.name}>{group.models.map(model => <option key={model.id} value={JSON.stringify({ provider: group.id, model: model.id })}>{model.name}</option>)}</optgroup>)}</select></label>}
      <textarea aria-label={`${t(title)} prompt`} className="mt-3 min-h-40 w-full rounded-md border border-fd-border bg-fd-muted p-3 text-sm outline-none focus:border-fd-primary disabled:opacity-50" value={draft[id] ?? ''} disabled={busy || !writable} onChange={event => { setDraft(value => ({ ...value, [id]: event.target.value })) }} />
    </details>)}</div>}
    {error && <p className="mt-3 text-sm text-fd-danger" role="alert">{error}{t(" Discard the draft and reload if settings changed elsewhere.")}</p>}
    {notice && <p className="mt-3 text-sm text-fd-success" role="status">{notice}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button className="rounded-md bg-fd-primary px-4 py-2 text-sm text-white disabled:opacity-40" disabled={busy || !namespace || !writable || !dirty} onClick={() => { void save() }} type="button">{t(busy ? 'Loading…' : 'Save configuration')}</button>
      <button className="rounded-md border border-fd-border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={() => { setNotice(null); void load() }} type="button">{t("Discard draft and reload")}</button>
    </div>
  </section>
}
