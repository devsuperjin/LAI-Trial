import { Switch as Toggle } from '../components/Switch.tsx'
import { SelectionGroup, SelectionIndicator } from '../components/SelectionMotion.tsx'
import { PageHeader, PagePanel, RefreshAction } from '../layout/PageLayout.tsx'
import { SuperagentPromptEditor } from '../components/SuperagentPromptEditor.tsx'
import { useCallback, useEffect, useState } from 'react'
import { saveSuperagentSettings, superagentAction, superagentPrompts, superagentSettings, superagentState } from '@lai/dsh-adapter/superagent'
import type { ConfigBlock, PromptView, Localized, SourceSettings, SuperagentSettings as Settings, SuperagentState } from '@lai/dsh-adapter/superagent'
import { useLanguage } from '../i18n.tsx'

const input = 'w-full rounded-lg border border-fd-border bg-fd-background px-3 py-3 text-sm outline-none focus:border-fd-primary'
const button = 'rounded-md border border-fd-border bg-fd-secondary px-3 py-2 text-sm disabled:opacity-40'


function JsonBlock({ title, block, save }: { title: string; block: ConfigBlock; save: (value: Record<string, unknown>) => Promise<void> }) {
  const { t } = useLanguage()
  const saved = JSON.stringify(block.value, null, 2)
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setDraft(saved) }, [saved, block.revision])
  return <details className="rounded-lg border border-fd-border p-3"><summary className="cursor-pointer text-sm font-medium">{t(title)}</summary>
    <textarea aria-label={t(title)} className={`${input} fd-scroll mt-3 h-64 font-mono text-xs`} value={draft} onChange={event => setDraft(event.target.value)} spellCheck={false} />
    {error && <p role="alert" className="my-2 text-sm text-fd-danger">{error}</p>}
    <div className="mt-2 flex gap-2"><button className={button} disabled={busy || draft === saved} onClick={() => { setBusy(true); setError(null); void (async () => { const value: unknown = JSON.parse(draft); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object'); await save(value as Record<string, unknown>) })().catch(e => setError(String(e.message ?? e))).finally(() => setBusy(false)) }}>{t(busy ? 'Saving…' : 'Save')}</button><button className={button} disabled={busy || draft === saved} onClick={() => { setDraft(saved); setError(null) }}>{t('Reset')}</button></div>
  </details>
}

function ExecutionForm({ kind, block, reload }: { kind: 'eval' | 'executor'; block: ConfigBlock; reload: () => Promise<void> }) {
  const { t } = useLanguage()
  const [value, setValue] = useState(block.value)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setValue(block.value) }, [block.revision, block.value])
  const set = (key: string, next: unknown) => setValue(current => ({ ...current, [key]: next }))
  const model = (value.model ?? {}) as Record<string, string>
  const route = (key: string, next: string) => setValue(current => ({ ...current, model: { ...((current.model ?? {}) as object), [key]: next } }))
  return <div className="space-y-6 rounded-2xl border border-fd-border p-5 md:p-6">
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      {kind === 'eval' ? <><label className="text-sm">{t('Mode')}<select className={input} value={String(value.mode)} onChange={e => set('mode', e.target.value)}>{['off', 'observe', 'auto'].map(mode => <option key={mode} value={mode}>{t(mode)}</option>)}</select></label><label className="text-sm">{t('Timeout (seconds)')}<input className={input} type="number" min={1} value={Number(value.timeoutSeconds)} onChange={e => set('timeoutSeconds', Number(e.target.value))} /></label></> : <><label className="text-sm">{t('Concurrent Workers')}<input className={input} type="number" min={1} value={Number(value.maxWorkers)} onChange={e => set('maxWorkers', Number(e.target.value))} /></label><label className="text-sm">{t('Worker directory')}<input className={input} value={String(value.directory ?? '')} onChange={e => set('directory', e.target.value)} placeholder="Default" /></label><label className="text-sm sm:col-span-2">{t('Workspace prepare command')}<textarea className={`${input} h-28 font-mono text-xs`} value={String(value.prepare ?? '')} onChange={e => set('prepare', e.target.value)} /></label><label className="text-sm sm:col-span-2">{t('Blocked commands (one per line)')}<textarea className={input} value={(value.blockedCommands as string[] ?? []).join('\n')} onChange={e => set('blockedCommands', e.target.value.split('\n').map(item => item.trim()).filter(Boolean))} /></label></>}
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={value.model === null} onChange={e => set('model', e.target.checked ? null : { provider: '', model: '' })} />{t('Inherit default model')}</label>
      {value.model !== null && <><label className="text-sm">{t('Provider ID')}<input className={input} value={model.provider ?? ''} onChange={e => route('provider', e.target.value)} /></label><label className="text-sm">{t('Model ID')}<input className={input} value={model.model ?? ''} onChange={e => route('model', e.target.value)} /></label></>}
    </fieldset>
    {error && <p role="alert" className="text-sm text-fd-danger">{error}</p>}
    <button className={button} disabled={busy || JSON.stringify(value) === JSON.stringify(block.value)} onClick={() => { setBusy(true); setError(null); void saveSuperagentSettings(kind, value, block.revision).then(reload).catch(e => setError(e.message)).finally(() => setBusy(false)) }}>{t(busy ? 'Saving…' : 'Save')}</button>
  </div>
}

function SourceForm({ source, reload }: { source: SourceSettings; reload: () => Promise<void> }) {
  const { language, t } = useLanguage()
  const local = (value: Localized) => value[language] ?? value.en
  const [value, setValue] = useState(source.value)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setValue(source.value) }, [source.revision, source.value])
  const change = (key: string, next: unknown) => setValue(current => ({ ...current, config: { ...current.config, [key]: next } }))
  const save = async (next = value) => { setBusy(true); setError(null); try { await saveSuperagentSettings(`source:${source.id}`, next, source.revision); await reload() } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) } }
  return <div className="space-y-6 rounded-2xl border border-fd-border p-5 md:p-6"><div className="flex items-center justify-between gap-3"><h4 className="font-medium">{local(source.title)}</h4><label className="flex items-center gap-2 text-sm"><Toggle checked={value.enabled} disabled={busy || !source.installed} onChange={next => setValue(current => ({ ...current, enabled: next }))} label={t('Enabled')} /></label></div>
    <p className="text-sm text-fd-muted-foreground">{local(source.description)}</p>
    <fieldset disabled={busy || !source.installed} className="space-y-5">{source.fields.filter(field => ['switch', 'number', 'text', 'select'].includes(field.type)).map(field => <label key={field.key} className={`block text-sm ${field.type === 'switch' ? 'flex items-center justify-between gap-4' : 'block space-y-2'}`}><span className="flex items-center gap-2 text-fd-muted-foreground">{local(field.label)}{field.hint && <span title={local(field.hint)} aria-label={local(field.hint)} className="cursor-help text-xs text-fd-muted-foreground/60">ⓘ</span>}</span>{field.type === 'switch' ? <Toggle checked={value.config[field.key] === true} onChange={next => change(field.key, next)} label={local(field.label)} /> : field.type === 'select' ? <select className={input} value={String(value.config[field.key] ?? '')} onChange={e => change(field.key, e.target.value)}>{field.options?.map(option => <option key={option.value} value={option.value}>{local(option.label)}</option>)}</select> : <input className={input} type={field.type === 'number' ? 'number' : 'text'} min={field.min} max={field.max} readOnly={field.readonly} value={String(value.config[field.key] ?? '')} onChange={e => change(field.key, field.type === 'number' ? Number(e.target.value) : e.target.value)} />}</label>)}</fieldset>
    {error && <p role="alert" className="text-sm text-fd-danger">{error}</p>}<button className={button} disabled={busy || !source.installed || JSON.stringify(value) === JSON.stringify(source.value)} onClick={() => { void save() }}>{t(busy ? 'Saving…' : 'Save source')}</button>
    <JsonBlock title="Advanced source configuration" block={source} save={async next => { await saveSuperagentSettings(`source:${source.id}`, next, source.revision); await reload() }} />
  </div>
}

