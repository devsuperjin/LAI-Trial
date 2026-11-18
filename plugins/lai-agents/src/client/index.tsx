/** Native DSH sidebar and plugin-manager configuration, using the same lai-agents settings namespace. */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { ConfigPageForm, PluginConfigViewProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'

const ROLES = [['orchestrator', 'Worker coordinator'], ['triage', 'Triage'], ['reproduce', 'Reproduction'], ['ticket', 'Ticket'], ['review', 'Reviewer'], ['report', 'Reporter']] as const
const NS = 'laiAgents'
const words = { en: { title: 'LAI Agents', hint: 'Worker coordinator and five sequential native subagents. Worker model: Superagent → Execution. Role overrides apply to newly created children.', save: 'Save', reload: 'Discard draft and reload', loading: 'Configuration unavailable or still loading.', prompt: 'Prompt', inherit: 'Inherit Worker model', provider: 'Provider ID', model: 'Model ID', saved: 'Saved. Prompts apply at the next assembly; model overrides apply to new children.', conflict: 'Save refused. Preserve your draft or reload the latest configuration.', empty: 'Each role needs a non-empty prompt and each pinned route needs a provider and model.' }, zh: { title: 'LAI Agents', hint: 'Worker 协调者与五个串行原生子 Agent。Worker 模型在 Superagent → Execution 配置，角色模型覆盖对新建子 Agent 生效。', save: '保存', reload: '放弃草稿并重新加载', loading: '配置不可用或仍在加载。', prompt: '提示词', inherit: '使用 Worker 模型', provider: 'Provider ID', model: '模型 ID', saved: '已保存。Prompt 在下次组装时生效，模型覆盖对新建子 Agent 生效。', conflict: '保存被拒绝，请保留草稿或重新加载最新配置。', empty: '每个角色的 Prompt 必须非空，固定模型必须填写服务商和模型 ID。' } }
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { laiAgents: keyof typeof words.en } }
type T = (key: keyof typeof words.en) => string
type Values = { prompts: Record<string, string>; models: Record<string, { provider: string; model: string }> }
const normalize = (value?: Record<string, unknown>): Values => ({ prompts: { ...(value?.prompts as Values['prompts'] ?? {}) }, models: Object.fromEntries(Object.entries(value?.models as Values['models'] ?? {}).filter(([, route]) => route != null)) })
const field = { width: '100%', boxSizing: 'border-box' as const, padding: '8px 10px', border: '1px solid #8886', borderRadius: 6, color: 'inherit', background: 'transparent', font: 'inherit' }

