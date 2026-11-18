/**
 * Message-queue task runtime (`ctx.mqRuntime`): claims tasks from a registered
 * queue backend, runs each as one Workspace-backed root Session on the
 * ordinary agent loop, and publishes the settled result before acknowledging
 * the delivery. The loop, prompt assembly, and session log stay untouched;
 * this service is a consumer of the same extension points a human driver uses.
 * @module @lai/dsh-mq
 */

import { waitForTreeWork } from '@lai/dsh-adapter/subagents'
import { randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Agent, AgentHandle, AgentSetup } from '@deepseek-ai/dsh-agent'
import { boundContextSummary, createUserMessage, errorChain } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
// Optional service peers stay type-only so compositions can omit their packages.
import type {} from '@deepseek-ai/dsh-session-title'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { MessageQueueBackend, MqDelivery, MqResult, MqTask } from './types.ts'

export { MemoryQueueBackend } from './memory.ts'
export { parseMqTask } from './task.ts'
export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    mqRuntime: MqRuntime
  }
}

/** Runtime configuration: deployment defaults plus dispatch bounds. */
export interface Config {
  /** Absolute default workspace directory for tasks that do not name one. */
  workspacePath: string
  /** Default provider route for tasks that do not name one. */
  provider: string
  /** Default model id for tasks that do not name one. */
  model: string
  /** Maximum tasks running at once; further deliveries wait for a free slot. Defaults to 1. */
  maxParallelTasks?: number
  /** Default per-task completion timeout in milliseconds. Defaults to 300000. */
  taskTimeoutMs?: number
  /**
   * Agent preset mounted on every task agent. Omission inherits the host
   * composition. Requires the agent-presets service; a configured preset
   * without that service fails the task loud.
   */
  agentPreset?: string
}

/** One registered backend and the dispatch loop it owns. */
interface Pump {
  readonly controller: AbortController
  readonly settled: Promise<void>
}

/** Why a turn ended, read from the durable terminal event. */
type TurnEndReason = SessionEvent<'turn/end'>['data']['reason']

/**
 * Claim tasks from one queue backend and settle each through a dedicated
 * Session. Exactly one backend may be registered at a time; registration
 * starts dispatch and its disposer drains active tasks before returning.
 */
export class MqRuntime extends Service {
  static inject = ['agents', 'sessions', 'workspaceRegistry']

  /** Loader schema for the required deployment defaults and dispatch bounds. */
  static Config: z<Config> = z.object({
    workspacePath: z.string().required(),
    provider: z.string().required(),
    model: z.string().required(),
    maxParallelTasks: z.number().step(1).min(1).default(1),
    taskTimeoutMs: z.number().step(1).min(1).default(300_000),
    agentPreset: z.string().min(1),
  })

  /** Validated configuration owned by the runtime. */
  readonly config: Config
  private readonly maxParallelTasks: number
  private readonly taskTimeoutMs: number
  private pump: Pump | undefined

  constructor(ctx: Context, config: Config) {
    super(ctx, 'mqRuntime')
    if (!isAbsolute(config.workspacePath)) {
      throw new TypeError(`mqRuntime: workspacePath must be absolute, got ${JSON.stringify(config.workspacePath)}`)
    }
    this.config = config
    this.maxParallelTasks = config.maxParallelTasks ?? 1
    this.taskTimeoutMs = config.taskTimeoutMs ?? 300_000
  }

  protected [Service.init](): void {
    this.ctx.effect(() => () => {
      this.pump?.controller.abort()
    }, 'mqRuntime lifetime')
  }

  /**
   * Register the active queue backend and start dispatch.
   * @param backend - the transport that delivers tasks and accepts results.
   * @returns a disposer that stops dispatch and awaits active-task quiescence.
   * @throws Error when a backend is already registered.
   */
  registerBackend(backend: MessageQueueBackend): () => Promise<void> {
    if (this.pump !== undefined) {
      throw new Error('mqRuntime: a queue backend is already registered')
    }
    const controller = new AbortController()
    const settled = this.dispatch(backend, controller.signal)
    const pump: Pump = { controller, settled }
    this.pump = pump
    return async () => {
      controller.abort()
      await settled
      if (this.pump === pump) this.pump = undefined
    }
  }

