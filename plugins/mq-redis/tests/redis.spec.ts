import { randomUUID } from 'node:crypto'
import { connect } from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import { Redis } from 'ioredis'
import { afterAll, describe, expect, it } from 'vitest'
import type { MessageQueueBackend } from '@lai/dsh-mq'
import * as MqRedis from '../src/index.ts'

const host = process.env['REDIS_HOST'] ?? '127.0.0.1'
const port = Number(process.env['REDIS_PORT'] ?? 6379)

/** Probe one TCP connection so the suite self-skips without a local Redis. */
function redisReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port })
    const done = (reachable: boolean): void => {
      socket.destroy()
      resolve(reachable)
    }
    socket.setTimeout(500)
    socket.once('connect', () => { done(true) })
    socket.once('error', () => { done(false) })
    socket.once('timeout', () => { done(false) })
  })
}

const reachable = await redisReachable()
if (process.env['LAI_REQUIRE_BROKERS'] === '1' && !reachable) throw new Error('Required broker is unreachable: mq-redis')
const run = randomUUID().slice(0, 8)
const inputStream = `dsh-test:tasks:${run}`
const outputStream = `dsh-test:results:${run}`
const clients: Redis[] = []

afterAll(async () => {
  if (reachable) {
    const cleanup = new Redis({ host, port })
    await cleanup.del(inputStream, outputStream)
    await cleanup.quit()
  }
  await Promise.allSettled(clients.map(client => client.quit()))
})

describe.skipIf(!reachable)('mq-redis against a live Redis', () => {
  it('claims, publishes, and acknowledges one task through consumer groups', { timeout: 30_000 }, async () => {
    const ctx = new Context()
    let backend: MessageQueueBackend | undefined
    ctx.provide('mqRuntime' as never, {
      registerBackend(candidate: MessageQueueBackend) {
        backend = candidate
        return () => Promise.resolve()
      },
    } as never)
    try {
      await ctx.plugin(MqRedis, {
        host,
        port,
        inputStream,
        outputStream,
        group: `dsh-test-${run}`,
        consumer: 'test-consumer',
        blockMs: 500,
      })
      expect(backend).toBeDefined()

      const producer = new Redis({ host, port })
      clients.push(producer)
      await producer.xadd(inputStream, '*', 'task', JSON.stringify({ id: 'redis-t1', prompt: 'via redis' }))

      const controller = new AbortController()
      const delivery = await backend!.consume(controller.signal)
      expect(delivery?.task).toEqual({ id: 'redis-t1', prompt: 'via redis' })

      await backend!.publish({ taskId: 'redis-t1', ok: true, text: 'redis answer' })
      const results = await producer.xread('COUNT', 1, 'STREAMS', outputStream, '0-0') as [string, [string, string[]][]][]
      const fields = results[0]![1][0]![1]
      expect(JSON.parse(fields[fields.indexOf('result') + 1]!)).toEqual({
        taskId: 'redis-t1',
        ok: true,
        text: 'redis answer',
      })

      await backend!.ack(delivery!.deliveryId)
      const pending = await producer.xpending(inputStream, `dsh-test-${run}`) as [number, ...unknown[]]
      expect(pending[0]).toBe(0)
      controller.abort()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('discards a malformed delivery and keeps consuming', { timeout: 30_000 }, async () => {
    const ctx = new Context()
    let backend: MessageQueueBackend | undefined
    ctx.provide('mqRuntime' as never, {
      registerBackend(candidate: MessageQueueBackend) {
        backend = candidate
        return () => Promise.resolve()
      },
    } as never)
    try {
      await ctx.plugin(MqRedis, {
        host,
        port,
        inputStream,
        outputStream,
        group: `dsh-test-${run}`,
        consumer: 'test-consumer-2',
        blockMs: 500,
      })
      const producer = new Redis({ host, port })
      clients.push(producer)
      await producer.xadd(inputStream, '*', 'task', 'not json')
      await producer.xadd(inputStream, '*', 'task', JSON.stringify({ id: 'redis-t2', prompt: 'valid' }))
      const controller = new AbortController()
      const delivery = await backend!.consume(controller.signal)
      expect(delivery?.task.id).toBe('redis-t2')
      await backend!.ack(delivery!.deliveryId)
      controller.abort()
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
