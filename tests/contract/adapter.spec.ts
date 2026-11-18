import { afterEach, describe, expect, it, vi } from 'vitest'
import { listSessions, updateSettings, UnauthorizedError } from '@lai/dsh-adapter/gateway'
import { waitForTreeWork } from '@lai/dsh-adapter/subagents'

afterEach(() => vi.unstubAllGlobals())

describe('pinned DSH gateway protocol', () => {
  it('sends the released RPC envelope and returns the response', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body))
      expect(request).toMatchObject({ type: 'client-request', method: 'session/list', payload: { args: { _request: {} } } })
      return Response.json({ type: 'server-response', rpcId: request.rpcId, result: { ok: true, value: { items: [] } } })
    })
    vi.stubGlobal('fetch', fetch)
    await expect(listSessions()).resolves.toEqual({ items: [] })
    expect(fetch).toHaveBeenCalledWith('/api/session/list', expect.anything())
  })
  it('preserves settings revision checks', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body))
      expect(request.payload.args).toEqual({ ns: 'models', patch: { value: 1 }, expectedRevision: 4 })
      return Response.json({ type: 'server-response', rpcId: request.rpcId, result: { ok: false, error: 'revision conflict' } })
    }))
    await expect(updateSettings('models', { value: 1 }, 4)).rejects.toThrow('revision conflict')
  })
  it('requires authentication and rejects mismatched replies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401 })))
    await expect(listSessions()).rejects.toBeInstanceOf(UnauthorizedError)
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ type: 'server-response', rpcId: 'wrong', result: { ok: true } })))
    await expect(listSessions()).rejects.toThrow('unexpected gateway response')
  })
  it('accepts a host with no subagent provider', async () => {
    // The optional provider path never reads the live agent.
    const { Context } = await import('@deepseek-ai/cordis')
    const { mountAgentLoopTestDependencies } = await import('@deepseek-ai/dsh-agent-loop-testkit')
    const { default: AgentLoop } = await import('@deepseek-ai/dsh-agent-loop')
    const ctx = new Context()
    try {
      await mountAgentLoopTestDependencies(ctx)
      await ctx.plugin(AgentLoop, { agents: [] })
      const handle = await ctx.agents.create({})
      await expect(waitForTreeWork(undefined, handle.agent)).resolves.toBe(false)
      await handle.dispose()
    } finally { await ctx.fiber.dispose() }
  })
})
