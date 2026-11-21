import type { ComponentType, ReactNode } from 'react'
import type { SessionListEntry } from '../api/gateway.ts'
import { DashboardPage } from '../pages/DashboardPage.tsx'
import { RouterPage } from '../pages/RouterPage.tsx'
import { RunsPage } from '../pages/RunsPage.tsx'
import { SuperagentPage } from '../pages/SuperagentPage.tsx'
import { LaiAgentsPage } from '../pages/LaiAgentsPage.tsx'
import { FeishuToolsPage } from '../pages/FeishuToolsPage.tsx'
import { CredentialsPage } from '../pages/CredentialsPage.tsx'
import { SettingsPage } from '../pages/SettingsPage.tsx'
export type Page = 'router' | 'runs' | 'dashboard' | 'settings' | 'superagent' | 'lai-agents' | 'feishu-tools' | 'credentials'
export interface PageProps {
  entries: SessionListEntry[]
  focusRunId: string | null
  onOpenRun: (id: string) => void
  onNavigate: (page: Page) => void
  onRefresh: () => Promise<unknown>
}
export interface RouteDefinition {
  id: Page
  path: string
  component: ComponentType<PageProps>
  name: string
  hint: string
  icon: (active: boolean) => ReactNode
  order: number
  hideInMenu?: boolean
  group?: { id: string; name: string; order: number; icon: () => ReactNode }
  placement?: 'footer'
  layout?: 'workspace'
  badge?: 'running'
}
export type PageDefinition = RouteDefinition
export interface MenuGroup { id: string; name: string; order: number; icon: () => ReactNode; children: readonly RouteDefinition[] }
export type MenuItem = RouteDefinition | MenuGroup

const ICONS: { id: Page; icon: (active: boolean) => ReactNode }[] = [
  {
    id: 'dashboard',
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
    id: 'router',
    icon: () => <svg aria-hidden fill="none" height="18" width="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="4" width="5" height="5" rx="1" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><rect x="17" y="15" width="5" height="5" rx="1" /><path d="M7 6.5h5V9.5M14.5 12h5V15" /></svg>,
  },
  {
    id: 'runs',
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
    id: 'settings',
    icon: active => (
      <svg aria-hidden fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.6} viewBox="0 0 24 24" width="18">
        <circle cx="12" cy="12" r="3" />
        <path d="M12.00,4.00 L13.95,2.19 L15.83,2.76 L16.44,5.35 L17.66,6.34 L20.31,6.44 L21.24,8.17 L19.85,10.44 L20.00,12.00 L21.81,13.95 L21.24,15.83 L18.65,16.44 L17.66,17.66 L17.56,20.31 L15.83,21.24 L13.56,19.85 L12.00,20.00 L10.05,21.81 L8.17,21.24 L7.56,18.65 L6.34,17.66 L3.69,17.56 L2.76,15.83 L4.15,13.56 L4.00,12.00 L2.19,10.05 L2.76,8.17 L5.35,7.56 L6.34,6.34 L6.44,3.69 L8.17,2.76 L10.44,4.15 Z" />
      </svg>
    ),
  },
]


const pluginIcon = () => <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-6 6v4m-6-10H3m18 0h-3" /></svg>
const plugins = { id: 'plugins', name: 'Plugin', order: 40, icon: pluginIcon }
const primary = (id: Page) => ICONS.find(item => item.id === id)!

/** Single source for routes, navigation metadata, titles and page implementations. */
export const ROUTES: readonly RouteDefinition[] = [
  { ...primary('dashboard'), id: 'dashboard', path: '/', name: 'Dashboard', order: 10, hint: 'Monitor intake, Worker execution and specialist activity.', component: props => <DashboardPage entries={props.entries} onOpenRun={props.onOpenRun} onRouter={() => props.onNavigate('router')} onRuns={() => props.onNavigate('runs')} /> },
  { ...primary('router'), id: 'router', path: '/router', name: 'Router', order: 20, hint: 'Monitor / Router → Worker → five LAI subagents', component: props => <RouterPage entries={props.entries} onOpenRun={props.onOpenRun} onConfigure={() => props.onNavigate('superagent')} /> },
  { ...primary('runs'), id: 'runs', path: '/runs', name: 'Runs', hint: 'Run list, delegation activity, and results', order: 30, layout: 'workspace', badge: 'running', component: props => <RunsPage entries={props.entries} focusRunId={props.focusRunId} onRefresh={props.onRefresh} /> },
  { id: 'superagent', path: '/plugins/superagent', name: 'Superagent', hint: 'Monitor / Router → Worker → five LAI subagents', icon: pluginIcon, order: 10, group: plugins, component: SuperagentPage },
  { id: 'lai-agents', path: '/plugins/lai-agents', name: 'LAI Agents', hint: 'A Superagent Worker orchestrator with five specialist subagents. Monitor / Router prompts are configured in Plugin → Superagent. Prompts are stored in the independent lai-agents plugin.', icon: pluginIcon, order: 20, group: plugins, component: LaiAgentsPage },
  { id: 'feishu-tools', path: '/plugins/feishu-tools', name: 'Feishu tools', hint: 'Configure credentials for the standalone Feishu tool plugin. Select tools per role in LAI Agents; Superagent incoming Feishu sources are configured separately.', icon: pluginIcon, order: 30, group: plugins, component: FeishuToolsPage },
  { id: 'credentials', path: '/plugins/credentials', name: 'Credentials', hint: 'credentials_list lists authorized credential names; credentials_get retrieves plaintext by name. Configure credential authorization separately from agent tool selection.', icon: pluginIcon, order: 40, group: plugins, component: CredentialsPage },
  { ...primary('settings'), id: 'settings', path: '/settings', name: 'Settings', hint: 'Appearance, versions, models and plugin management', order: 50, placement: 'footer', component: SettingsPage },
]
export const PAGES = Object.fromEntries(ROUTES.map(route => [route.id, route])) as Record<Page, RouteDefinition>
const visible = ROUTES.filter(route => !route.hideInMenu).sort((a, b) => a.order - b.order)
export const FOOTER_MENU = visible.filter(route => route.placement === 'footer')
export const MENU: readonly MenuItem[] = (() => {
  const items: MenuItem[] = []
  for (const route of visible.filter(route => route.placement !== 'footer')) {
    if (!route.group) { items.push(route); continue }
    let group = items.find((item): item is MenuGroup => 'children' in item && item.id === route.group!.id)
    if (!group) { group = { ...route.group, children: [] }; items.push(group) }
    group.children = [...group.children, route]
  }
  return items.sort((a, b) => a.order - b.order)
})()
export const groupForPage = (page: Page) => PAGES[page].group
export const breadcrumbForPage = (page: Page): string[] => { const route = PAGES[page]; return [...(route.group ? [route.group.name] : []), route.name] }
/** Hash navigation keeps deep links compatible with the existing DSH static host. */
export const pageFromPath = (path: string): Page => ROUTES.find(route => route.path === path)?.id ?? 'dashboard'
export function PageRenderer({ page, ...props }: PageProps & { page: Page }) {
  const Implementation = PAGES[page].component
  return <Implementation {...props} />
}
