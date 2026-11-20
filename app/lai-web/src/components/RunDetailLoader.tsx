import { useCallback, useEffect, useState } from 'react'
import type { PageResponse, SessionListEntry } from '../api/gateway.ts'
import { pageSession } from '../api/gateway.ts'
import { useInterval } from '../hooks/useInterval.ts'
import { TaskDetail } from './TaskDetail.tsx'

export function RunDetailLoader(props: { sessionId: string; running: boolean; entries: SessionListEntry[]; onDelete?: () => void; deleting?: boolean; title?: string; hideResult?: boolean }) {
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
  return <TaskDetail hideResult={props.hideResult} title={props.title} onDelete={props.onDelete} deleting={props.deleting} entries={props.entries} page={page} running={props.running} sessionId={props.sessionId} />
}
