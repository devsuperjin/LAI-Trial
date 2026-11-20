import type { ComponentProps, ReactNode } from 'react'
import { TopBar } from '../components/TopBar.tsx'
import { NavRail } from '../components/NavRail.tsx'
import { PageLayout } from './PageLayout.tsx'
import type { Page } from '../router/routes.tsx'
/** Shared chrome for every page, independent of business data and routing decisions. */
export function AppLayout({ topBar, page, onNavigate, gate, children }: { topBar: ComponentProps<typeof TopBar>; page: Page; onNavigate: (page: Page) => void; gate?: ReactNode; children: ReactNode }) {
  return <div className="flex h-full min-w-0 flex-col overflow-hidden"><TopBar {...topBar} /><div className="flex min-h-0 flex-1">{gate ?? <><NavRail page={page} onNavigate={onNavigate} runningCount={topBar.runningCount} /><PageLayout page={page}>{children}</PageLayout></>}</div></div>
}
