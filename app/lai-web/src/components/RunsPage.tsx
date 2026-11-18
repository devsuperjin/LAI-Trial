import { useLanguage } from '../i18n.tsx'
import { useCallback, useEffect, useState } from 'react'
import type { PageResponse, SessionListEntry } from '../api/gateway.ts'
import { pageSession, archiveRun, restoreRun } from '../api/gateway.ts'
import { useInterval } from '../hooks/useInterval.ts'
import { TaskDetail } from './TaskDetail.tsx'
import { rootRuns } from '../model/runs.ts'
import { TaskList } from './TaskList.tsx'

export function RunsPage(props: { entries: SessionListEntry[]; focusRunId: string | null; onRefresh: () => Promise<unknown> }) {
  const { t } = useLanguage()
  const [removed, setRemoved] = useState<string[]>([])
  const [undoId, setUndoId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const taskEntries = rootRuns(props.entries).filter(entry => !removed.includes(entry.sessionId))
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (props.focusRunId !== null && taskEntries.some(entry => entry.sessionId === props.focusRunId)) {
      setSelectedId(props.focusRunId)
    }
  }, [props.focusRunId, taskEntries])

  useEffect(() => {
    setSelectedId((current) => {
      if (current !== null && taskEntries.some(entry => entry.sessionId === current)) return current
      const newest = [...taskEntries].sort((a, b) => b.updatedAt - a.updatedAt).at(0)
      return newest?.sessionId ?? null
    })
  }, [taskEntries])

  const deleteSelected = async (): Promise<void> => {
    if (!selectedId || taskEntries.find(entry => entry.sessionId === selectedId)?.running) return
    setDeleting(true); setError(null)
    try {
      await archiveRun(selectedId)
      setRemoved(ids => [...ids, selectedId]); setUndoId(selectedId)
      await props.onRefresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setDeleting(false) }
  }
  const undo = async (): Promise<void> => {
    if (!undoId) return
    setDeleting(true); setError(null)
    try {
      await restoreRun(undoId)
      setRemoved(ids => ids.filter(id => id !== undoId)); setSelectedId(undoId); setUndoId(null)
      await props.onRefresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setDeleting(false) }
  }
  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-4 md:flex-row lg:gap-5">
      <TaskList entries={taskEntries} onSelect={setSelectedId} selectedId={selectedId} />
      <section aria-label={t("Run details")} className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
        {selectedId === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-fd-muted-foreground">
            <svg aria-hidden className="opacity-40" fill="none" height="40" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24" width="40">
              <path d="M4 6h16M4 12h10M4 18h7" />
            </svg>
            <p className="text-sm">{t("No runs yet — start a task in DSH or trigger the pipeline")}</p>
          </div>
        ) : (
          <DetailLoader
            onDelete={() => { void deleteSelected() }}
            deleting={deleting}
            key={selectedId}
            entries={props.entries}
            running={taskEntries.find(entry => entry.sessionId === selectedId)?.running ?? false}
            sessionId={selectedId}
          />
        )}
      </section>
      {(undoId || error) && <div role="status" className="absolute bottom-4 right-4 z-20 flex max-w-sm items-center gap-4 rounded-lg border border-fd-border bg-fd-card px-4 py-3 text-sm shadow-lg">
        <span className={error ? 'text-fd-danger' : ''}>{error ?? t('Run removed.')}</span>
        {undoId && <button type="button" disabled={deleting} className="font-medium text-fd-primary disabled:opacity-50" onClick={() => { void undo() }}>{t('Undo')}</button>}
      </div>}
    </div>
  )
}

function DetailLoader(props: { sessionId: string; running: boolean; entries: SessionListEntry[]; onDelete: () => void; deleting: boolean }) {
  const [page, setPage] = useState<PageResponse | null>(null)
  const load = useCallback(async (): Promise<void> => {
    try {
      setPage(await pageSession(props.sessionId, 200))
    } catch {
      // keep the previous page; list polling surfaces auth problems
    }
  }, [props.sessionId])
  useEffect(() => { void load() }, [load])
  useInterval(() => { void load() }, props.running ? 2000 : null)
  // The final events land after the last running poll; refetch once when the task settles.
  useEffect(() => {
    if (!props.running) void load()
  }, [props.running, load])
  return <TaskDetail onDelete={props.onDelete} deleting={props.deleting} entries={props.entries} page={page} running={props.running} sessionId={props.sessionId} />
}
