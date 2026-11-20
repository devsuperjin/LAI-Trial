import type { ReactNode } from 'react'
import { PAGES, type Page } from '../router/routes.tsx'
import { useLanguage } from '../i18n.tsx'
import { HelpTip } from '../components/HelpTip.tsx'

/** All page titles occupy the same position outside content panels. */
export function PageHeader({ page, actions }: { page: Page; actions?: ReactNode }) {
  const { t } = useLanguage()
  const definition = PAGES[page]
  return <header className="flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><h1 className="text-xl font-semibold leading-7 tracking-tight">{t(definition.name)}</h1><HelpTip text={t(definition.hint)} /></div>{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</header>
}
export function PagePanel({ children, title, actions, className = '' }: { children: ReactNode; title?: string; actions?: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-xl border border-fd-border bg-fd-card p-4 md:p-5 ${className}`}>{title && <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{actions}</div>}{children}</section>
}
/** Menu metadata selects the layout; page code never owns the outer card or gutter. */
export function PageLayout({ page, children }: { page: Page; children: ReactNode }) {
  const { t } = useLanguage()
  const workspace = PAGES[page].layout === 'workspace'
  return <main aria-label={t('Page content')} className="fd-scroll min-h-0 min-w-0 flex-1 overflow-y-auto bg-fd-background p-4 md:p-5 lg:p-6"><div className={`mx-auto w-full min-w-0 max-w-7xl ${workspace ? 'flex h-full min-h-[32rem] flex-col gap-5' : 'min-h-full'}`}>{children}</div></main>
}

export function PageTabs<T extends string>({ id, label, items, value, onChange }: { id: string; label: string; items: readonly { id: T; name: string }[]; value: T; onChange: (value: T) => void }) {
  const { t } = useLanguage()
  return <div role="tablist" aria-label={t(label)} className="flex flex-wrap gap-1 border-b border-fd-border pb-2">{items.map(item => <button key={item.id} id={`${id}-tab-${item.id}`} type="button" role="tab" aria-selected={value === item.id} aria-controls={`${id}-panel-${item.id}`} onClick={() => onChange(item.id)} className={`rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-fd-primary ${value === item.id ? 'bg-fd-secondary font-medium' : 'text-fd-muted-foreground hover:bg-fd-secondary/50'}`}>{t(item.name)}</button>)}</div>
}

export function RefreshAction({ onRefresh, busy = false }: { onRefresh: () => void; busy?: boolean }) {
  const { t } = useLanguage()
  return <button type="button" aria-label={t(busy ? 'Refreshing…' : 'Refresh')} title={t('Refresh')} disabled={busy} onClick={onRefresh} className="flex h-8 w-8 items-center justify-center rounded-md text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-primary disabled:opacity-40"><svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={busy ? 'animate-spin motion-reduce:animate-none' : ''}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 18 17" /></svg></button>
}