export function SuperagentPage() {
  const { t } = useLanguage()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [state, setState] = useState<SuperagentState | null>(null)
  const [prompts, setPrompts] = useState<PromptView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState('Sources')
  const load = useCallback(async () => { const [next, status, prompt] = await Promise.all([superagentSettings(), superagentState(), superagentPrompts()]); setSettings(next); setState(status); setPrompts(prompt); setError(null) }, [])
  useEffect(() => { void load().catch(e => setError(e.message)) }, [load])
  const act = (run: () => Promise<unknown>) => { void run().then(load).catch(e => setError(e.message)) }
  return <section className="space-y-5">
    <PageHeader page="superagent" actions={<RefreshAction onRefresh={() => { void load().catch(e => setError(e.message)) }} />} />
    <PagePanel className="space-y-5">
    {error && <p role="alert" className="text-sm text-fd-danger">{error}</p>}
    {settings && state && <><div className="flex flex-wrap items-center gap-3 text-sm"><span>{state.setup.accounts?.repository ?? t('Not configured')}</span><span className="text-fd-muted-foreground">{state.setup.accounts?.agent}</span><span>{state.load.running} {t('Running')} · {state.load.queued} {t('Queued')}</span><button className={button} onClick={() => act(() => superagentAction('executor/pause', { paused: !state.paused }))}>{t(state.paused ? 'Resume processing' : 'Pause processing')}</button></div>
      {state.setup.problem && <p className="text-sm text-fd-warning">{state.setup.problem.detail ?? state.setup.problem.code}</p>}
      <div className="grid items-start gap-8 md:grid-cols-[11rem_minmax(0,1fr)]"><SelectionGroup><nav aria-label="Superagent settings" className="space-y-1">{['Sources', 'Policy', 'Eval', 'Execution', 'Prompts', 'Deployment'].map(name => <button key={name} aria-current={tab === name ? 'page' : undefined} className={`relative isolate block w-full rounded-lg px-4 py-3 text-left text-sm ${tab === name ? 'font-semibold' : 'text-fd-muted-foreground hover:bg-fd-secondary/50'}`} onClick={() => setTab(name)}>{tab === name && <SelectionIndicator className="rounded-lg bg-fd-secondary" />}<span className="relative">{t(name)}</span></button>)}</nav></SelectionGroup><div className="min-w-0">{tab !== 'Prompts' && <h2 className="mb-6 text-base font-semibold">{t(tab)}</h2>}
      {tab === 'Sources' && <div className="space-y-4">{settings.sources.map(source => <SourceForm key={source.id} source={source} reload={load} />)}</div>}
      {(['Policy', 'Eval', 'Execution'].includes(tab)) && (() => { const key = tab === 'Policy' ? 'policy' : tab === 'Eval' ? 'eval' : 'executor'; const block = settings.blocks[key]; return <div className="space-y-3"><p className="text-sm text-fd-muted-foreground">{t(tab === 'Policy' ? 'Configure allowed senders, admission rules and task scope.' : tab === 'Eval' ? 'Configure off / observe / auto mode, timeout and the Router model.' : 'Configure Worker model, concurrency, workspace preparation and command restrictions.')}</p>{key !== 'policy' && <ExecutionForm kind={key} block={block} reload={load} />}<JsonBlock title={`${tab} configuration`} block={block} save={async value => { await saveSuperagentSettings(key, value, block.revision); await load() }} /></div> })()}
      {tab === 'Prompts' && prompts && <SuperagentPromptEditor key={prompts.current.revision} view={prompts} reload={load} />}
      {tab === 'Deployment' && <div className="space-y-3 text-sm"><p>{t('State directory')}: <code className="break-all">{state.setup.machine.stateDir}</code></p><p>{t('Worker directory')}: <code className="break-all">{settings.environment.root}</code></p><button className={button} onClick={() => act(() => superagentAction('setup/check'))}>{t('Check deployment')}</button>{Object.entries(state.health).map(([name, health]) => <div key={name} className="rounded-lg bg-fd-secondary p-3"><strong>{name} · {health.state}</strong><p className="mt-1 break-words text-fd-muted-foreground">{health.detail}</p></div>)}</div>}
    </div></div></>}
    </PagePanel>
  </section>
}
