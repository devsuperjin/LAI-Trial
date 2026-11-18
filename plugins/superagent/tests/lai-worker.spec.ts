import { describe, expect, it } from 'vitest'
import { LAI_STAGES, stageAdmission } from '../src/app/lai-worker.ts'

describe('LAI pipeline inside a Superagent Worker', () => {
  it('admits exactly one stage at a time in the required order', () => {
    const completed: { completed: boolean; failed: boolean }[] = []
    for (const stage of LAI_STAGES) {
      expect(stageAdmission(stage, completed)).toBeUndefined()
      expect(stageAdmission('ready', completed)).toContain('five')
      for (const other of LAI_STAGES.filter(name => name !== stage)) expect(stageAdmission(other, completed)).toBeDefined()
      expect(stageAdmission(stage, [...completed, { completed: false, failed: false }])).toContain('Wait')
      completed.push({ completed: true, failed: false })
    }
    expect(stageAdmission('ready', completed)).toBeUndefined()
    for (const stage of LAI_STAGES) expect(stageAdmission(stage, completed)).toBeDefined()
  })
  it('blocks subsequent stages and ready reports after failure or cancellation', () => {
    for (const stage of [...LAI_STAGES, 'ready']) expect(stageAdmission(stage, [{ completed: false, failed: true }])).toContain('failed')
  })
})

it('reserves an admitted call until its result and restores progress from native child history', async () => {
  const { installLaiWorker } = await import('../src/app/lai-worker.ts')
  const handlers = new Map<string, (...args: any[]) => any>()
  const children: { id: string; createdAt: number }[] = []
  const agents = new Map<string, any>()
  const agent = { session: { id: 'worker-fixture' }, ctx: { on: (name: string, handler: (...args: any[]) => any) => { handlers.set(name, handler); return () => { handlers.delete(name) } } } }
  const ctx = { agents, subagents: { listChildren: async () => children } }
  const dispose = installLaiWorker(ctx as never, agent as never, () => 0)
  const call = (name: string) => ({ name, token: Symbol(name), signal: new AbortController().signal })
  const triage = call('triage')
  const next = async () => ({ kind: 'allow' })
  expect((await handlers.get('tools/pre-execute')!(call('subagent'), next)).kind).toBe('deny')
  expect(await handlers.get('tools/pre-execute')!(triage, next)).toEqual({ kind: 'allow' })
  // The scheduler may prepare a second call before dispatching the first.
  expect((await handlers.get('tools/pre-execute')!(call('triage'), next)).kind).toBe('deny')
  handlers.get('tools/result')!(triage)
  children.push({ id: 'child-triage', createdAt: 1 })
  agents.set('child-triage', { status: 'running', session: { snapshotEvents: () => [] } })
  expect((await handlers.get('tools/pre-execute')!(call('reproduce'), next)).kind).toBe('deny')
  agents.set('child-triage', { status: 'idle', session: { snapshotEvents: () => [{ type: 'turn/end', data: { reason: { kind: 'completed' } } }] } })
  dispose()
  const disposeRestored = installLaiWorker(ctx as never, agent as never, () => 0)
  expect((await handlers.get('tools/pre-execute')!(call('triage'), next)).kind).toBe('deny')
  expect((await handlers.get('tools/pre-execute')!(call('reproduce'), next)).kind).toBe('allow')
  disposeRestored()
})
