import { useLanguage } from './i18n.tsx'
import { useCallback, useEffect, useState } from 'react'
import type { SessionListEntry } from './api/gateway.ts'
import { bootstrapWithToken, listSessions, UnauthorizedError } from './api/gateway.ts'
import { PAGES, pageFromPath, PageRenderer, type Page } from './router/routes.tsx'
import { AppLayout } from './layout/AppLayout.tsx'
import { archivedRuns } from '@lai/dsh-adapter/runs'
import { rootRuns, withoutArchived } from './model/runs.ts'
import { useInterval } from './hooks/useInterval.ts'

export type AuthState = 'probing' | 'need-token' | 'ready'

export function App() {
  const [auth, setAuth] = useState<AuthState>('probing')
  const [authError, setAuthError] = useState<string | null>(null)
  const [entries, setEntries] = useState<SessionListEntry[]>([])
  const [gatewayError, setGatewayError] = useState<string | null>(null)
  const [lastPollAt, setLastPollAt] = useState<number | null>(null)
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.hash.slice(1) || '/'))
  const navigate = (next: Page): void => { setPage(next); window.location.hash = PAGES[next].path }
  useEffect(() => {
    const sync = () => setPage(pageFromPath(window.location.hash.slice(1) || '/'))
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
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
    navigate('runs')
  }

  return <AppLayout
    page={page}
    onNavigate={navigate}
    topBar={{ auth, error: gatewayError, lastPollAt, page, runningCount, totalCount: taskEntries.length }}
    gate={auth === 'need-token' ? <TokenGate error={authError} onSubmit={token => void submitToken(token)} /> : undefined}
  >
    <PageRenderer page={page} entries={entries} focusRunId={focusRunId} onOpenRun={openRun} onNavigate={navigate} onRefresh={refresh} />
  </AppLayout>
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
