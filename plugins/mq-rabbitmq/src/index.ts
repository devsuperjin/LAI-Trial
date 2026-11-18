/**
 * RabbitMQ backend for `ctx.mqRuntime`: tasks arrive on one durable queue,
 * results leave on another. A malformed delivery is logged and acknowledged
 * so one poison message cannot stall the queue; a failed result publication
 * leaves the delivery unacknowledged for redelivery.
 * @module @lai/dsh-mq-rabbitmq
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import amqplib from 'amqplib'
import type { Channel, ChannelModel, ConsumeMessage } from 'amqplib'
import { parseMqTask } from '@lai/dsh-mq'
import type { MessageQueueBackend, MqDelivery, MqResult } from '@lai/dsh-mq'

/** Stable Cordis plugin name. */
export const name = 'mq-rabbitmq'

/** Required MQ runtime service. */
export const inject = ['mqRuntime']

/** RabbitMQ backend configuration. */
export interface Config {
  /** Broker host. Defaults to 127.0.0.1. */
  host?: string
  /** Broker AMQP port. Defaults to 5672. */
  port?: number
  /** Login user. Defaults to guest. */
  username?: string
  /** Login password. Defaults to guest. */
  password?: string
  /** Durable queue carrying task envelopes as JSON message bodies. */
  inputQueue: string
  /** Durable queue receiving result envelopes as JSON message bodies. */
  outputQueue: string
  /** Idle window in milliseconds before consume returns null. Defaults to 5000. */
  blockMs?: number
}

/** Loader schema for the connection and queue identities. */
export const Config: z<Config> = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().step(1).min(1).max(65535).default(5672),
  username: z.string().default('guest'),
  password: z.string().default('guest'),
  inputQueue: z.string().required(),
  outputQueue: z.string().required(),
  blockMs: z.number().step(1).min(1).default(5000),
})

/** Report one transport error without replacing the operation's outcome. */
function report(ctx: Context, subject: string, error: unknown): void {
  ctx.logger.error(`mq-rabbitmq: ${subject}: ${error instanceof Error ? error.message : String(error)}`)
}

/**
 * Mount the backend: assert both queues, register with the runtime, and own
 * the connection until disposal.
 * @param ctx - plugin context carrying the MQ runtime.
 * @param config - validated connection and queue identities.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const host = config.host ?? '127.0.0.1'
  const port = config.port ?? 5672
  const username = config.username ?? 'guest'
  const password = config.password ?? 'guest'
  const blockMs = config.blockMs ?? 5000
  const connection: ChannelModel = await amqplib.connect({ hostname: host, port, username, password })
  connection.on('error', (error) => { report(ctx, 'connection', error) })
  let channel: Channel
  try {
    channel = await connection.createChannel()
    await channel.assertQueue(config.inputQueue, { durable: true })
    await channel.assertQueue(config.outputQueue, { durable: true })
    // One unacknowledged delivery at a time matches the runtime's task slot.
    await channel.prefetch(1)
  } catch (error: unknown) {
    await connection.close()
    throw error
  }

  const pending: ConsumeMessage[] = []
  const unacked = new Map<string, ConsumeMessage>()
  let wake: (() => void) | undefined
  await channel.consume(config.inputQueue, (message) => {
    if (message === null) {
      report(ctx, 'consumer cancelled', new Error(`queue ${config.inputQueue} was deleted or the broker cancelled the consumer`))
      return
    }
    pending.push(message)
    wake?.()
  }, { noAck: false })

  /** Resolve on the next delivery, the idle window elapsing, or abort. */
  function idle(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      const finish = (): void => {
        clearTimeout(timer)
        signal.removeEventListener('abort', finish)
        wake = undefined
        resolve()
      }
      const timer = setTimeout(finish, blockMs)
      signal.addEventListener('abort', finish, { once: true })
      wake = finish
    })
  }

  const backend: MessageQueueBackend = {
    async consume(signal: AbortSignal): Promise<MqDelivery | null> {
      while (!signal.aborted) {
        const message = pending.shift()
        if (message !== undefined) {
          const deliveryId = String(message.fields.deliveryTag)
          try {
            const task = parseMqTask(JSON.parse(message.content.toString('utf8')))
            unacked.set(deliveryId, message)
            return { deliveryId, task }
          } catch (error: unknown) {
            report(ctx, `discarding malformed delivery ${deliveryId}`, error)
            channel.ack(message)
          }
          continue
        }
        await idle(signal)
      }
      return null
    },
    ack(deliveryId: string): Promise<void> {
      const message = unacked.get(deliveryId)
      if (message !== undefined) {
        unacked.delete(deliveryId)
        channel.ack(message)
      }
      return Promise.resolve()
    },
    async publish(result: MqResult): Promise<void> {
      const flushed = channel.sendToQueue(config.outputQueue, Buffer.from(JSON.stringify(result)), { persistent: true })
      if (!flushed) await new Promise<void>((resolve) => { channel.once('drain', resolve) })
    },
  }

  ctx.effect(() => {
    const unregister = ctx.mqRuntime.registerBackend(backend)
    return async () => {
      await unregister()
      try {
        await channel.close()
      } catch (error: unknown) {
        report(ctx, 'closing channel', error)
      }
      try {
        await connection.close()
      } catch (error: unknown) {
        report(ctx, 'closing connection', error)
      }
    }
  }, 'mq-rabbitmq backend')
}
