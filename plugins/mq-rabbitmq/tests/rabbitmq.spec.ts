import { randomUUID } from 'node:crypto'
import { connect } from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import amqplib from 'amqplib'
import { afterAll, describe, expect, it } from 'vitest'
import type { MessageQueueBackend } from '@lai/dsh-mq'
import * as MqRabbitmq from '../src/index.ts'

const host = process.env['RABBITMQ_HOST'] ?? '127.0.0.1'
const port = Number(process.env['RABBITMQ_PORT'] ?? 5672)

/** Probe one TCP connection so the suite self-skips without a local broker. */
function brokerReachable(): Promise<boolean> {
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

const reachable = await brokerReachable()
if (process.env['LAI_REQUIRE_BROKERS'] === '1' && !reachable) throw new Error('Required broker is unreachable: mq-rabbitmq')
const run = randomUUID().slice(0, 8)
const inputQueue = `dsh-test.tasks.${run}`
const outputQueue = `dsh-test.results.${run}`

afterAll(async () => {
  if (reachable) {
    const connection = await amqplib.connect({ hostname: host, port })
    const channel = await connection.createChannel()
    await channel.deleteQueue(inputQueue)
    await channel.deleteQueue(outputQueue)
    await connection.close()
  }
})

describe.skipIf(!reachable)('mq-rabbitmq against a live RabbitMQ', () => {
  it('claims, publishes, and acknowledges one task through durable queues', { timeout: 30_000 }, async () => {
    const ctx = new Context()
    let backend: MessageQueueBackend | undefined
    ctx.provide('mqRuntime' as never, {
      registerBackend(candidate: MessageQueueBackend) {
        backend = candidate
        return () => Promise.resolve()
      },
    } as never)
    try {
      await ctx.plugin(MqRabbitmq, { host, port, inputQueue, outputQueue, blockMs: 500 })
      expect(backend).toBeDefined()

      const connection = await amqplib.connect({ hostname: host, port })
      const producer = await connection.createChannel()
      producer.sendToQueue(inputQueue, Buffer.from(JSON.stringify({ id: 'rabbit-t1', prompt: 'via rabbitmq' })), { persistent: true })

      const controller = new AbortController()
      const delivery = await backend!.consume(controller.signal)
      expect(delivery?.task).toEqual({ id: 'rabbit-t1', prompt: 'via rabbitmq' })

      await backend!.publish({ taskId: 'rabbit-t1', ok: true, text: 'rabbit answer' })
      const published = await producer.get(outputQueue, { noAck: true })
      if (published === false) throw new Error('result message missing from output queue')
      expect(JSON.parse(published.content.toString('utf8'))).toEqual({
        taskId: 'rabbit-t1',
        ok: true,
        text: 'rabbit answer',
      })

      await backend!.ack(delivery!.deliveryId)
      const remaining = await producer.checkQueue(inputQueue)
      expect(remaining.messageCount).toBe(0)
      controller.abort()
      await connection.close()
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
      await ctx.plugin(MqRabbitmq, { host, port, inputQueue, outputQueue, blockMs: 500 })
      const connection = await amqplib.connect({ hostname: host, port })
      const producer = await connection.createChannel()
      producer.sendToQueue(inputQueue, Buffer.from('not json'))
      producer.sendToQueue(inputQueue, Buffer.from(JSON.stringify({ id: 'rabbit-t2', prompt: 'valid' })))
      const controller = new AbortController()
      const delivery = await backend!.consume(controller.signal)
      expect(delivery?.task.id).toBe('rabbit-t2')
      await backend!.ack(delivery!.deliveryId)
      controller.abort()
      await connection.close()
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
