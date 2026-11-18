/**
 * Redis Streams backend for `ctx.mqRuntime`: tasks arrive on one stream under
 * a consumer group, results leave on another. A malformed delivery is logged
 * and acknowledged so one poison message cannot stall the group; a failed
 * result publication leaves the delivery pending for redelivery.
 * @module @lai/dsh-mq-redis
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Redis } from 'ioredis'
import { parseMqTask } from '@lai/dsh-mq'
import type { MessageQueueBackend, MqDelivery, MqResult } from '@lai/dsh-mq'

/** Stable Cordis plugin name. */
export const name = 'mq-redis'

/** Required MQ runtime service. */
export const inject = ['mqRuntime']

/** Redis Streams backend configuration. */
export interface Config {
  /** Redis host. Defaults to 127.0.0.1. */
  host?: string
  /** Redis port. Defaults to 6379. */
  port?: number
  /** Stream key carrying task envelopes under the `task` field. */
  inputStream: string
  /** Stream key receiving result envelopes under the `result` field. */
  outputStream: string
  /** Consumer group claimed on the input stream; created when absent. */
  group: string
  /** Consumer name within the group. Defaults to worker-<pid>. */
  consumer?: string
  /** Blocking read window in milliseconds before consume returns null. Defaults to 5000. */
  blockMs?: number
}

/** Loader schema for the connection and stream identities. */
export const Config: z<Config> = z.object({
  host: z.string().default('127.0.0.1'),
  port: z.number().step(1).min(1).max(65535).default(6379),
  inputStream: z.string().required(),
  outputStream: z.string().required(),
  group: z.string().required(),
  consumer: z.string().default(`worker-${String(process.pid)}`),
  blockMs: z.number().step(1).min(1).default(5000),
})

/** One XREADGROUP entry: the stream key and its `[id, fields]` records. */
type StreamRead = [string, [string, string[]][]][]

/** Report one transport error without replacing the operation's outcome. */
function report(ctx: Context, subject: string, error: unknown): void {
  ctx.logger.error(`mq-redis: ${subject}: ${error instanceof Error ? error.message : String(error)}`)
}

/**
 * Mount the backend: create the consumer group, register with the runtime,
 * and own both connections until disposal.
 * @param ctx - plugin context carrying the MQ runtime.
 * @param config - validated connection and stream identities.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const host = config.host ?? '127.0.0.1'
  const port = config.port ?? 6379
  const consumer = config.consumer ?? `worker-${String(process.pid)}`
  const blockMs = config.blockMs ?? 5000
  // Blocking reads occupy their connection for the whole BLOCK window, so
  // acknowledgement and publication run on a second client.
  const reader = new Redis({ host, port, maxRetriesPerRequest: null })
  const writer = new Redis({ host, port })
  reader.on('error', (error) => { report(ctx, 'reader connection', error) })
  writer.on('error', (error) => { report(ctx, 'writer connection', error) })
  try {
    await writer.xgroup('CREATE', config.inputStream, config.group, '$', 'MKSTREAM')
  } catch (error: unknown) {
    // BUSYGROUP means the group already exists; every other failure fails loading.
    if (!(error instanceof Error) || !error.message.includes('BUSYGROUP')) {
      await Promise.allSettled([reader.quit(), writer.quit()])
      throw error
    }
  }

  const backend: MessageQueueBackend = {
    async consume(signal: AbortSignal): Promise<MqDelivery | null> {
      while (!signal.aborted) {
        const read = await reader.xreadgroup(
          'GROUP', config.group, consumer,
          'COUNT', 1, 'BLOCK', blockMs, 'STREAMS', config.inputStream, '>',
        ) as StreamRead | null
        if (read === null) return null
        for (const [, entries] of read) {
          for (const [deliveryId, fields] of entries) {
            const taskField = fields[fields.indexOf('task') + 1]
            try {
              if (taskField === undefined) throw new TypeError('delivery has no task field')
              return { deliveryId, task: parseMqTask(JSON.parse(taskField)) }
            } catch (error: unknown) {
              report(ctx, `discarding malformed delivery ${deliveryId}`, error)
              await writer.xack(config.inputStream, config.group, deliveryId)
            }
          }
        }
      }
      return null
    },
    async ack(deliveryId: string): Promise<void> {
      await writer.xack(config.inputStream, config.group, deliveryId)
    },
    async publish(result: MqResult): Promise<void> {
      await writer.xadd(config.outputStream, '*', 'result', JSON.stringify(result))
    },
  }

  ctx.effect(() => {
    const unregister = ctx.mqRuntime.registerBackend(backend)
    return async () => {
      await unregister()
      await Promise.allSettled([reader.quit(), writer.quit()])
    }
  }, 'mq-redis backend')
}
