import { RoleDialog, type ConfigTab } from './RoleDialog.tsx'
import { modelCatalog as availableModels, type ModelCatalog } from '@lai/dsh-adapter/gateway'
import { agentToolCatalog, defaultToolIds } from '@lai/dsh-adapter/agent-tools'
import type { AgentToolCatalog } from '@lai/dsh-adapter/agent-tools'
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
const words = { en: { selectAll: 'Select all', clearSelection: 'Clear selection', configuration: 'configuration', draftHint: 'Apply to the page draft, then save configuration.', close: 'Close', modelLabel: 'Model', cancel: 'Cancel', apply: 'Apply changes', unavailable: 'Unavailable', defaultsShort: 'Role defaults', custom: 'Custom', selected: 'selected', coordinator: 'Coordinator', specialist: 'Specialist', fixed: 'Five fixed delegations', workerModel: 'Superagent → Execution', title: 'LAI Agents', hint: 'Worker coordinator and five sequential native subagents. Worker model: Superagent → Execution. Role overrides apply to newly created children.', save: 'Save', reload: 'Discard draft and reload', loading: 'Configuration unavailable or still loading.', prompt: 'Prompt', inherit: 'Inherit Worker model', provider: 'Provider ID', model: 'Model ID', saved: 'Saved. Prompts apply at the next assembly; model and tool selections apply to new subagents.', conflict: 'Save refused. Preserve your draft or reload the latest configuration.', tools: 'Tools', defaults: 'Use role defaults', toolHint: 'Installed plugins, individual tools. Applies to new subagents; existing Runs keep their selections.', toolUnavailable: 'Tool catalog unavailable. Existing configuration is preserved.', empty: 'Each role needs a non-empty prompt and each pinned route needs a provider and model.' }, zh: { selectAll: '一键全选', clearSelection: '取消全选', configuration: '配置', draftHint: '应用到页面草稿后，请保存配置。', close: '关闭', modelLabel: '模型', cancel: '取消', apply: '应用更改', unavailable: '不可用', defaultsShort: '默认工具', custom: '自定义', selected: '已选', coordinator: '协调者', specialist: '专业角色', fixed: '五个固定委派工具', workerModel: 'Superagent → Execution', title: 'LAI Agents', hint: 'Worker 协调者与五个串行原生子 Agent。Worker 模型在 Superagent → Execution 配置，角色模型覆盖对新建子 Agent 生效。', save: '保存', reload: '放弃草稿并重新加载', loading: '配置不可用或仍在加载。', prompt: '提示词', inherit: '使用 Worker 模型', provider: 'Provider ID', model: '模型 ID', saved: '已保存。Prompt 在下次组装时生效，模型与工具选择对新建子 Agent 生效。', conflict: '保存被拒绝，请保留草稿或重新加载最新配置。', tools: '工具', defaults: '使用角色默认工具', toolHint: '按已安装插件分组，逐项选择工具。只影响新建子 Agent，已有 Run 保留原选择。', toolUnavailable: '工具清单不可用，保留已有配置。', empty: '每个角色的 Prompt 必须非空，固定模型必须填写服务商和模型 ID。' } }
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { laiAgents: keyof typeof words.en } }
export type T = (key: keyof typeof words.en) => string
type Values = { tools: Record<string, string[] | null>; prompts: Record<string, string>; models: Record<string, { provider: string; model: string }> }
const normalize = (value?: Record<string, unknown>): Values => ({ tools: Object.fromEntries(ROLES.filter(([id]) => id !== 'orchestrator').map(([id]) => [id, ((value?.tools as Values['tools'] | undefined)?.[id]) ?? null])), prompts: { ...(value?.prompts as Values['prompts'] ?? {}) }, models: Object.fromEntries(Object.entries(value?.models as Values['models'] ?? {}).filter(([, route]) => route != null)) })
const field = { width: '100%', boxSizing: 'border-box' as const, padding: '8px 10px', border: '1px solid #8886', borderRadius: 6, color: 'inherit', background: 'transparent', font: 'inherit' }

