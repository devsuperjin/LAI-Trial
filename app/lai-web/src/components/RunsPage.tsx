import { useCallback, useEffect, useState } from 'react'
import type { PageResponse, SessionListEntry } from '../api/gateway.ts'
import { pageSession } from '../api/gateway.ts'
import { useInterval } from '../hooks/useInterval.ts'
import { TaskDetail } from './TaskDetail.tsx'
import { rootRuns } from '../model/runs.ts'
import { TaskList } from './TaskList.tsx'

export function RunsPage(props: { entries: SessionListEntry[]; focusRunId: string | null }) {
  const taskEntries = rootRuns(props.entries)
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row lg:gap-5">
      <TaskList entries={taskEntries} onSelect={setSelectedId} selectedId={selectedId} />
      <section aria-label="Run details" className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-xl border border-fd-border bg-fd-card">
        {selectedId === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-fd-muted-foreground">
            <svg aria-hidden className="opacity-40" fill="none" height="40" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" viewBox="0 0 24 24" width="40">
              <path d="M4 6h16M4 12h10M4 18h7" />
            </svg>
            <p className="text-sm">No runs yet — start a task in DSH or trigger the pipeline</p>
          </div>
        ) : (
          <DetailLoader
            key={selectedId}
            entries={props.entries}
            running={taskEntries.find(entry => entry.sessionId === selectedId)?.running ?? false}
            sessionId={selectedId}
          />
        )}
      </section>
    </div>
  )
}

function DetailLoader(props: { sessionId: string; running: boolean; entries: SessionListEntry[] }) {
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
  return <TaskDetail entries={props.entries} page={page} running={props.running} sessionId={props.sessionId} />
}
