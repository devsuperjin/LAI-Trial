import { expect, it } from 'vitest'
import { PipelineEngine } from '../src/engine.ts'
import { ROLE_ORDER } from '../src/types.ts'
import type { PipelineDriver, PipelineStore, Role } from '../src/types.ts'

it.each(['APPROVE', 'REJECT'])('passes evidence through all stages and preserves reviewer %s', async decision => {
  const seen: Role[] = []
  const driver: PipelineDriver = {
    async initialize() {}, workers: () => [], async dispose() {},
    async execute(role, context) {
      expect(context.previous.map(item => item.role)).toEqual(seen)
      seen.push(role)
      return { text: role === 'review' ? `Decision: ${decision}` : `Evidence from ${role}`, sessionId: role, startSeq: 0, endSeq: 1 }
    },
  }
  const store: PipelineStore = { async load() { return { version: 1, runs: [] } }, async save() {}, async prepare() { return ['/tmp/fixture.log'] }, async stage() {} }
  const engine = new PipelineEngine(driver, store, '/tmp/lai-pipeline', 10)
  await engine.initialize()
  const source = engine.registerSource({ id: 'fixture', name: 'Fixture', simulated: true, description: 'Local fixture', cases: [] })
  await source.submit({ id: 'event-1', type: 'ci.failure', title: 'Failure', summary: 'Synthetic failure', evidence: [{ name: 'fixture.log', content: 'fail' }] })
  await engine.whenIdle()
  expect(seen).toEqual(ROLE_ORDER)
  expect(engine.snapshot().runs[0]).toMatchObject({ status: decision === 'APPROVE' ? 'completed' : 'needs-review', reviewDecision: decision })
  await engine.dispose()
})

it('does not start the next specialist until the previous result has settled', async () => {
  const { vi } = await import('vitest')
  const started: Role[] = []
  const gates = new Map<Role, () => void>()
  const driver: PipelineDriver = {
    async initialize() {}, workers: () => [], async dispose() {},
    async execute(role) {
      started.push(role)
      await new Promise<void>(resolve => { gates.set(role, resolve) })
      return { text: role === 'review' ? 'Decision: APPROVE' : role, sessionId: role, startSeq: 0, endSeq: 1 }
    },
  }
  const store: PipelineStore = { async load() { return { version: 1, runs: [] } }, async save() {}, async prepare() { return [] }, async stage() {} }
  const engine = new PipelineEngine(driver, store, '/tmp/lai-order', 10)
  await engine.initialize()
  const source = engine.registerSource({ id: 'fixture', name: 'Fixture', simulated: true, description: 'Local', cases: [] })
  await source.submit({ id: 'order', type: 'ci.failure', title: 'Order', summary: 'Local', evidence: [] })
  const expected: Role[] = ['monitor', 'triage', 'reproduce', 'ticket', 'review', 'report']
  for (const [index, role] of expected.entries()) {
    await vi.waitFor(() => expect(gates.has(role)).toBe(true), { interval: 1 })
    expect(started).toEqual(expected.slice(0, index + 1))
    expect(engine.snapshot().runs[0]?.stages.slice(index + 1).every(stage => stage.status === 'pending')).toBe(true)
    gates.get(role)!()
  }
  await engine.whenIdle()
  expect(engine.snapshot().runs[0]?.status).toBe('completed')
  await engine.dispose()
})