function Editor({ form, t }: { form: ConfigPageForm | undefined; t: T }) {
  const [editing, setEditing] = useState<{ role: string; title: string; tab: ConfigTab } | null>(null)
  const [models, setModels] = useState<ModelCatalog | null>(null)
  useEffect(() => { let active = true; void availableModels().then(value => { if (active) setModels(value) }).catch(() => {}); return () => { active = false } }, [])
  const [toolCatalog, setToolCatalog] = useState<AgentToolCatalog | null>(null)
  useEffect(() => { let active = true; void agentToolCatalog().then(value => { if (active) setToolCatalog(value) }).catch(() => {}); return () => { active = false } }, [])
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
  const reload = () => { setBase(saved); setDraft(JSON.parse(saved) as Values); setRevision(form.state.revision); setNotice(''); void agentToolCatalog().then(setToolCatalog).catch(() => setToolCatalog(null)) }
  const save = async () => {
    setBusy(true); setNotice('')
    try {
      if (ROLES.some(([id]) => !draft.prompts[id]?.trim()) || Object.values(draft.models).some(route => !route.provider.trim() || !route.model.trim())) throw new Error(t('empty'))
      const original = normalize(form.state.value)
      const ops: Parameters<ConfigPageForm['mutate']>[0][number][] = []
      for (const [id] of ROLES) {
        if (id !== 'orchestrator' && JSON.stringify(draft.tools[id]) !== JSON.stringify(original.tools[id])) ops.push({ op: 'set', path: ['tools', id], value: draft.tools[id] ?? null })
        if (draft.prompts[id] !== original.prompts[id]) ops.push({ op: 'set', path: ['prompts', id], value: draft.prompts[id]! })
        if (JSON.stringify(draft.models[id]) !== JSON.stringify(original.models[id])) ops.push(draft.models[id] ? { op: 'set', path: ['models', id], value: draft.models[id]! } : { op: 'unset', path: ['models', id] })
      }
      if (revision === undefined || !await form.mutate(ops, revision)) throw new Error(t('conflict'))
      setBase(JSON.stringify(draft))
      setNotice(t('saved'))
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }
  return <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%', boxSizing: 'border-box', height: '100%', minHeight: 0, flex: '1 1 0', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}><h2 style={{ margin: 0, fontSize: 22 }}>{t('title')}</h2><p style={{ fontSize: 13, lineHeight: 1.7, opacity: .65, marginTop: 8 }}>{t('hint')}</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 16, marginTop: 24 }}>{ROLES.map(([id, title], index) => {
      const descriptions = t('coordinator') === 'Coordinator' ? ['Coordinate the five-stage pipeline and pass context between specialists.', 'Classify failures and identify the root cause from evidence.', 'Reproduce the problem and implement explicitly authorized fixes.', 'Prepare an actionable ticket draft with evidence and findings.', 'Independently review the diagnosis, changes and evidence.', 'Consolidate validated findings into the final report.'] : ['协调五阶段流水线，在专业角色之间传递任务上下文。', '分析失败现象，结合证据定位问题根因。', '复现问题，并在明确授权范围内实施修复。', '整理发现与证据，准备可执行的工单草稿。', '独立检查分析、修改和证据是否可靠。', '汇总已验证的发现，形成最终报告。']
      const model = draft.models[id]
      const modelName = model ? models?.groups.find(group => group.id === model.provider)?.models.find(item => item.id === model.model)?.name ?? model.model : t('inherit')
      const selected = draft.tools[id] ?? (toolCatalog ? defaultToolIds(toolCatalog, id) : [])
      return <article key={id} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', border: '1px solid var(--dsw-alias-border-l2, #8884)', borderRadius: 14, padding: 18, background: 'var(--dsw-alias-bg-layer-2, transparent)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'var(--dsw-alias-interactive-bg-hover, #8882)', color: id === 'orchestrator' ? 'var(--dsw-alias-link,#4774ff)' : 'inherit', fontWeight: 600, fontSize: 12 }}>{id === 'orchestrator' ? 'W' : String(index).padStart(2, '0')}</span><div><h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3><span style={{ fontSize: 11, opacity: .6 }}>{t(id === 'orchestrator' ? 'coordinator' : 'specialist')}</span></div></header>
        <p style={{ fontSize: 12, lineHeight: 1.7, minHeight: 40, opacity: .7, margin: '12px 0' }}>{descriptions[index]}</p>
        <dl style={{ fontSize: 12, margin: 0, padding: '12px 0', borderTop: '1px solid #8883', borderBottom: '1px solid #8883', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: '8px 12px' }}><dt style={{ opacity: .6 }}>{t('modelLabel')}</dt><dd title={modelName} style={{ margin: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{id === 'orchestrator' ? t('workerModel') : modelName}</dd><dt style={{ opacity: .6 }}>{t('tools')}</dt><dd style={{ margin: 0, textAlign: 'right' }}>{id === 'orchestrator' ? t('fixed') : `${selected.length} ${t('selected')} · ${t(draft.tools[id] === null ? 'defaultsShort' : 'custom')}`}</dd></dl>
        <p title={draft.prompts[id]} style={{ fontSize: 11, lineHeight: '18px', opacity: .6, height: 36, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: '12px 0 16px' }}>{draft.prompts[id]}</p>
        <footer style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 'auto' }}>{(['prompt', 'model', 'tools'] as const).map(tab => <button key={tab} type="button" aria-label={`${title} ${t(tab === 'model' ? 'modelLabel' : tab)}`} disabled={busy || id === 'orchestrator' && tab !== 'prompt'} onClick={() => setEditing({ role: id, title, tab })} style={{ border: '1px solid #8884', borderRadius: 8, padding: '8px 4px', color: 'inherit', background: 'transparent', fontSize: 12, cursor: 'pointer', opacity: id === 'orchestrator' && tab !== 'prompt' ? .35 : 1 }}>{t(tab === 'model' ? 'modelLabel' : tab)}</button>)}</footer>
      </article>
    })}</div>
    {editing && <RoleDialog key={editing.role} role={editing.role} title={editing.title} initialTab={editing.tab} value={{ prompt: draft.prompts[editing.role] ?? '', model: draft.models[editing.role] ?? null, tools: draft.tools[editing.role] ?? null }} catalog={toolCatalog} models={models} t={t} disabled={!writable} onClose={() => setEditing(null)} onApply={value => setDraft(current => { const nextModels = { ...current.models }; if (value.model) nextModels[editing.role] = value.model; else delete nextModels[editing.role]; return { ...current, prompts: { ...current.prompts, [editing.role]: value.prompt }, models: nextModels, tools: editing.role === 'orchestrator' ? current.tools : { ...current.tools, [editing.role]: value.tools } } })} />}
    <div style={{ display: 'flex', gap: 12, marginTop: 18 }}><button style={{ border: '1px solid #8884', borderRadius: 8, padding: '8px 16px', background: dirty ? 'var(--dsw-alias-link, #4774ff)' : 'var(--dsw-alias-interactive-bg-hover, transparent)', color: dirty ? 'white' : 'inherit' }} disabled={!writable || !dirty} onClick={() => { void save() }}>{t('save')}</button><button style={{ border: '1px solid #8884', borderRadius: 8, padding: '8px 16px', color: 'inherit', background: 'transparent' }} disabled={busy} onClick={reload}>{t('reload')}</button></div>{notice && <p role="status">{notice}</p>}
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
