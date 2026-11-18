import { expect, it } from 'vitest'
import { rootRuns } from '../src/model/runs.ts'
import { deriveDashboard } from '../src/model/dashboard.ts'
import { deriveDag } from '../src/model/dag.ts'
import type { SessionListEntry } from '../src/api/gateway.ts'

it('includes ordinary Web and MQ root runs while excluding blank drafts and child sessions', () => {
  const entries: SessionListEntry[] = [
    { sessionId: 'session-web', updatedAt: 1, running: false, blank: false },
    { sessionId: 'mq-task', updatedAt: 2, running: false },
    { sessionId: 'draft', updatedAt: 3, running: false, blank: true },
    { sessionId: 'just-started', updatedAt: 4, running: true, blank: true },
    { sessionId: 'child', parentSessionId: 'session-web', updatedAt: 5, running: true },
  ]
  expect(rootRuns(entries).map(entry => entry.sessionId)).toEqual(['session-web', 'mq-task', 'just-started'])
  expect(deriveDashboard(entries).totals.runs).toBe(3)
  expect(deriveDashboard(entries).totals.subagents).toBe(1)
})

it('uses the ordinary user request as the Web run title', () => {
  expect(deriveDag([{ type: 'user/message', seq: 1, time: 1, data: { content: [{ type: 'text', text: 'List available agents' }], source: { kind: 'user' } } }]).taskLabel).toBe('List available agents')
})

it('keeps an idle parent run live while its subagent is running', () => {
  const parent = { sessionId: 'web-parent', updatedAt: 1, running: false, blank: false }
  const rows = rootRuns([parent, { sessionId: 'child', parentSessionId: parent.sessionId, updatedAt: 2, running: true }])
  expect(rows).toEqual([{ ...parent, running: true }])
  expect(parent.running).toBe(false)
})
