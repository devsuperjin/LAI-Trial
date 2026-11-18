import { describe, expect, it } from 'vitest'
import { MemoryQueueBackend } from '../src/memory.ts'

describe('MemoryQueueBackend', () => {
  it('delivers produced tasks in FIFO order and records results', async () => {
    const backend = new MemoryQueueBackend()
    backend.produce({ id: 'a', prompt: 'first' })
    backend.produce({ id: 'b', prompt: 'second' })
    const controller = new AbortController()
    const first = await backend.consume(controller.signal)
    const second = await backend.consume(controller.signal)
    expect(first?.task.id).toBe('a')
    expect(second?.task.id).toBe('b')
    expect(first?.deliveryId).not.toBe(second?.deliveryId)
    await backend.publish({ taskId: 'a', ok: true, text: 'done' })
    expect(backend.results).toEqual([{ taskId: 'a', ok: true, text: 'done' }])
    await backend.ack(first!.deliveryId)
    await backend.ack(first!.deliveryId)
    controller.abort()
  })

  it('wakes a waiting consumer on produce', async () => {
    const backend = new MemoryQueueBackend()
    const controller = new AbortController()
    const pending = backend.consume(controller.signal)
    backend.produce({ id: 'late', prompt: 'arrived later' })
    const delivery = await pending
    expect(delivery?.task.id).toBe('late')
    controller.abort()
  })

  it('returns null on abort without a delivery', async () => {
    const backend = new MemoryQueueBackend()
    const controller = new AbortController()
    const pending = backend.consume(controller.signal)
    controller.abort()
    expect(await pending).toBeNull()
    expect(await backend.consume(controller.signal)).toBeNull()
  })
})
