import type { ReactNode } from 'react'

export type Page = 'pipeline' | 'history' | 'runs' | 'dashboard' | 'settings'

const ITEMS: { id: Page; label: string; hint: string; icon: (active: boolean) => ReactNode }[] = [
  {
    id: 'pipeline', label: '流水线', hint: '模拟事件与六阶段执行',
    icon: () => <svg aria-hidden fill="none" height="18" width="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="4" width="5" height="5" rx="1" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><rect x="17" y="15" width="5" height="5" rx="1" /><path d="M7 6.5h5V9.5M14.5 12h5V15" /></svg>,
  },
  { id: 'history', label: '执行记录', hint: '查看流水线历史与阶段输出', icon: () => <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 5h16M4 12h16M4 19h16" /></svg> },
  {
    id: 'runs',
    label: '会话',
    hint: 'All DSH sessions and their agent activity',
    icon: active => (
      <svg aria-hidden fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.6} viewBox="0 0 24 24" width="18">
        <circle cx="5" cy="6" r="2.2" />
        <circle cx="5" cy="18" r="2.2" />
        <circle cx="19" cy="12" r="2.2" />
        <path d="M7.2 6h4.3a3 3 0 0 1 3 3v0a3 3 0 0 0 3 3h-.5" />
        <path d="M7.2 18h4.3a3 3 0 0 0 3-3v0a3 3 0 0 1 3-3h-.5" />
      </svg>
    ),
  },
  {
    id: 'dashboard',
    label: '概览',
    hint: 'Run classification & metrics',
    icon: active => (
      <svg aria-hidden fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.6} viewBox="0 0 24 24" width="18">
        <rect height="7" rx="1.4" width="7" x="3.5" y="3.5" />
        <rect height="7" rx="1.4" width="7" x="13.5" y="3.5" />
        <rect height="7" rx="1.4" width="7" x="3.5" y="13.5" />
        <rect height="7" rx="1.4" width="7" x="13.5" y="13.5" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: '设置',
    hint: 'Per-agent model configuration',
    icon: active => (
      <svg aria-hidden fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.6} viewBox="0 0 24 24" width="18">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
      </svg>
    ),
  },
]

export function NavRail(props: { page: Page; onNavigate: (page: Page) => void; runningCount: number }) {
  return (
    <nav aria-label="主导航" className="flex w-16 shrink-0 flex-col border-r border-fd-border bg-fd-card p-2 md:w-52 md:p-4">
      <div className="mb-8 flex h-10 items-center gap-3 px-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-fd-primary text-sm font-semibold text-white">L</span><div className="hidden md:block"><p className="text-sm font-semibold">LAI</p><p className="text-[11px] text-fd-muted-foreground">Agent workspace</p></div></div>
      <p className="mb-2 hidden px-3 text-[10px] font-medium uppercase tracking-widest text-fd-muted-foreground md:block">工作空间</p>
      <div className="space-y-1">{ITEMS.filter(item => item.id !== 'dashboard' && item.id !== 'settings').map(item => renderItem(item))}</div>
      <div className="mt-auto border-t border-fd-border pt-3">{renderItem(ITEMS.find(item => item.id === 'settings')!)}</div>
      <a className="mt-2 hidden px-3 py-2 text-xs text-fd-muted-foreground hover:text-fd-foreground md:block" href="/dsh/" target="_blank" rel="noopener noreferrer">原版 DSH 调试 ↗</a>
    </nav>
  )
  function renderItem(item: typeof ITEMS[number]) {
    const active = props.page === item.id
    return <button key={item.id} type="button" title={item.hint} aria-label={item.label} aria-current={active ? 'page' : undefined} onClick={() => props.onNavigate(item.id)} className={`flex min-h-10 w-full items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-fd-primary md:justify-start ${active ? 'bg-fd-primary/10 font-medium text-fd-primary' : 'text-fd-muted-foreground hover:bg-fd-secondary hover:text-fd-foreground'}`}>
      <span className="shrink-0">{item.icon(active)}</span><span className="hidden md:block">{item.label}</span>
      {item.id === 'runs' && props.runningCount > 0 && <span className="ml-auto hidden rounded bg-fd-secondary px-1.5 text-xs tabular-nums md:block">{props.runningCount}</span>}
    </button>
  }
}
