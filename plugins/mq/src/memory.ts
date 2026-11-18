/** In-process queue backend for single-process compositions and tests. */

import type { MessageQueueBackend, MqDelivery, MqResult, MqTask } from './types.ts'

/**
 * Same-process FIFO backend. Producers call {@link MemoryQueueBackend.produce};
 * the runtime consumes, and published results stay readable on the instance.
 * Unacknowledged deliveries are not redelivered: process loss drops them.
 */
export class MemoryQueueBackend implements MessageQueueBackend {
  private readonly pending: MqDelivery[] = []
  private readonly waiters: ((delivery: MqDelivery | null) => void)[] = []
  private nextDelivery = 0
  private readonly published: MqResult[] = []

  /** Every result published so far, in publication order. */
  get results(): readonly MqResult[] {
    return this.published
  }

  /**
   * Enqueue one validated task for the runtime.
   * @param task - the complete task envelope.
   */
  produce(task: MqTask): void {
    const delivery: MqDelivery = { deliveryId: `memory-${String(this.nextDelivery++)}`, task }
    const waiter = this.waiters.shift()
    if (waiter !== undefined) waiter(delivery)
    else this.pending.push(delivery)
  }

  /** Claim the next delivery, waiting up to the signal's lifetime. */
  async consume(signal: AbortSignal): Promise<MqDelivery | null> {
    if (signal.aborted) return null
    const queued = this.pending.shift()
    if (queued !== undefined) return queued
    return await new Promise<MqDelivery | null>((resolve) => {
      const settle = (delivery: MqDelivery | null): void => {
        signal.removeEventListener('abort', onAbort)
        resolve(delivery)
      }
      const onAbort = (): void => {
        const index = this.waiters.indexOf(settle)
        if (index >= 0) this.waiters.splice(index, 1)
        settle(null)
      }
      this.waiters.push(settle)
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  /** Settle one delivery. The memory backend does not redeliver, so this is a no-op. */
  ack(_deliveryId: string): Promise<void> {
    return Promise.resolve()
  }

  /** Record one settled result for inspection. */
  publish(result: MqResult): Promise<void> {
    this.published.push(result)
    return Promise.resolve()
  }
}
