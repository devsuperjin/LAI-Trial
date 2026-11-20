import type { AgentToolCatalog } from '@lai/dsh-adapter/agent-tools'
import { defaultToolIds } from '@lai/dsh-adapter/agent-tools'
import { useLanguage } from '../i18n.tsx'

export function RoleTools({ role, catalog, value, disabled, onChange }: { role: string; catalog: AgentToolCatalog | null; value: string[] | null; disabled: boolean; onChange: (next: string[] | null) => void }) {
  const { t } = useLanguage()
  const ids = value ?? (catalog ? defaultToolIds(catalog, role) : [])
  const known = new Set(catalog?.groups.flatMap(group => group.tools.map(tool => tool.id)))
  const missing = ids.filter(id => !known.has(id))
  return <fieldset disabled={disabled || !catalog} className="mt-4 space-y-3 rounded-lg border border-fd-border p-3 disabled:opacity-50"><legend className="px-1 text-sm font-medium">{t('Tools')}</legend>
    <p className="text-xs text-fd-muted-foreground">{t('Grouped by installed plugin. Changes apply to new subagents; existing Runs retain their selection.')}</p>
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value === null} onChange={e => onChange(e.target.checked ? null : [...ids])} />{t('Use role defaults')}</label>
    <div className="flex gap-2"><button type="button" className="rounded border border-fd-border px-2 py-1 text-xs" onClick={() => onChange([...new Set([...ids, ...catalog!.groups.flatMap(group => group.tools.map(tool => tool.id))])])}>{t('Select all')}</button><button type="button" className="rounded border border-fd-border px-2 py-1 text-xs" onClick={() => onChange([])}>{t('Clear selection')}</button></div>
    {!catalog && <p className="text-xs text-fd-warning">{t('Tool catalog unavailable. Existing configuration is preserved.')}</p>}
    {catalog?.groups.map(group => <div key={group.id} className="rounded-md bg-fd-secondary/40 p-3"><div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-xs font-medium">{t(group.title)}</span><code className="break-all text-[10px] text-fd-muted-foreground">{group.id}</code><button type="button" className="ml-auto rounded border border-fd-border px-2 py-1 text-xs" onClick={() => onChange(group.tools.every(tool => ids.includes(tool.id)) ? ids.filter(id => !group.tools.some(tool => tool.id === id)) : [...new Set([...ids, ...group.tools.map(tool => tool.id)])])}>{t(group.tools.every(tool => ids.includes(tool.id)) ? 'Clear selection' : 'Select all')}</button></div><div className="grid gap-2 md:grid-cols-2">{group.tools.map(tool => <label key={tool.id} className="flex min-w-0 items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5" checked={ids.includes(tool.id)} onChange={e => onChange(e.target.checked ? [...ids, tool.id] : ids.filter(id => id !== tool.id))} /><span className="min-w-0"><code className="break-all">{tool.name}</code><span className="mt-0.5 block text-[10px] leading-4 text-fd-muted-foreground" title={tool.description}>{tool.description.slice(0, 180)}{tool.description.length > 180 ? '…' : ''}</span></span></label>)}</div></div>)}
    {missing.length > 0 && <div className="text-xs text-fd-warning"><p>{t('Previously selected tools are unavailable. They remain saved until you remove them.')}</p>{missing.map(id => <label key={id} className="mt-2 flex items-start gap-2"><input type="checkbox" checked onChange={() => onChange(ids.filter(item => item !== id))} /><code className="break-all">{id}</code></label>)}</div>}
  </fieldset>
}
