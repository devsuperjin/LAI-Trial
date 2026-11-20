import { useLanguage } from './i18n.tsx'
import { useCallback, useEffect, useState } from 'react'
import type { SessionListEntry } from './api/gateway.ts'
import { bootstrapWithToken, listSessions, UnauthorizedError } from './api/gateway.ts'
import { RouterPage } from './components/RouterPage.tsx'
import { DashboardPage } from './components/DashboardPage.tsx'
import { NavRail } from './components/NavRail.tsx'
import type { Page } from './components/NavRail.tsx'
import { RunsPage } from './components/RunsPage.tsx'
import { AgentPrompts } from './components/AgentPrompts.tsx'
import { SuperagentPage } from './components/SuperagentPage.tsx'
import { SettingsPage } from './components/SettingsPage.tsx'
import { TopBar } from './components/TopBar.tsx'
import { archivedRuns } from '@lai/dsh-adapter/runs'
import { rootRuns, withoutArchived } from './model/runs.ts'
import { useInterval } from './hooks/useInterval.ts'

export type AuthState = 'probing' | 'need-token' | 'ready'

export function App() {
  const { t } = useLanguage()
  const [auth, setAuth] = useState<AuthState>('probing')
  const [authError, setAuthError] = useState<string | null>(null)
  const [entries, setEntries] = useState<SessionListEntry[]>([])
  const [gatewayError, setGatewayError] = useState<string | null>(null)
  const [lastPollAt, setLastPollAt] = useState<number | null>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [focusRunId, setFocusRunId] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<'ok' | 'unauthorized' | 'unreachable'> => {
    try {
      const [{ items }, { archivedSessionIds }] = await Promise.all([listSessions(), archivedRuns()])
      setEntries(withoutArchived(items, archivedSessionIds))
      setGatewayError(null)
      setLastPollAt(Date.now())
      setAuth('ready')
      return 'ok'
    } catch (cause) {
      if (cause instanceof UnauthorizedError) {
        setAuth('need-token')
        return 'unauthorized'
      }
      setGatewayError(cause instanceof Error ? cause.message : String(cause))
      return 'unreachable'
    }
  }, [])

  useEffect(() => {
    const start = async (): Promise<void> => {
      const url = new URL(window.location.href)
      const urlToken = url.searchParams.get('token')
      if (urlToken !== null) {
        try {
          await bootstrapWithToken(urlToken)
        } catch {
          setAuthError('token bootstrap failed')
          setAuth('need-token')
          return
        }
        url.searchParams.delete('token')
        window.history.replaceState(null, '', url)
      }
      if ((await refresh()) === 'unauthorized') setAuth('need-token')
    }
    void start()
  }, [refresh])

  useInterval(() => { void refresh() }, auth === 'ready' ? 2000 : null)

  const submitToken = async (token: string): Promise<void> => {
    setAuthError(null)
    try {
      await bootstrapWithToken(token)
    } catch (cause) {
      setAuthError(cause instanceof Error ? cause.message : String(cause))
      return
    }
    if ((await refresh()) === 'unauthorized') setAuthError('token rejected by gateway')
  }

  const taskEntries = rootRuns(entries)
  const runningCount = taskEntries.filter(entry => entry.running).length

  const openRun = (id: string): void => {
    setFocusRunId(id)
    setPage('runs')
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <TopBar
        auth={auth}
        error={gatewayError}
        lastPollAt={lastPollAt}
        page={page}
        runningCount={runningCount}
        totalCount={taskEntries.length}
      />
      <div className="flex min-h-0 flex-1">
        {auth === 'need-token' ? (
          <TokenGate error={authError} onSubmit={token => void submitToken(token)} />
        ) : (
          <>
            <NavRail onNavigate={setPage} page={page} runningCount={runningCount} />
            <main aria-label={t("Page content")} className="fd-scroll min-h-0 min-w-0 flex-1 overflow-y-auto bg-fd-background p-3 md:p-5 lg:p-6">
              <div className={`${page === 'runs' ? 'flex h-full min-h-[28rem] flex-col' : page === 'settings' || page === 'dashboard' || page === 'lai-agents' ? 'min-h-full' : 'min-h-full rounded-xl border border-fd-border bg-fd-card'} min-w-0`}>
              {page === 'router' && <RouterPage entries={entries} onOpenRun={openRun} onConfigure={() => { setPage('superagent') }} />}
              {page === 'runs' && <RunsPage entries={entries} focusRunId={focusRunId} onRefresh={refresh} />}
              {page === 'dashboard' && <DashboardPage entries={entries} onOpenRun={openRun} onRouter={() => setPage('router')} onConfigure={() => setPage('superagent')} />}
              {page === 'superagent' && <SuperagentPage />}
              {page === 'lai-agents' && <AgentPrompts />}
              {page === 'settings' && <SettingsPage />}
              </div>
            </main>
          </>
        )}
      </div>
    </div>
  )
}

function TokenGate(props: { error: string | null; onSubmit: (token: string) => void }) {
  const { t } = useLanguage()
  const [token, setToken] = useState('')
  return (
    <div className="flex w-full items-center justify-center">
      <form
        className="w-96 rounded-xl border border-fd-border bg-fd-card p-6"
        onSubmit={(event) => { event.preventDefault(); props.onSubmit(token.trim()) }}
      >
        <h1 className="mb-2 text-lg font-semibold">{t("Gateway token required")}</h1>
        <p className="mb-4 text-sm text-fd-muted-foreground">{t("Paste the")}<code className="text-fd-foreground">{t("--token")}</code>{t("value printed by the dsh web server to authorize LAI Web.")}</p>
        <input
          autoFocus
          className="mb-3 w-full rounded-md border border-fd-border bg-fd-muted px-3 py-2 font-mono text-sm outline-none focus:border-fd-primary"
          onChange={(event) =>{  setToken(event.target.value) }}
          placeholder={t("gateway access token")}
          type="password"
          value={token}
        />
        {props.error !== null && <p className="mb-3 text-sm text-fd-danger">{props.error}</p>}
        <button className="w-full rounded-md bg-fd-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90" type="submit">{t("Connect")}</button>
      </form>
    </div>
  )
}
