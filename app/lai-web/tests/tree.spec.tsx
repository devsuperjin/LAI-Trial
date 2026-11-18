import { expect, it } from 'vitest'
import { deriveTree } from '../src/model/tree.ts'
import type { PageResponse, WireEvent } from '../src/api/gateway.ts'

it('groups assistant steps and tool results into their owning turns', () => {
  const event = (seq: number, type: string, data = {}): WireEvent => ({ seq, type, time: seq, data })
  const events = [
    event(1, 'turn/start'),
    event(2, 'assistant/message', { message: { content: [{ type: 'text', text: 'Checking' }] } }),
    event(3, 'tool/call', { id: 'read-1', name: 'read_file', arguments: { path: 'failure.log' } }),
    event(4, 'tool/result', { message: { toolCallId: 'read-1', content: [{ type: 'text', text: 'failure evidence' }] } }),
    event(5, 'assistant/message', { message: { content: [{ type: 'text', text: 'Diagnosis' }] } }),
    event(6, 'turn/end'), event(7, 'turn/start'),
    event(8, 'tool/call', { id: 'run-1', name: 'shell' }),
    event(9, 'tool/result', { message: { toolCallId: 'run-1', isError: true } }),
    event(10, 'turn/end'),
  ]
  const tree = deriveTree({ records: events.map(event => ({ type: 'event', event })), hasMore: false, cursor: null } as PageResponse, [], 'root')
  expect(tree.steps).toHaveLength(2)
  expect(tree.steps[0]?.preview).toBe('Diagnosis')
  expect(tree.steps[0]?.tools[0]).toMatchObject({ name: 'read_file', result: 'failure evidence', isError: false })
  expect(tree.steps[1]).toMatchObject({ turn: 2, isError: true })
})

it('matches native callId receipts to the reproduction child without a stage-zero duplicate', () => {
  const events: WireEvent[] = [
    { seq: 1, time: 1, type: 'tool/call', data: { callId: 'native-call', name: 'reproduce', arguments: { description: 'Reproduce' } } },
    { seq: 2, time: 2, type: 'tool/result', data: { message: { toolCallId: 'native-call', content: [{ type: 'text', text: 'started subagent repro-child' }] } } },
  ]
  const tree = deriveTree({ records: events.map(event => ({ type: 'event', event })), hasMore: false, cursor: null }, [
    { sessionId: 'repro-child', parentSessionId: 'parent', running: false, updatedAt: 2, projections: { kind: 'cached', values: { agentPreset: 'iqe-reproduction', title: 'You are the IQE reproduction agent' } } },
  ], 'parent')
  expect(tree.children).toHaveLength(1)
  expect(tree.children[0]).toMatchObject({ stage: 3, delegation: { id: 'native-call', toolName: 'reproduce' } })
  expect(tree.delegations[0]?.settled).toContain('repro-child')
  expect(tree.delegations.every(delegation => tree.children.some(child => child.delegation?.id === delegation.id))).toBe(true)
})
