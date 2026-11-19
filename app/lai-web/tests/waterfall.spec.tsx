import { expect, it } from 'vitest'
import type { WireEvent } from '../src/api/gateway.ts'
import { flattenTiming, ownChildEvents, sessionTiming, timingDomain, timingEnd } from '../src/model/waterfall.ts'
const event = (seq: number, time: number, type: string, data: Record<string, unknown> = {}): WireEvent => ({ seq, time, type, data })

it('pairs concurrent tools by call id and keeps them inside their owning Turn', () => {
  const root = sessionTiming({ id: 'root', label: 'Worker', running: false, events: [
    event(1, 1000, 'turn/start'), event(2, 1100, 'tool/call', { callId: 'a', name: 'read' }),
    event(3, 1200, 'tool/call', { callId: 'b', name: 'search' }),
    event(4, 1500, 'tool/result', { message: { toolCallId: 'b', isError: true } }),
    event(5, 1800, 'tool/result', { message: { toolCallId: 'a' } }),
    event(6, 2000, 'turn/end', { reason: { kind: 'completed' } }),
  ] })!
  expect(root).toMatchObject({ start: 1000, end: 2000, status: 'completed' })
  expect(root.children).toHaveLength(1)
  expect(root.children[0]!.children.map(span => [span.label, span.start, span.end, span.status])).toEqual([
    ['read', 1100, 1800, 'completed'], ['search', 1200, 1500, 'failed'],
  ])
  expect(flattenTiming(root, new Set(['root']))).toHaveLength(2)
  expect(flattenTiming(root, new Set(), 'tool')).toHaveLength(2)
})

it('does not invent missing terminal times and extends only active work', () => {
  const events = [event(4, 4000, 'tool/call', { callId: 'a', name: 'read' })]
  const settled = sessionTiming({ id: 'root', label: 'Worker', running: false, partial: true, events })!
  expect(settled.end).toBeNull()
  expect(settled.children[0]).toMatchObject({ partial: true, status: 'unknown' })
  expect(timingEnd(settled.children[0]!, 9000)).toBe(4000)
  const active = sessionTiming({ id: 'root', label: 'Worker', running: true, events })!
  expect(timingEnd(active.children[0]!.children[0]!, 9000)).toBe(9000)
})

it('shows native child execution on the shared clock without borrowed parent events', () => {
  const events = [event(1, 1000, 'turn/start'), event(2, 2000, 'turn/end', { reason: { kind: 'completed' } }), event(3, 1500, 'subagent/descriptor'), event(4, 1600, 'turn/start'), event(5, 4500, 'turn/end', { reason: { kind: 'completed' } })]
  const own = ownChildEvents(events, { sessionId: 'child', running: false, updatedAt: 4500, projections: { kind: 'cached', values: { subagent: { seq: 3 } } } })
  expect(own.map(e => e.seq)).toEqual([3, 4, 5])
  const root = sessionTiming({ id: 'root', label: 'Worker', running: false, events: events.slice(0, 2) })!
  root.children.push(sessionTiming({ id: 'child', label: 'Triage', running: false, child: true, startedAt: 1500, events: own })!)
  expect(timingDomain(root, 9000)).toEqual({ start: 1000, end: 4500, duration: 3500 })
  expect(root.children.at(-1)?.children).toHaveLength(1)
})
