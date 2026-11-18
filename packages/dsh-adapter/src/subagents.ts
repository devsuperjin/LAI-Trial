/** Subagent completion adapter for the pinned DSH release. */
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent'

/**
 * Join progressing descendants using the released DSH API; parked inboxes stay resident.
 * @param runtime - Optional subagent provider from the host composition.
 * @param agent - Root agent whose work must settle before publishing an MQ result.
 * @returns Whether descendant work was joined and the caller must recheck root idle.
 */
export async function waitForTreeWork(runtime: Pick<SubagentRuntime, 'waitForChildren'> | undefined, agent: Agent): Promise<boolean> {
  return await runtime?.waitForChildren(agent) ?? false
}
