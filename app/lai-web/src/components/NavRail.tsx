import { CollapsedMenuFlyout } from './CollapsedMenuFlyout.tsx'
import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n.tsx'
import { MENU, FOOTER_MENU, groupForPage, type Page, type PageDefinition } from '../router/routes.tsx'
export type { Page } from '../router/routes.tsx'

const COLLAPSED_KEY = 'lai-web-sidebar-collapsed'
function initialCollapsed(): boolean {
  try { const saved = localStorage.getItem(COLLAPSED_KEY); if (saved !== null) return saved === 'true' } catch { /* Storage is optional. */ }
  return window.matchMedia('(max-width: 767px)').matches
}
export function NavRail({ page, onNavigate, runningCount }: { page: Page; onNavigate: (page: Page) => void; runningCount: number }) {
  const { t } = useLanguage()
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  useEffect(() => { try { localStorage.setItem(COLLAPSED_KEY, String(collapsed)) } catch { /* Storage is optional. */ } }, [collapsed])
  useEffect(() => { const group = groupForPage(page); if (group) setExpanded(current => ({ ...current, [group.id]: true })) }, [page])
  const alignment = collapsed ? 'justify-center' : 'justify-start'
  const toggleLabel = t(collapsed ? 'Expand sidebar' : 'Collapse sidebar')
  function renderPage(item: PageDefinition, nested = false) {
    const active = page === item.id
    return <button key={item.id} type="button" title={t(item.name)} aria-label={t(item.name)} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.id)} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-fd-primary ${alignment} ${active ? 'bg-fd-primary/10 font-medium text-fd-primary' : 'text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground'}`}>
      {!nested && <span className="shrink-0">{item.icon(active)}</span>}{!collapsed && <span className="truncate">{t(item.name)}</span>}
      {!collapsed && item.badge === 'running' && runningCount > 0 && <span className="ml-auto rounded bg-fd-secondary px-1.5 text-xs tabular-nums">{runningCount}</span>}
    </button>
  }
  return <nav aria-label={t('Primary navigation')} className={`flex min-h-0 shrink-0 flex-col overflow-x-hidden border-r border-fd-border bg-fd-card py-4 transition-[width,padding] duration-200 motion-reduce:transition-none ${collapsed ? 'w-16 px-2' : 'w-52 px-4'}`}>
    <div id="lai-sidebar-menu" className="fd-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden">{MENU.map(item => {
      if (!('children' in item)) return renderPage(item)
      if (collapsed) return <div key={item.id} className="pt-2"><CollapsedMenuFlyout group={item} page={page} onNavigate={onNavigate} /></div>
      const open = expanded[item.id] ?? true
      const active = item.children.some(child => child.id === page)
      return <div key={item.id} className="pt-2"><button type="button" aria-label={t(item.name)} title={t(item.name)} aria-expanded={open} aria-controls={`${item.id}-navigation`} onClick={() => setExpanded(current => ({ ...current, [item.id]: !open }))} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-fd-secondary ${alignment} ${collapsed && active ? 'text-fd-primary' : 'text-fd-muted-foreground'}`}><span className="shrink-0">{item.icon()}</span>{!collapsed && <><span>{t(item.name)}</span><svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" className={`ml-auto shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}><path d="m6 3 5 5-5 5" /></svg></>}</button>{open && <div id={`${item.id}-navigation`} className={`mt-1 space-y-1 ${collapsed ? '' : 'ml-5 border-l border-fd-border pl-3'}`}>{item.children.map(child => renderPage(child, true))}</div>}</div>
    })}</div>
    <div className={`mt-3 flex shrink-0 gap-1 border-t border-fd-border pt-3 ${collapsed ? 'flex-col' : 'items-center'}`}><div className={`min-w-0 ${collapsed ? 'w-full' : 'flex-1'}`}>{FOOTER_MENU.map(item => renderPage(item))}</div><button type="button" aria-label={toggleLabel} title={toggleLabel} aria-expanded={!collapsed} aria-controls="lai-sidebar-menu" onClick={() => setCollapsed(current => !current)} className={`flex min-h-10 shrink-0 items-center justify-center rounded-lg text-fd-muted-foreground hover:bg-fd-secondary focus-visible:outline-2 focus-visible:outline-fd-primary ${collapsed ? 'w-full' : 'w-9'}`}><svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d={collapsed ? 'm13 9 3 3-3 3' : 'm16 9-3 3 3 3'} /></svg></button></div>
  </nav>
}
