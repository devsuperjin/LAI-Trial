import { useEffect, useRef, useState } from 'react'
import type { AgentToolCatalog } from '@lai/dsh-adapter/agent-tools'
import type { ModelCatalog } from '../api/gateway.ts'
import { useLanguage } from '../i18n.tsx'
import { RoleTools } from './RoleTools.tsx'

export type AgentConfigTab = 'prompt' | 'model' | 'tools'
export interface AgentDraft { prompt: string; route: string; tools: string[] | null }
export function AgentConfigDialog({ role, title, initialTab, value, catalog, toolsCatalog, disabled, onApply, onClose }: { role: string; title: string; initialTab: AgentConfigTab; value: AgentDraft; catalog: ModelCatalog | null; toolsCatalog: AgentToolCatalog | null; disabled: boolean; onApply: (value: AgentDraft) => void; onClose: () => void }) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const [tab, setTab] = useState(initialTab)
  const [draft, setDraft] = useState<AgentDraft>(() => ({ ...value, tools: value.tools ? [...value.tools] : null }))
  useEffect(() => { const element = dialog.current!; element.showModal(); return () => { element.close() } }, [])
  return <dialog ref={dialog} aria-labelledby="agent-config-title" onCancel={event => { event.preventDefault(); onClose() }} className="m-auto w-[min(52rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-fd-border bg-fd-card p-0 text-fd-foreground shadow-2xl backdrop:bg-black/45">
    <div className="flex max-h-[85vh] flex-col"><header className="flex shrink-0 items-center justify-between gap-4 border-b border-fd-border px-5 py-4"><div><h2 id="agent-config-title" className="text-base font-semibold">{title}</h2><p className="mt-1 text-xs text-fd-muted-foreground">{t('Apply to the page draft, then save configuration.')}</p></div><button type="button" aria-label={t('Close')} onClick={onClose} className="rounded-md px-2 py-1 text-lg text-fd-muted-foreground hover:bg-fd-secondary">×</button></header>
    <nav className="flex shrink-0 gap-1 border-b border-fd-border px-4 py-2" aria-label={t('Agent configuration')}>{(['prompt', 'model', 'tools'] as const).filter(key => role !== 'orchestrator' || key === 'prompt').map(key => <button key={key} type="button" aria-pressed={tab === key} className={`rounded-md px-3 py-2 text-sm ${tab === key ? 'bg-fd-secondary font-medium' : 'text-fd-muted-foreground hover:bg-fd-secondary/50'}`} onClick={() => setTab(key)}>{t(key === 'prompt' ? 'Prompt' : key === 'model' ? 'Model' : 'Tools')}</button>)}</nav>
    <div className="fd-scroll min-h-0 overflow-y-auto px-5 py-4">
      {tab === 'prompt' && <label className="block text-sm">{t('Prompt')}<textarea aria-label={`${title} prompt`} disabled={disabled} spellCheck={false} className="mt-2 min-h-72 w-full rounded-lg border border-fd-border bg-fd-background p-3 font-mono text-xs leading-6 outline-none focus:border-fd-primary" value={draft.prompt} onChange={event => setDraft(current => ({ ...current, prompt: event.target.value }))} /></label>}
      {tab === 'model' && <label className="block py-4 text-sm">{t('Role model')}<select aria-label={`${title} model`} className="mt-2 w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2.5" disabled={disabled} value={draft.route} onChange={event => setDraft(current => ({ ...current, route: event.target.value }))}><option value="">{t('Inherit Worker model')}</option>{draft.route && !catalog?.groups.some(group => group.models.some(model => JSON.stringify({ provider: group.id, model: model.id }) === draft.route)) && <option value={draft.route}>{draft.route}</option>}{catalog?.groups.map(group => <optgroup key={group.id} label={group.name}>{group.models.map(model => <option key={model.id} value={JSON.stringify({ provider: group.id, model: model.id })}>{model.name}</option>)}</optgroup>)}</select><p className="mt-3 text-xs text-fd-muted-foreground">{t('Model and tool changes apply to new subagents.')}</p></label>}
      {tab === 'tools' && <RoleTools role={role} catalog={toolsCatalog} value={draft.tools} disabled={disabled} onChange={tools => setDraft(current => ({ ...current, tools }))} />}
    </div><footer className="flex shrink-0 justify-end gap-2 border-t border-fd-border px-5 py-3"><button type="button" className="rounded-lg border border-fd-border px-4 py-2 text-sm hover:bg-fd-secondary" onClick={onClose}>{t('Cancel')}</button><button type="button" disabled={disabled || !draft.prompt.trim()} className="rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40" onClick={() => { onApply(draft); onClose() }}>{t('Apply changes')}</button></footer></div>
  </dialog>
}
