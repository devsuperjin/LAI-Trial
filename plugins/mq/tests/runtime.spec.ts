import { Context } from '@deepseek-ai/cordis'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { describe, expect, it, vi } from 'vitest'
import MqRuntime, { MemoryQueueBackend } from '../src/index.ts'
import { ScriptedAdapter, textResponse } from './scripted-adapter.ts'

/** Mount the real loop plus the runtime over a stub workspace registry. */
async function harness(adapter: ScriptedAdapter, config?: { maxParallelTasks?: number; taskTimeoutMs?: number; agentPreset?: string }) {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentLoop, { agents: [] })
  ctx.llm.registerAdapter(['mock'], adapter)
  const attached: string[] = []
  const detached: string[] = []
  ctx.provide('workspaceRegistry' as never, {
    create: (path: string) => Promise.resolve({
      path,
      attachSession: (id: string) => {
        attached.push(id)
        return Promise.resolve()
      },
      detachSession: (id: string) => {
        detached.push(id)
        return Promise.resolve()
      },
    }),
  } as never)
  await ctx.plugin(MqRuntime, {
    workspacePath: '/tmp/mq-runtime-test',
    provider: 'mock',
    model: 'test-model',
    taskTimeoutMs: 5000,
    ...config,
  })
  return { ctx, attached, detached }
}