  /** Claim deliveries until aborted, keeping at most the configured task count live. */
  private async dispatch(backend: MessageQueueBackend, signal: AbortSignal): Promise<void> {
    // Sibling rows mount concurrently; a task must not start against a half-composed tree.
    await this.ctx.get('loader')?.await()
    const active = new Set<Promise<void>>()
    while (!signal.aborted) {
      if (active.size >= this.maxParallelTasks) {
        await Promise.race(active)
        continue
      }
      let delivery: MqDelivery | null
      try {
        delivery = await backend.consume(signal)
      } catch (error: unknown) {
        this.ctx.logger.error(`mq: queue consume failed, dispatch stops: ${errorChain(error)}`)
        break
      }
      if (delivery === null) continue
      const tracked = this.runTask(backend, delivery, signal).finally(() => {
        active.delete(tracked)
      })
      active.add(tracked)
    }
    await Promise.allSettled(active)
  }

  /** Settle one delivery: publish the result first, acknowledge only after publication. */
  private async runTask(backend: MessageQueueBackend, delivery: MqDelivery, signal: AbortSignal): Promise<void> {
    const result = await this.execute(delivery.task, signal)
    try {
      await backend.publish(result)
    } catch (error: unknown) {
      this.ctx.logger.error(`mq: result publication for task ${delivery.task.id} failed, delivery stays unacknowledged: ${errorChain(error)}`)
      return
    }
    try {
      await backend.ack(delivery.deliveryId)
    } catch (error: unknown) {
      this.ctx.logger.warn(`mq: acknowledgement for task ${delivery.task.id} failed: ${errorChain(error)}`)
    }
  }

  /**
   * Resolve the configured preset into a creation-time setup, mirroring the
   * session controller's compose-then-mount path.
   * @returns the mounting setup, or undefined when no preset is configured.
   * @throws Error when a preset is configured without the agent-presets service.
   */
  private presetSetup(): AgentSetup | undefined {
    const id = this.config.agentPreset
    if (id === undefined) return undefined
    const presets = this.ctx.get('agentPresets')
    if (presets === undefined) {
      throw new Error(`mq: agentPreset "${id}" requires the agent-presets service`)
    }
    return async (agentCtx) => {
      await presets.mount(agentCtx, id)
    }
  }

  /** Create, attach, drive, and tear down one task session; every failure becomes a result. */
  private async execute(task: MqTask, signal: AbortSignal): Promise<MqResult> {
    const ctx = this.ctx
    const sessionId = brandString<SessionId>(`mq-${randomUUID()}`)
    let handle: AgentHandle | undefined
    let workspace: Workspace | undefined
    let attached = false
    try {
      const workspacePath = task.workspacePath ?? this.config.workspacePath
      if (!isAbsolute(workspacePath)) {
        throw new TypeError(`mq task ${task.id}: workspacePath must be absolute, got ${JSON.stringify(workspacePath)}`)
      }
      workspace = await ctx.workspaceRegistry.create(workspacePath)
      signal.throwIfAborted()
      const setup = this.presetSetup()
      handle = await ctx.agents.create({
        sessionId,
        signal,
        meta: {
          cwd: workspace.path,
          ...this.config.agentPreset === undefined ? {} : { agentPreset: this.config.agentPreset },
        },
        agentOptions: {
          provider: task.provider ?? this.config.provider,
          model: task.model ?? this.config.model,
        },
        ...setup === undefined ? {} : { setup },
      })
      await workspace.attachSession(sessionId)
      attached = true
      const titles = ctx.get('sessionTitle')
      if (task.title !== undefined && titles !== undefined) titles.rename(handle.agent.session, task.title)
      return await this.drive(handle.agent, task, signal)
    } catch (error: unknown) {
      return {
        taskId: task.id,
        ...(handle === undefined ? {} : { sessionId }),
        ok: false,
        error: errorChain(error),
      }
    } finally {
      if (attached && workspace !== undefined) {
        try {
          await workspace.detachSession(sessionId)
        } catch (error: unknown) {
          ctx.logger.warn(`mq: workspace detach for session ${sessionId} failed: ${errorChain(error)}`)
        }
      }
      if (handle !== undefined) {
        try {
          await handle.dispose()
        } catch (error: unknown) {
          ctx.logger.warn(`mq: agent disposal for session ${sessionId} failed: ${errorChain(error)}`)
        }
      }
    }
  }

