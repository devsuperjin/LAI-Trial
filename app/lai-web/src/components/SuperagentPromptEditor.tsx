import { useState } from 'react'
import { previewSuperagentPrompts, saveSuperagentPrompts } from '@lai/dsh-adapter/superagent'
import type { PromptView } from '@lai/dsh-adapter/superagent'
import { useLanguage } from '../i18n.tsx'

const names: Record<string, string> = { communication: 'Communication', scope: 'Ticket scope', delivery: 'Delivery requirements', 'runtime/shared': 'Shared agreements', 'runtime/orchestrator': 'Router role', 'runtime/worker': 'Worker role', 'runtime/subscriptions': 'Subscriptions', 'runtime/replies': 'Replies & acknowledgements', 'runtime/dispatch': 'Routing', 'runtime/work': 'Work', 'runtime/admission': 'Router admission', 'runtime/handoff/orchestrator': 'Router handoff', 'runtime/handoff/worker': 'Worker handoff', 'runtime/environment': 'Environment', 'runtime/policy': 'Policy', 'runtime/policy/none': 'No-policy fallback', 'skill/github': 'GitHub', 'skill/feishu': 'Feishu' }
const button = 'rounded-lg border border-fd-border px-3 py-2 text-sm hover:bg-fd-secondary disabled:opacity-40'
export function SuperagentPromptEditor({ view, reload }: { view: PromptView; reload: () => Promise<void> }) {
  const { t } = useLanguage()
  const [draft, setDraft] = useState(view.current.config)
  const [selected, setSelected] = useState('communication')
  const [tab, setTab] = useState('Edit')
  const [preview, setPreview] = useState<{ orchestrator: string; worker: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const overrides = (draft.overrides ?? {}) as Record<string, { text: string; base?: string }>
  const skills = (draft.skills ?? {}) as Record<string, string>
  const part = view.parts.find(part => part.key === selected)
  const text = part ? overrides[selected]?.text ?? part.text : selected.startsWith('skill-custom/') ? skills[selected.slice(13)] ?? '' : String(draft[selected] ?? '')
  const update = (text: string) => {
    setPreview(null)
    if (part) setDraft(current => ({ ...current, overrides: { ...overrides, [selected]: { text, base: overrides[selected]?.base ?? part.base } } }))
    else if (selected.startsWith('skill-custom/')) setDraft(current => ({ ...current, skills: { ...skills, [selected.slice(13)]: text } }))
    else setDraft(current => ({ ...current, [selected]: text }))
  }
  const reset = () => { setPreview(null); if (part) { const next = { ...overrides }; delete next[selected]; setDraft(current => ({ ...current, overrides: next })) } else update(String(view.defaults[selected] ?? '')) }
  const act = async (run: () => Promise<unknown>) => { setBusy(true); setError(null); try { await run() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) } }
  const item = (key: string) => <button key={key} className={`block w-full rounded-lg px-3 py-3 text-left text-sm ${selected === key ? 'bg-fd-secondary font-medium' : 'text-fd-muted-foreground hover:bg-fd-secondary/50'}`} onClick={() => setSelected(key)}>{t(names[key] ?? key.replace('skill-custom/', ''))}</button>
  return <div className="space-y-5">
    <h2 className="text-base font-semibold">{t('Prompts')}</h2>
    <div className="flex gap-6 border-b border-fd-border">{['Edit', 'Full prompts', 'History'].map(name => <button key={name} className={`border-b-2 pb-3 text-sm ${tab === name ? 'border-fd-foreground font-medium' : 'border-transparent text-fd-muted-foreground'}`} onClick={() => { setTab(name); if (name === 'Full prompts') void act(async () => setPreview(await previewSuperagentPrompts(draft))) }}>{t(name)}</button>)}</div>
    {error && <p role="alert" className="text-sm text-fd-danger">{error}</p>}
    {tab === 'Edit' && <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]"><nav aria-label={t('Prompt sections')} className="space-y-1"><p className="px-3 py-2 text-xs font-semibold text-fd-muted-foreground">{t('Team agreements')}</p>{['communication', 'scope', 'delivery'].map(item)}<p className="px-3 pb-2 pt-5 text-xs font-semibold text-fd-muted-foreground">{t('Built-in sections')}</p>{view.parts.map(part => item(part.key))}{Object.keys(skills).length > 0 && <><p className="px-3 pb-2 pt-5 text-xs font-semibold text-fd-muted-foreground">{t('Skills')}</p>{Object.keys(skills).map(name => item(`skill-custom/${name}`))}</>}</nav><div className="min-w-0 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-medium">{t(names[selected] ?? selected)}</h3>{!selected.startsWith('skill-custom/') && <button className={button} disabled={busy} onClick={reset}>{t('Restore section default')}</button>}</div><p className="text-xs text-fd-muted-foreground">{part ? part.roles.map(role => role === 'orchestrator' ? 'Router' : 'Worker').join(' · ') : 'Router · Worker'}</p><textarea aria-label={t(names[selected] ?? selected)} spellCheck={false} className="fd-scroll min-h-[30rem] w-full rounded-xl border border-fd-border bg-fd-background p-4 font-mono text-sm leading-7 outline-none focus:border-fd-primary" value={text} onChange={e => update(e.target.value)} /><button className={button} disabled={busy || JSON.stringify(draft) === JSON.stringify(view.current.config)} onClick={() => { void act(async () => { await saveSuperagentPrompts(draft, view.current.revision); await reload() }) }}>{t(busy ? 'Saving…' : 'Save')}</button></div></div>}
    {tab === 'Full prompts' && <div className="space-y-5">{preview ? Object.entries(preview).map(([role, text]) => <details key={role} open className="rounded-xl border border-fd-border p-4"><summary className="cursor-pointer text-sm font-medium">{role === 'orchestrator' ? 'Router' : 'Worker'}</summary><pre className="mt-4 whitespace-pre-wrap break-words text-xs leading-6">{text}</pre></details>) : <p className="text-sm text-fd-muted-foreground">{t('Loading…')}</p>}</div>}
    {tab === 'History' && <div className="divide-y divide-fd-border">{view.revisions.map(revision => <div key={revision.revision} className="space-y-2 py-4 text-sm"><p className="font-medium">#{revision.revision} · {new Date(revision.savedAt).toLocaleString()}</p><p className="text-xs text-fd-muted-foreground">{revision.changed.map(key => t(names[key] ?? key)).join(' · ') || t('Initial configuration')}</p></div>)}</div>}
  </div>
}
