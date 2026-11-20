import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { expect, it, vi } from 'vitest'
import { RunsPage } from '../src/pages/RunsPage.tsx'
import { TaskList } from '../src/components/TaskList.tsx'
import type { SessionListEntry } from '../src/api/gateway.ts'
vi.mock('../src/components/TaskList.tsx', () => ({ TaskList: () => null }))
vi.mock('../src/components/TaskDetail.tsx', () => ({ TaskDetail: () => null }))
vi.mock('../src/api/gateway.ts', () => ({ pageSession: async () => ({ records: [], hasMore: false, cursor: null }), archiveRun: vi.fn(), restoreRun: vi.fn() }))
const entries: SessionListEntry[] = ['worker-example', 'session-example', 'orchestrator-example'].map((sessionId, index) => ({ sessionId, updatedAt: index, running: false }))
it('shows only Worker runs by default and all root runs when the filter is off', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(createElement(RunsPage, { entries, focusRunId: null, onRefresh: async () => {} })) })
  const list = () => renderer!.root.findByType(TaskList)
  expect(list().props.workersOnly).toBe(true)
  expect(list().props.entries.map((entry: SessionListEntry) => entry.sessionId)).toEqual(['worker-example'])
  act(() => { list().props.onToggleWorkers() })
  expect(list().props.entries).toHaveLength(3)
  act(() => { list().props.onToggleWorkers() })
  expect(list().props.entries).toHaveLength(1)
  act(() => { renderer!.unmount() })
})
it('opens a directly requested non-Worker run by revealing all runs', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(createElement(RunsPage, { entries, focusRunId: 'session-example', onRefresh: async () => {} })) })
  const list = renderer!.root.findByType(TaskList)
  expect(list.props.workersOnly).toBe(false)
  expect(list.props.selectedId).toBe('session-example')
  act(() => { renderer!.unmount() })
})
