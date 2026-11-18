import { LanguageSwitch, useLanguage } from '../i18n.tsx'
import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { AuthState } from '../App.tsx'
import type { Page } from './NavRail.tsx'

function authLabel(auth: AuthState): string {
  if (auth === 'ready') return 'Live'
  return 'Connecting…'
}

const PAGE_TITLE: Record<Page, string> = {
  pipeline: 'Pipeline',
  history: 'History',
  runs: 'Runs',
  dashboard: 'Dashboard',
  settings: 'Settings',
}

type Theme = 'dark' | 'light'

const THEME_KEY = 'dsh-console-theme'

function storedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    // Storage can be blocked in private browsing; start dark.
    return 'dark'
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(storedTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Storage can be blocked in private browsing; the choice still applies for this visit.
    }
  }, [theme])
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const label = `Switch to ${next} theme`
  return (
    <button
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-fd-border bg-fd-secondary text-fd-muted-foreground transition-colors hover:text-fd-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-fd-primary"
      onClick={() => { setTheme(next) }}
      title={label}
      type="button"
    >
      <motion.span
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        className="flex"
        initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
        key={theme}
        transition={{ duration: 0.25 }}
      >
        {theme === 'dark' ? (
          <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </svg>
        ) : (
          <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </motion.span>
    </button>
  )
}

export function TopBar(props: {
  auth: AuthState
  error: string | null
  lastPollAt: number | null
  page: Page
  runningCount: number
  totalCount: number
}) {
  const { t } = useLanguage()
  const live = props.auth === 'ready' && props.error === null
  const right = live
    ? `Live · polled ${props.lastPollAt !== null ? new Date(props.lastPollAt).toLocaleTimeString([], { hour12: false }) : ''}`
    : props.error ?? authLabel(props.auth)
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-fd-border bg-fd-card px-4 md:px-5">
      <div className="flex w-8 shrink-0 items-center gap-3 md:w-[172px]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fd-primary text-base font-semibold text-white">{t("L")}</span>
        <div className="hidden min-w-0 md:block"><p className="text-sm font-semibold tracking-wide">{t("LAI")}</p><p className="text-[11px] text-fd-muted-foreground">{t("Agent workspace")}</p></div>
      </div>
      <div className="flex min-w-0 items-center gap-3 text-sm"><span className="hidden text-fd-border sm:inline" aria-hidden>/</span><span className="truncate font-medium">{t(PAGE_TITLE[props.page])}</span></div>
      <div className="ml-auto flex items-center gap-3 text-xs md:gap-5 text-fd-muted-foreground">
        <span className="hidden lg:inline">{props.runningCount}{t(" running · ")}{props.totalCount}{t(" runs")}</span>
        <span title={right} className="flex items-center gap-1.5">
          <motion.span
            animate={live ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
            className={`h-2 w-2 rounded-full ${live ? 'bg-fd-success' : 'bg-fd-warning'}`}
            transition={live ? { duration: 2, repeat: Infinity } : undefined}
          />
          {t(live ? 'Connected' : 'Connecting…')}
        </span>
        <a className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-fd-border px-2.5 py-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-secondary hover:text-fd-foreground focus-visible:outline-2 focus-visible:outline-fd-primary" href="/dsh/" target="_blank" rel="noopener noreferrer" title={t("Open the original DSH debugging interface")}><span className="hidden sm:inline">{t("Original DSH")}</span><span className="sm:hidden">{t("DSH")}</span><span aria-hidden>↗</span></a>
        <LanguageSwitch />
        <ThemeToggle />
      </div>
    </header>
  )
}
