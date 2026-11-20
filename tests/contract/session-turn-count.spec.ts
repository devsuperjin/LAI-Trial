import { afterEach, expect, it, vi } from 'vitest'
import { sessionTurnCount } from '../../packages/dsh-adapter/src/gateway.ts'
afterEach(() => vi.unstubAllGlobals())
it('counts all pages at a fixed cut without double-counting boundary turns', async () => {
  const requests: Record<string, unknown>[] = []
  const pages = [
    { cursor: 20, hasMore: true, records: [event(10), event(20)] },
    { cursor: 20, hasMore: false, records: [event(1), event(10)] },
  ]
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    const request = JSON.parse(init.body)
    requests.push(request.payload.args.request)
    return new Response(JSON.stringify({ type: 'server-response', rpcId: request.rpcId, result: { ok: true, value: pages.shift() } }))
  }))
  expect(await sessionTurnCount('router')).toBe(3)
  expect(requests[1]).toMatchObject({ beforeSeq: 10, throughSeq: 20 })
})
it('rejects incomplete history when pagination cannot advance', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
    const request = JSON.parse(init.body)
    return new Response(JSON.stringify({ type: 'server-response', rpcId: request.rpcId, result: { ok: true, value: { cursor: 20, hasMore: true, records: [event(10)] } } }))
  }))
  await expect(sessionTurnCount('router')).rejects.toThrow('did not advance')
})
function event(seq: number) { return { type: 'event', event: { type: 'turn/start', seq, time: 0, data: {} } } }
