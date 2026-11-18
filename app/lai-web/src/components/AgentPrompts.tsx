import { useLanguage } from '../i18n.tsx'
import { useEffect, useState } from 'react'
import type { SettingsNamespaceView } from '../api/gateway.ts'
import { describeSettings, mutateSettings } from '../api/gateway.ts'
import { record } from '../model/dag.ts'

const ROLES = [
  ['orchestrator', 'Worker orchestrator'], ['triage', 'Triage'], ['reproduce', 'Reproduction'],
  ['ticket', 'Ticket'], ['review', 'Review'], ['report', 'Reporter'],
] as const

/** Edit the lai-agents plugin's prompts through ordinary DSH settings. */
export function AgentPrompts() {
  const { t } = useLanguage()
  const [namespace, setNamespace] = useState<SettingsNamespaceView | null>(null)
  const [writable, setWritable] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const load = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const settings = await describeSettings()
      const ns = settings.namespaces.find(item => item.ns === 'lai-agents') ?? null
      setNamespace(ns)
      setWritable(settings.writable)
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
      const ops = ROLES.filter(([id]) => draft[id] !== original[id]).map(([id]) => ({ op: 'set' as const, path: ['prompts', id], value: draft[id] }))
      if (ops.length) setNamespace(await mutateSettings(namespace.ns, ops, namespace.revision))
      setNotice('Prompts saved. Each role uses its updated prompt at the next prompt assembly.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  const original = record(namespace?.value.prompts)
  const dirty = ROLES.some(([id]) => draft[id] !== original[id])
  return <section className="rounded-xl border border-fd-border bg-fd-card p-5" aria-label={t("LAI agents")}>
    <h2 className="text-base font-medium">{t("LAI agents")}</h2>
    <p className="mt-1 text-sm text-fd-muted-foreground">{t("A Superagent Worker orchestrator with five specialist subagents. Monitor / Router prompts are configured above. Prompts are stored in the independent lai-agents plugin.")}</p>
    {!namespace && !busy && !error && <p className="mt-3 text-sm text-fd-warning">{t("The lai-agents plugin is not enabled in this profile.")}</p>}
    {namespace && <div className="mt-4 space-y-2">{ROLES.map(([id, title]) => <details className="rounded-lg border border-fd-border p-3" key={id}>
      <summary className="cursor-pointer text-sm font-medium">{t(title)}</summary>
      <textarea aria-label={`${t(title)} prompt`} className="mt-3 min-h-40 w-full rounded-md border border-fd-border bg-fd-muted p-3 text-sm outline-none focus:border-fd-primary disabled:opacity-50" value={draft[id] ?? ''} disabled={busy || !writable} onChange={event => { setDraft(value => ({ ...value, [id]: event.target.value })) }} />
    </details>)}</div>}
    {error && <p className="mt-3 text-sm text-fd-danger" role="alert">{error}{t(" Discard the draft and reload if settings changed elsewhere.")}</p>}
    {notice && <p className="mt-3 text-sm text-fd-success" role="status">{notice}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button className="rounded-md bg-fd-primary px-4 py-2 text-sm text-white disabled:opacity-40" disabled={busy || !namespace || !writable || !dirty} onClick={() => { void save() }} type="button">{t(busy ? 'Loading…' : 'Save prompts')}</button>
      <button className="rounded-md border border-fd-border px-3 py-2 text-sm disabled:opacity-40" disabled={busy} onClick={() => { setNotice(null); void load() }} type="button">{t("Discard draft and reload")}</button>
    </div>
  </section>
}
