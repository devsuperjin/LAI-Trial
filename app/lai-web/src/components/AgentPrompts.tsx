import { HelpTip } from './HelpTip.tsx'
import { agentToolCatalog, defaultToolIds } from '@lai/dsh-adapter/agent-tools'
import type { AgentToolCatalog } from '@lai/dsh-adapter/agent-tools'
import { AgentConfigDialog, type AgentConfigTab } from './AgentConfigDialog.tsx'
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
  const [editing, setEditing] = useState<{ role: string; title: string; tab: AgentConfigTab } | null>(null)
  const [namespace, setNamespace] = useState<SettingsNamespaceView | null>(null)
  const [writable, setWritable] = useState(false)
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [tools, setTools] = useState<Record<string, string[] | null>>({})
  const [toolCatalog, setToolCatalog] = useState<AgentToolCatalog | null>(null)
  const [routes, setRoutes] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const load = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const [settings, models, availableTools] = await Promise.all([describeSettings(), modelCatalog(), agentToolCatalog().catch(() => null)])
      setToolCatalog(availableTools)
      setCatalog(models)
      const ns = settings.namespaces.find(item => item.ns === 'lai-agents') ?? null
      setNamespace(ns)
      setWritable(settings.writable)
      const selectedTools = record(ns?.value.tools)
      setTools(Object.fromEntries(ROLES.filter(([id]) => id !== 'orchestrator').map(([id]) => [id, Array.isArray(selectedTools[id]) ? selectedTools[id] as string[] : null])))
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
      const originalTools = record(namespace.value.tools)
      for (const [id] of ROLES) if (id !== 'orchestrator' && JSON.stringify(tools[id] ?? null) !== JSON.stringify(originalTools[id] ?? null)) {
        ops.push({ op: 'set', path: ['tools', id], value: tools[id] ?? null })
      }
      if (ops.length) setNamespace(await mutateSettings(namespace.ns, ops, namespace.revision))
      setNotice(t('Saved. Prompts apply at the next assembly; models and tools apply to new subagents.'))
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  const original = record(namespace?.value.prompts)
  const originalModels = record(namespace?.value.models)
  const dirty = ROLES.some(([id]) => draft[id] !== original[id] || id !== 'orchestrator' && ((routes[id] ?? '') !== routeKey(originalModels[id]) || JSON.stringify(tools[id] ?? null) !== JSON.stringify(record(namespace?.value.tools)[id] ?? null)))
  return <section className="min-w-0" aria-label={t("LAI agents")}>
    <div className="flex items-center gap-2"><h2 className="text-base font-medium">{t("LAI agents")}</h2><HelpTip text={t("A Superagent Worker orchestrator with five specialist subagents. Monitor / Router prompts are configured in Plugin → Superagent. Prompts are stored in the independent lai-agents plugin.")} /></div>
    {!namespace && !busy && !error && <p className="mt-3 text-sm text-fd-warning">{t("The lai-agents plugin is not enabled in this profile.")}</p>}
    {namespace && <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{ROLES.map(([id, title], index) => {
      const selected = tools[id] ?? (toolCatalog ? defaultToolIds(toolCatalog, id) : [])
      const route = routes[id] ? record(JSON.parse(routes[id]!)) : null
      const modelName = route ? catalog?.groups.find(group => group.id === route.provider)?.models.find(model => model.id === route.model)?.name ?? String(route.model) : t('Inherit Worker model')
      const descriptions = ['Coordinate the five-stage pipeline and pass context between specialists.', 'Classify failures and identify the root cause from evidence.', 'Reproduce the problem and implement explicitly authorized fixes.', 'Prepare an actionable ticket draft with evidence and findings.', 'Independently review the diagnosis, changes and evidence.', 'Consolidate validated findings into the final report.']
      return <article key={id} className="flex min-w-0 flex-col rounded-xl border border-fd-border bg-fd-card p-4 transition-shadow hover:shadow-sm">
        <div className="flex items-center gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${id === 'orchestrator' ? 'bg-fd-primary/10 text-fd-primary' : 'bg-fd-secondary text-fd-muted-foreground'}`}>{id === 'orchestrator' ? 'W' : String(index).padStart(2, '0')}</span><div><h3 className="text-sm font-semibold">{t(title)}</h3><p className="mt-0.5 text-[10px] uppercase tracking-wide text-fd-muted-foreground">{t(id === 'orchestrator' ? 'Coordinator' : 'Specialist')}</p></div></div>
        <p className="mt-3 min-h-10 text-xs leading-5 text-fd-muted-foreground">{t(descriptions[index]!)}</p>
        <dl className="my-3 space-y-2 border-y border-fd-border py-3 text-xs"><div className="flex items-start justify-between gap-3"><dt className="text-fd-muted-foreground">{t('Model')}</dt><dd className="min-w-0 truncate text-right" title={id === 'orchestrator' ? 'Superagent → Execution' : modelName}>{id === 'orchestrator' ? 'Superagent → Execution' : modelName}</dd></div><div className="flex justify-between gap-3"><dt className="text-fd-muted-foreground">{t('Tools')}</dt><dd>{id === 'orchestrator' ? t('Five fixed delegations') : toolCatalog ? `${selected.length} ${t('selected')} · ${t(tools[id] == null ? 'Role defaults' : 'Custom')}` : '—'}</dd></div></dl>
        <p className="mb-4 line-clamp-2 min-h-9 text-[11px] leading-[18px] text-fd-muted-foreground" title={draft[id]}>{draft[id]}</p>
        <div className="mt-auto grid grid-cols-3 gap-2">{(['prompt', 'model', 'tools'] as const).map(tab => <button key={tab} type="button" aria-label={`${t(title)} ${t(tab === 'prompt' ? 'Prompt' : tab === 'model' ? 'Model' : 'Tools')}`} disabled={busy || id === 'orchestrator' && tab !== 'prompt'} title={id === 'orchestrator' && tab !== 'prompt' ? t('Worker model is managed by Superagent; delegation tools are fixed.') : undefined} onClick={() => setEditing({ role: id, title: t(title), tab })} className="rounded-lg border border-fd-border px-2 py-2 text-xs hover:bg-fd-secondary disabled:cursor-default disabled:opacity-35">{t(tab === 'prompt' ? 'Prompt' : tab === 'model' ? 'Model' : 'Tools')}</button>)}</div>
      </article>
    })}</div>}
    {editing && <AgentConfigDialog key={editing.role} role={editing.role} title={editing.title} initialTab={editing.tab} value={{ prompt: draft[editing.role] ?? '', route: routes[editing.role] ?? '', tools: tools[editing.role] ?? null }} catalog={catalog} toolsCatalog={toolCatalog} disabled={busy || !writable} onClose={() => setEditing(null)} onApply={value => { setDraft(current => ({ ...current, [editing.role]: value.prompt })); if (editing.role !== 'orchestrator') { setRoutes(current => ({ ...current, [editing.role]: value.route })); setTools(current => ({ ...current, [editing.role]: value.tools })) } }} />}
    {error && <p className="mt-3 text-sm text-fd-danger" role="alert">{error}{t(" Discard the draft and reload if settings changed elsewhere.")}</p>}
    {notice && <p className="mt-3 text-sm text-fd-success" role="status">{notice}</p>}
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-fd-border py-3">
      <button className="rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-white shadow-sm disabled:bg-fd-secondary disabled:text-fd-muted-foreground disabled:shadow-none" disabled={busy || !namespace || !writable || !dirty} onClick={() => { void save() }} type="button">{t(busy ? 'Loading…' : 'Save configuration')}</button>
      {dirty && <span role="status" className="text-xs text-fd-primary">{t('Unsaved changes')}</span>}
      <button className="rounded-md border border-fd-border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={() => { setNotice(null); void load() }} type="button">{t("Discard draft and reload")}</button>
    </div>
  </section>
}
