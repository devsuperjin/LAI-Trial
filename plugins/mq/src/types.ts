/** Wire envelopes and the queue backend interface for the MQ task runtime. */

import type { SessionId } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** One task delivered through a message queue. */
    mq: {
      kind: 'mq'
      /** Producer-assigned task identity, echoed in the result envelope. */
      taskId: string
      form: 'notice'
      summary: string
    }
  }
}

/** One unit of work claimed from a queue. */
export interface MqTask {
  /** Producer-assigned identity; echoed in the result and used for logging. */
  readonly id: string
  /** The prompt text submitted as the session's first user message. */
  readonly prompt: string
  /** Absolute workspace directory; omission uses the runtime's configured default. */
  readonly workspacePath?: string
  /** Optional session title shown in UIs; omission leaves the generated title. */
  readonly title?: string
  /** Provider route override; omission uses the runtime's configured default. */
  readonly provider?: string
  /** Model id override; omission uses the runtime's configured default. */
  readonly model?: string
  /** Per-task completion timeout in milliseconds; omission uses the configured default. */
  readonly timeoutMs?: number
}

/** The settled outcome of one task, published to the result queue. */
export interface MqResult {
  /** The producing task's identity. */
  readonly taskId: string
  /** The session that ran the task; absent when creation failed before publication. */
  readonly sessionId?: SessionId
  /** True only when the turn completed without a recorded failure. */
  readonly ok: boolean
  /** The final assistant text of the run, when any was produced. */
  readonly text?: string
  /** Failure account when `ok` is false. */
  readonly error?: string
}

/** One backend delivery: the transport identity plus the parsed task. */
export interface MqDelivery {
  /** Transport-level identity used for acknowledgement, distinct from the task id. */
  readonly deliveryId: string
  /** The validated task envelope. */
  readonly task: MqTask
}

/**
 * Replaceable queue transport. The runtime owns dispatch, session creation,
 * and result derivation; a backend only moves envelopes.
 */
export interface MessageQueueBackend {
  /**
   * Claim the next delivery. Returns null when the backend's block window
   * elapses without a message or the signal aborts; abort is not an error.
   * @param signal - runtime lifetime cancellation.
   */
  consume(signal: AbortSignal): Promise<MqDelivery | null>
  /**
   * Settle one delivery after its result was published. A delivery that is
   * never acknowledged may be redelivered by the transport.
   * @param deliveryId - the exact delivery identity from {@link MqDelivery}.
   */
  ack(deliveryId: string): Promise<void>
  /**
   * Publish one settled result. A rejection leaves the delivery unacknowledged.
   * @param result - the complete outcome envelope.
   */
  publish(result: MqResult): Promise<void>
}
