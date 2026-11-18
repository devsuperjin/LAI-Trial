import { randomUUID } from 'node:crypto'
import { connect as tcpConnect } from 'node:net'
import { Context } from '@deepseek-ai/cordis'
import { connect } from 'mqtt'
import type { MqttClient } from 'mqtt'
import { afterAll, describe, expect, it } from 'vitest'
import type { MessageQueueBackend } from '@lai/dsh-mq'
import * as MqMqtt from '../src/index.ts'

const host = process.env['MQTT_HOST'] ?? '127.0.0.1'
const port = Number(process.env['MQTT_PORT'] ?? 1883)
const url = `mqtt://${host}:${port}`

/** Probe one TCP connection so the suite self-skips without a local broker. */
function brokerReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = tcpConnect({ host, port })
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
if (process.env['LAI_REQUIRE_BROKERS'] === '1' && !reachable) throw new Error('Required broker is unreachable: mq-mqtt')
const run = randomUUID().slice(0, 8)
const inputTopic = `dsh-test/tasks/${run}`
const outputTopic = `dsh-test/results/${run}`
const clients: MqttClient[] = []

/** Connect one producer client subscribed to the result topic. */
async function producerClient(suffix: string): Promise<MqttClient> {
  const client = connect(url, { clientId: `dsh-test-producer-${run}-${suffix}` })
  clients.push(client)
  await new Promise<void>((resolve, reject) => {
    client.once('connect', () => { resolve() })
    client.once('error', reject)
  })
  await client.subscribeAsync(outputTopic, { qos: 1 })
  return client
}

afterAll(async () => {
  await Promise.allSettled(clients.map(client => client.endAsync()))
})

describe.skipIf(!reachable)('mq-mqtt against a live MQTT broker', () => {
  it('claims, publishes, and settles one task through QoS 1 topics', { timeout: 30_000 }, async () => {
    const ctx = new Context()
    let backend: MessageQueueBackend | undefined
    ctx.provide('mqRuntime' as never, {
      registerBackend(candidate: MessageQueueBackend) {
        backend = candidate
        return () => Promise.resolve()
      },
    } as never)
    try {
      await ctx.plugin(MqMqtt, { url, inputTopic, outputTopic, clientId: `dsh-test-worker-${run}-1`, blockMs: 500 })
      expect(backend).toBeDefined()

      const producer = await producerClient('1')
      const resultArrived = new Promise<Buffer>((resolve) => {
        producer.on('message', (topic, payload) => {
          if (topic === outputTopic) resolve(payload)
        })
      })
      await producer.publishAsync(inputTopic, JSON.stringify({ id: 'mqtt-t1', prompt: 'via mqtt' }), { qos: 1 })

      const controller = new AbortController()
      const delivery = await backend!.consume(controller.signal)
      expect(delivery?.task).toEqual({ id: 'mqtt-t1', prompt: 'via mqtt' })

      await backend!.publish({ taskId: 'mqtt-t1', ok: true, text: 'mqtt answer' })
      expect(JSON.parse((await resultArrived).toString('utf8'))).toEqual({
        taskId: 'mqtt-t1',
        ok: true,
        text: 'mqtt answer',
      })

      await backend!.ack(delivery!.deliveryId)
      controller.abort()
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('discards a malformed payload and keeps consuming', { timeout: 30_000 }, async () => {
    const ctx = new Context()
    let backend: MessageQueueBackend | undefined
    ctx.provide('mqRuntime' as never, {
      registerBackend(candidate: MessageQueueBackend) {
        backend = candidate
        return () => Promise.resolve()
      },
    } as never)
    try {
      await ctx.plugin(MqMqtt, { url, inputTopic, outputTopic, clientId: `dsh-test-worker-${run}-2`, blockMs: 500 })
      const producer = await producerClient('2')
      await producer.publishAsync(inputTopic, 'not json', { qos: 1 })
      await producer.publishAsync(inputTopic, JSON.stringify({ id: 'mqtt-t2', prompt: 'valid' }), { qos: 1 })
      const controller = new AbortController()
      const delivery = await backend!.consume(controller.signal)
      expect(delivery?.task.id).toBe('mqtt-t2')
      await backend!.ack(delivery!.deliveryId)
      controller.abort()
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