  /** Submit the prompt, await task-tree quiescence under the timeout, and derive the outcome. */
  private async drive(agent: Agent, task: MqTask, signal: AbortSignal): Promise<MqResult> {
    const session = agent.session
    const subagents = this.ctx.get('subagents')
    let failure: unknown
    let reason: TurnEndReason | undefined
    const stopErrors = agent.ctx.on('agent/error', ({ error }) => {
      failure = error
    })
    const stopTerminals = this.ctx.on('session/event', (subject, event) => {
      if (subject === session && event.type === 'turn/end') reason = event.data.reason
    })
    const timeoutMs = task.timeoutMs ?? this.taskTimeoutMs
    const timer = AbortSignal.timeout(timeoutMs)
    let stopReason: string | undefined
    const onTimeout = (): void => {
      stopReason = `mq: task ${task.id} timed out after ${String(timeoutMs)}ms`
      agent.cancel({ kind: 'hook', reason: stopReason })
    }
    const onShutdown = (): void => {
      stopReason = `mq: runtime stopped before task ${task.id} settled`
      agent.cancel({ kind: 'hook', reason: stopReason })
    }
    timer.addEventListener('abort', onTimeout, { once: true })
    signal.addEventListener('abort', onShutdown, { once: true })
    try {
      agent.followup(createUserMessage({
        content: [{ type: 'text', text: task.prompt }],
        source: {
          kind: 'mq',
          taskId: task.id,
          form: 'notice',
          summary: boundContextSummary(`MQ task ${task.id}`),
        },
      }))
      while (true) {
        await agent.whenIdle()
        const idleSeq = session.seq
        if (stopReason !== undefined) {
          // A stopped task must not revive on a child's settlement notice: stop the
          // whole tree, then cancel any wake the drain itself delivered.
          await subagents?.drainDescendants([agent])
          agent.cancel({ kind: 'hook', reason: stopReason })
          if (agent.status === 'idle' && session.seq === idleSeq) break
          continue
        }
        // Child settlement can wake the parent before the child wait observes it.
        if (!await waitForTreeWork(subagents, agent)
          && agent.status === 'idle' && session.seq === idleSeq) break
      }
    } finally {
      timer.removeEventListener('abort', onTimeout)
      signal.removeEventListener('abort', onShutdown)
      stopErrors()
      stopTerminals()
    }
    await this.ctx.sessions.flush(session)
    const text = lastAssistantText(session)
    const base = { taskId: task.id, sessionId: session.id, ...(text === '' ? {} : { text }) }
    if (failure !== undefined) {
      return { ...base, ok: false, error: errorChain(failure) }
    }
    if (reason?.kind === 'completed') {
      return { ...base, ok: true }
    }
    return { ...base, ok: false, error: describeReason(reason) }
  }
}

/** Join the final assistant message's text blocks; empty when the run produced none. */
function lastAssistantText(session: Session): string {
  const message = session.deriveMessages().findLast(candidate => candidate.role === 'assistant')
  if (message === undefined) return ''
  return message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

/** Account for a non-completed terminal reason in producer-facing terms. */
function describeReason(reason: TurnEndReason | undefined): string {
  if (reason === undefined) return 'no turn ended for the task'
  switch (reason.kind) {
    case 'aborted':
      return reason.reason.kind === 'hook'
        ? `task cancelled (${reason.reason.reason})`
        : `task cancelled (${reason.reason.kind})`
    case 'error':
      return `${reason.error.code}: ${reason.error.message}`
    case 'blocked':
      return 'turn blocked by policy'
    case 'max-tokens':
      return 'a step reached its output-token ceiling'
    case 'completed':
      return 'task completed'
    default:
      // Merge-extensible reasons: unknown kinds report their tag verbatim.
      return `turn ended: ${reason.kind}`
  }
}
export default MqRuntime
