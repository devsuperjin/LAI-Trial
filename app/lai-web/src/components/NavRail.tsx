import { motion } from 'motion/react'
import type { ReactNode } from 'react'

export type Page = 'runs' | 'dashboard' | 'settings'

const ITEMS: { id: Page; label: string; hint: string; icon: (active: boolean) => ReactNode }[] = [
  {
    id: 'runs',
    label: 'Runs',
    hint: 'Task list & pipeline DAG',
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
    label: 'Dashboard',
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
    label: 'Settings',
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
    <nav aria-label="Primary" className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-fd-border bg-fd-card py-3">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-fd-primary to-[var(--fd-stage-3)] text-white shadow-[0_0_18px_-2px_var(--color-fd-primary)]">
        <svg aria-hidden fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20">
          <path d="M12 3l7 4v5c0 4.4-3 8-7 9-4-1-7-4.6-7-9V7z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>
      {ITEMS.map((item) => {
        const active = props.page === item.id
        return (
          <button
            aria-current={active ? 'page' : undefined}
            className={`group relative flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-xl transition-colors ${active ? 'text-fd-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground'}`}
            key={item.id}
            onClick={() => { props.onNavigate(item.id) }}
            title={item.hint}
            type="button"
          >
            {active && (
              <motion.span
                className="absolute inset-0 rounded-xl border border-fd-primary/30 bg-fd-primary/10"
                layoutId="nav-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{item.icon(active)}</span>
            <span className="relative text-[10px] leading-none">{item.label}</span>
            {item.id === 'runs' && props.runningCount > 0 && (
              <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-fd-primary px-1 text-[9px] font-medium text-white">
                {props.runningCount}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