function Editor({ form, t }: { form: ConfigPageForm | undefined; t: T }) {
  const saved = JSON.stringify(normalize(form?.state.value))
  const [base, setBase] = useState(saved)
  const [draft, setDraft] = useState<Values>(() => JSON.parse(saved) as Values)
  const [revision, setRevision] = useState(form?.state.revision)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const dirty = JSON.stringify(draft) !== base
  // Never replace a dirty draft or its revision when another editor saves.
  useEffect(() => { if (!dirty) { setBase(saved); setDraft(JSON.parse(saved) as Values); setRevision(form?.state.revision) } }, [saved, form?.state.revision, dirty])
  if (!form || form.state.status !== 'ready') return <p>{t('loading')}</p>
  const writable = form.state.writable && !busy
  const reload = () => { setBase(saved); setDraft(JSON.parse(saved) as Values); setRevision(form.state.revision); setNotice('') }
  const save = async () => {
    setBusy(true); setNotice('')
    try {
      if (ROLES.some(([id]) => !draft.prompts[id]?.trim()) || Object.values(draft.models).some(route => !route.provider.trim() || !route.model.trim())) throw new Error(t('empty'))
      const original = normalize(form.state.value)
      const ops: Parameters<ConfigPageForm['mutate']>[0][number][] = []
      for (const [id] of ROLES) {
        if (draft.prompts[id] !== original.prompts[id]) ops.push({ op: 'set', path: ['prompts', id], value: draft.prompts[id]! })
        if (JSON.stringify(draft.models[id]) !== JSON.stringify(original.models[id])) ops.push(draft.models[id] ? { op: 'set', path: ['models', id], value: draft.models[id]! } : { op: 'unset', path: ['models', id] })
      }
      if (revision === undefined || !await form.mutate(ops, revision)) throw new Error(t('conflict'))
      setBase(JSON.stringify(draft))
      setNotice(t('saved'))
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}><h2>{t('title')}</h2><p>{t('hint')}</p>
    <fieldset disabled={!writable} style={{ border: 0, padding: 0, display: 'grid', gap: 12 }}>{ROLES.map(([id, title]) => <details key={id} style={{ border: '1px solid #8885', borderRadius: 10, padding: 14 }}><summary style={{ cursor: 'pointer' }}>{title}</summary>
      <label style={{ display: 'block', marginTop: 12 }}>{t('prompt')}<textarea aria-label={`${title} prompt`} style={{ ...field, minHeight: 190, marginTop: 8 }} value={draft.prompts[id] ?? ''} onChange={e => setDraft(current => ({ ...current, prompts: { ...current.prompts, [id]: e.target.value } }))} /></label>
      {id !== 'orchestrator' && <div style={{ marginTop: 12 }}><label><input type="checkbox" checked={!draft.models[id]} onChange={e => setDraft(current => { const models = { ...current.models }; if (e.target.checked) delete models[id]; else models[id] = { provider: '', model: '' }; return { ...current, models } })} /> {t('inherit')}</label>
        {draft.models[id] && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>{(['provider', 'model'] as const).map(key => <label key={key} style={{ flex: '1 1 180px' }}>{t(key)}<input style={field} value={draft.models[id]![key]} onChange={e => setDraft(current => ({ ...current, models: { ...current.models, [id]: { ...current.models[id]!, [key]: e.target.value } } }))} /></label>)}</div>}
      </div>}
    </details>)}</fieldset>
    <div style={{ display: 'flex', gap: 12, marginTop: 18 }}><button disabled={!writable || !dirty} onClick={() => { void save() }}>{t('save')}</button><button disabled={busy} onClick={reload}>{t('reload')}</button></div>{notice && <p role="status">{notice}</p>}
  </div>
}
function SidebarPage({ ctx, t }: { ctx: Context; t: T }) {
  const form = ctx.get('configForms')?.get<Record<string, unknown>>('lai-agents')
  const subscribe = useCallback((listener: () => void) => form ? form.subscribe(listener) : () => {}, [form])
  const state = useSyncExternalStore(subscribe, () => form?.getSnapshot())
  const page = useMemo(() => form && state ? { state, mutate: form.mutate.bind(form) } : undefined, [form, state])
  return <Editor form={page} t={t} />
}
function Icon({ size = 20 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><circle cx="12" cy="6" r="3" /><circle cx="5" cy="17" r="3" /><circle cx="19" cy="17" r="3" /><path d="m10 9-3 5m7-5 3 5M8 17h8" /></svg> }
export const inject = ['slots', 'locale']
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, words), 'LAI Agents translations')
  const t = ctx.locale.bind(NS) as T
  const panel = 'lai-agents' as MainPanelId
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: panel, locale: NS, inject: () => ({}) }, () => <SidebarPage ctx={ctx} t={t} />))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: panel, order: 11, label: () => t('title'), locale: NS }, Icon))
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: '@lai/lai-agents', locale: NS }, (props: PluginConfigViewProps) => props.view === 'page' ? <SidebarPage ctx={ctx} t={t} /> : null))
  ctx.slots.inject('plugins.row.config', () => ctx.slots.register({ name: 'plugins.row.config', key: '@lai/lai-agents#lai-agents', locale: NS }, (props: PluginConfigViewProps) => props.view === 'page' ? <Editor form={props.form} t={t} /> : null))
}