describe('MqRuntime over the real agent loop', () => {
  it('runs one task to completion and publishes the settled result', async () => {
    const { ctx, attached, detached } = await harness(new ScriptedAdapter([textResponse('the answer')]))
    try {
      const backend = new MemoryQueueBackend()
      const unregister = ctx.mqRuntime.registerBackend(backend)
      backend.produce({ id: 't1', prompt: 'answer me', title: 'Test task' })
      await vi.waitFor(() => {
        expect(backend.results).toHaveLength(1)
      }, { timeout: 10_000 })
      const result = backend.results[0]!
      expect(result.ok).toBe(true)
      expect(result.taskId).toBe('t1')
      expect(result.text).toBe('the answer')
      expect(result.sessionId).toMatch(/^mq-/)
      expect(attached).toEqual([result.sessionId])
      expect(detached).toEqual([result.sessionId])
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('settles tasks in order under a single slot', async () => {
    const { ctx } = await harness(new ScriptedAdapter([textResponse('one'), textResponse('two')]))
    try {
      const backend = new MemoryQueueBackend()
      const unregister = ctx.mqRuntime.registerBackend(backend)
      backend.produce({ id: 'first', prompt: '1' })
      backend.produce({ id: 'second', prompt: '2' })
      await vi.waitFor(() => {
        expect(backend.results).toHaveLength(2)
      }, { timeout: 10_000 })
      expect(backend.results.map(result => [result.taskId, result.text])).toEqual([
        ['first', 'one'],
        ['second', 'two'],
      ])
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('publishes a failure result when the model request fails', async () => {
    const { ctx } = await harness(new ScriptedAdapter([]))
    try {
      const backend = new MemoryQueueBackend()
      const unregister = ctx.mqRuntime.registerBackend(backend)
      backend.produce({ id: 'broken', prompt: 'fail' })
      await vi.waitFor(() => {
        expect(backend.results).toHaveLength(1)
      }, { timeout: 10_000 })
      const result = backend.results[0]!
      expect(result.ok).toBe(false)
      expect(result.error).toContain('script exhausted')
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('cancels a hanging task at its timeout and reports the cancellation', async () => {
    const { ctx } = await harness(new ScriptedAdapter(['hang']), { taskTimeoutMs: 200 })
    try {
      const backend = new MemoryQueueBackend()
      const unregister = ctx.mqRuntime.registerBackend(backend)
      backend.produce({ id: 'slow', prompt: 'hang', timeoutMs: 200 })
      await vi.waitFor(() => {
        expect(backend.results).toHaveLength(1)
      }, { timeout: 10_000 })
      const result = backend.results[0]!
      expect(result.ok).toBe(false)
      expect(result.error).toContain('cancelled')
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('mounts the configured preset on the task agent', async () => {
    const { ctx } = await harness(new ScriptedAdapter([textResponse('preset answer')]), { agentPreset: 'iqe-test' })
    const mounts: { ctx: Context; id: string | undefined }[] = []
    const created: ReturnType<typeof ctx.sessions.prepare>[] = []
    const prepare = ctx.sessions.prepare.bind(ctx.sessions)
    ctx.sessions.prepare = (id, options) => {
      const session = prepare(id, options)
      created.push(session)
      return session
    }
    ctx.provide('agentPresets' as never, {
      mount: (agentCtx: Context, id?: string) => {
        mounts.push({ ctx: agentCtx, id })
        return Promise.resolve({ id: id ?? 'default' })
      },
    } as never)
    try {
      const backend = new MemoryQueueBackend()
      const unregister = ctx.mqRuntime.registerBackend(backend)
      backend.produce({ id: 'preset-task', prompt: 'answer me' })
      await vi.waitFor(() => {
        expect(backend.results).toHaveLength(1)
      }, { timeout: 10_000 })
      const result = backend.results[0]!
      expect(result.ok).toBe(true)
      expect(result.text).toBe('preset answer')
      expect(mounts).toHaveLength(1)
      expect(mounts[0]!.id).toBe('iqe-test')
      expect(mounts[0]!.ctx).toBeInstanceOf(Context)
      expect(mounts[0]!.ctx).not.toBe(ctx)
      expect(created).toHaveLength(1)
      expect(created[0]!.header.agentPreset).toBe('iqe-test')
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('fails the task when a preset is configured without the presets service', async () => {
    const { ctx } = await harness(new ScriptedAdapter([textResponse('unused')]), { agentPreset: 'iqe-test' })
    try {
      const backend = new MemoryQueueBackend()
      const unregister = ctx.mqRuntime.registerBackend(backend)
      backend.produce({ id: 'no-service', prompt: 'answer me' })
      await vi.waitFor(() => {
        expect(backend.results).toHaveLength(1)
      }, { timeout: 10_000 })
      const result = backend.results[0]!
      expect(result.ok).toBe(false)
      expect(result.error).toContain('requires the agent-presets service')
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('joins subagent tree work before settling the task', async () => {
    const { ctx } = await harness(new ScriptedAdapter([textResponse('delegated'), textResponse('final report')]))
    let calls = 0
    ctx.provide('subagents' as never, {
      waitForChildren: (agent: Agent) => {
        calls += 1
        if (calls === 1) {
          agent.followup(createUserMessage({ content: [{ type: 'text', text: 'child settled' }], source: { kind: 'user' } }))
          return Promise.resolve(true)
        }
        return Promise.resolve(false)
      },
    } as never)
    try {
      const backend = new MemoryQueueBackend()
      const unregister = ctx.mqRuntime.registerBackend(backend)
      backend.produce({ id: 'tree', prompt: 'delegate then report' })
      await vi.waitFor(() => {
        expect(backend.results).toHaveLength(1)
      }, { timeout: 10_000 })
      const result = backend.results[0]!
      expect(result.ok).toBe(true)
      expect(result.text).toBe('final report')
      expect(calls).toBeGreaterThanOrEqual(2)
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('stops the subagent tree when the task times out', async () => {
    const { ctx } = await harness(new ScriptedAdapter(['hang']), { taskTimeoutMs: 200 })
    const drained: Agent[] = []
    let treeWaits = 0
    ctx.provide('subagents' as never, {
      waitForChildren: () => {
        treeWaits += 1
        return Promise.resolve(true)
      },
      drainDescendants: (parents: readonly Agent[]) => {
        drained.push(...parents)
        return Promise.resolve()
      },
    } as never)
    try {
      const backend = new MemoryQueueBackend()
      const unregister = ctx.mqRuntime.registerBackend(backend)
      backend.produce({ id: 'tree-timeout', prompt: 'hang', timeoutMs: 200 })
      await vi.waitFor(() => {
        expect(backend.results).toHaveLength(1)
      }, { timeout: 10_000 })
      const result = backend.results[0]!
      expect(result.ok).toBe(false)
      expect(result.error).toContain('timed out after 200ms')
      expect(drained).toHaveLength(1)
      expect(treeWaits).toBe(0)
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('does not revive a timed-out task on a settlement notice delivered during the drain', async () => {
    const { ctx } = await harness(new ScriptedAdapter(['hang']), { taskTimeoutMs: 200 })
    let drainCalls = 0
    ctx.provide('subagents' as never, {
      waitForChildren: () => Promise.resolve(true),
      drainDescendants: (parents: readonly Agent[]) => {
        drainCalls += 1
        if (drainCalls === 1) {
          parents[0]!.followup(createUserMessage({ content: [{ type: 'text', text: 'child settled' }], source: { kind: 'user' } }))
        }
        return Promise.resolve()
      },
    } as never)
    try {
      const backend = new MemoryQueueBackend()
      const unregister = ctx.mqRuntime.registerBackend(backend)
      backend.produce({ id: 'drain-wake', prompt: 'hang', timeoutMs: 200 })
      await vi.waitFor(() => {
        expect(backend.results).toHaveLength(1)
      }, { timeout: 10_000 })
      const result = backend.results[0]!
      expect(result.ok).toBe(false)
      expect(result.error).toContain('timed out after 200ms')
      expect(drainCalls).toBeGreaterThanOrEqual(1)
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('rejects a second backend registration', async () => {
    const { ctx } = await harness(new ScriptedAdapter([]))
    try {
      const unregister = ctx.mqRuntime.registerBackend(new MemoryQueueBackend())
      expect(() => ctx.mqRuntime.registerBackend(new MemoryQueueBackend())).toThrow(/already registered/)
      await unregister()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('rejects a relative workspace path at load', async () => {
    const ctx = new Context()
    try {
      expect(() => new MqRuntime(ctx, {
        workspacePath: 'relative/path',
        provider: 'mock',
        model: 'test-model',
      })).toThrow(/absolute/)
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
