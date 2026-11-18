/**
 * MQTT backend for `ctx.mqRuntime`: tasks arrive on one topic and results
 * leave on another, both at QoS 1. MQTT settles delivery on receipt, so ack
 * is a no-op and a crash between receipt and result publication loses the
 * task; a malformed payload is logged and dropped.
 * @module @lai/dsh-mq-mqtt
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { connect } from 'mqtt'
import type { IClientOptions } from 'mqtt'
import { parseMqTask } from '@lai/dsh-mq'
import type { MessageQueueBackend, MqDelivery, MqResult } from '@lai/dsh-mq'

/** Stable Cordis plugin name. */
export const name = 'mq-mqtt'

/** Required MQ runtime service. */
export const inject = ['mqRuntime']

/** MQTT backend configuration. */
export interface Config {
  /** Broker URL, for example mqtt://127.0.0.1:1883. */
  url: string
  /** Topic carrying task envelopes as JSON payloads; wildcards are allowed. */
  inputTopic: string
  /** Topic receiving result envelopes as JSON payloads. */
  outputTopic: string
  /** Client identity presented to the broker. Defaults to dsh-mq-<pid>. */
  clientId?: string
  /** Login user when the broker requires authentication. */
  username?: string
  /** Login password when the broker requires authentication. */
  password?: string
  /** Idle window in milliseconds before consume returns null. Defaults to 5000. */
  blockMs?: number
}

/** Loader schema for the connection and topic identities. */
export const Config: z<Config> = z.object({
  url: z.string().required(),
  inputTopic: z.string().required(),
  outputTopic: z.string().required(),
  clientId: z.string().default(`dsh-mq-${String(process.pid)}`),
  username: z.string(),
  password: z.string(),
  blockMs: z.number().step(1).min(1).default(5000),
})

/** Report one transport error without replacing the operation's outcome. */
function report(ctx: Context, subject: string, error: unknown): void {
  ctx.logger.error(`mq-mqtt: ${subject}: ${error instanceof Error ? error.message : String(error)}`)
}

/**
 * Mount the backend: connect, subscribe to the input topic, register with the
 * runtime, and own the client until disposal.
 * @param ctx - plugin context carrying the MQ runtime.
 * @param config - validated connection and topic identities.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const clientId = config.clientId ?? `dsh-mq-${String(process.pid)}`
  const blockMs = config.blockMs ?? 5000
  const options: IClientOptions = { clientId }
  if (config.username !== undefined) options.username = config.username
  if (config.password !== undefined) options.password = config.password
  const client = connect(config.url, options)
  client.on('error', (error) => { report(ctx, 'connection', error) })
  try {
    await new Promise<void>((resolve, reject) => {
      client.once('connect', () => { resolve() })
      client.once('error', reject)
    })
    await client.subscribeAsync(config.inputTopic, { qos: 1 })
  } catch (error: unknown) {
    await client.endAsync()
    throw error
  }

  const pending: Buffer[] = []
  let wake: (() => void) | undefined
  let sequence = 0
  client.on('message', (_topic, payload) => {
    pending.push(payload)
    wake?.()
  })

  /** Resolve on the next payload, the idle window elapsing, or abort. */
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
        const payload = pending.shift()
        if (payload !== undefined) {
          sequence += 1
          const deliveryId = `mqtt-${String(sequence)}`
          try {
            return { deliveryId, task: parseMqTask(JSON.parse(payload.toString('utf8'))) }
          } catch (error: unknown) {
            report(ctx, `discarding malformed delivery ${deliveryId}`, error)
          }
          continue
        }
        await idle(signal)
      }
      return null
    },
    ack(_deliveryId: string): Promise<void> {
      // QoS 1 PUBACK already settled the delivery when the payload arrived.
      return Promise.resolve()
    },
    async publish(result: MqResult): Promise<void> {
      await client.publishAsync(config.outputTopic, JSON.stringify(result), { qos: 1 })
    },
  }

  ctx.effect(() => {
    const unregister = ctx.mqRuntime.registerBackend(backend)
    return async () => {
      await unregister()
      await client.endAsync()
    }
  }, 'mq-mqtt backend')
}
