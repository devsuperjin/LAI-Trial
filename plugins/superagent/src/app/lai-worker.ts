/** LAI execution policy inside a Superagent Worker; Router and task lifecycle stay upstream-owned. */
import type { Context } from '@deepseek-ai/cordis'
import type { ToolExecutionToken } from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-subagent'
import { sessionEvents } from '@lai/dsh-adapter/host'

export const LAI_STAGES = ['triage', 'reproduce', 'ticket', 'review', 'reporter'] as const
export const LAI_WORKER_PROMPT = 'You are the LAI Worker orchestrator, executing a Superagent ticket. The separate Superagent Router is the Monitor; do not repeat its monitoring or create a monitor child. For each assignment you MUST delegate through these existing native tools exactly in order: triage → reproduce → ticket → review → reporter. Invoke one tool, end the turn while it runs, and wait for its actual child result before invoking the next. Pass the original task, authorized scope, workspace path and all prior findings to each child. Do not do specialist implementation yourself. Triage diagnoses; reproduce validates and implements an explicitly requested fix when applicable; ticket prepares a draft/change summary; review independently checks it; reporter consolidates the outcome. These are real LAI role presets, not new root sessions. Keep children brief for simple tasks and respect requested limits on tests and commands. If any child fails or is cancelled, stop and use orchestrator_report failed/blocked. Only after all five complete may you publish authorized results/PRs and call orchestrator_report ready. Superagent authorization, acknowledgements, reporting and handback requirements still apply. On follow-up messages, inspect completed work and do not repeat an already completed chain.'
export interface ChildOutcome { completed: boolean; failed: boolean }
/** Completion is established by native child history, never by a parent's claim. */
export function stageAdmission(name: string, children: readonly ChildOutcome[]): string | undefined {
  if (children.some(child => child.failed)) return 'A LAI stage failed or was cancelled. Report failed or blocked; do not start subsequent stages.'
  if (children.some(child => !child.completed)) return 'Wait for the current LAI subagent to finish before starting the next stage or reporting ready.'
  if (name === 'ready') return children.length === LAI_STAGES.length ? undefined : 'Complete all five LAI stages before reporting ready.'
  const expected = LAI_STAGES[children.length]
  return name === expected ? undefined : `LAI pipeline order: only ${expected ?? 'final reporting (all stages finished)'} is allowed. Each stage runs once.`
}

export function installLaiWorker(ctx: Context, agent: Agent, since: () => number): () => void {
  let reserved: ToolExecutionToken | undefined
  const offResult = agent.ctx.on('tools/result', execution => { if (execution.token === reserved) reserved = undefined })
  const offGuard = agent.ctx.on('tools/pre-execute', async (execution, next) => {
    if (execution.name === 'subagent') return { kind: 'deny', reason: 'Use the five LAI delegation tools; generic subagents are not part of this Worker pipeline.' }
    const ready = execution.name === 'orchestrator_report' && (execution.arguments as { state?: string } | undefined)?.state === 'ready'
    if (!(LAI_STAGES as readonly string[]).includes(execution.name) && !ready) return next()
    if (reserved) return { kind: 'deny', reason: 'Another LAI delegation is being admitted. Execute only one stage at a time.' }
    reserved = execution.token
    let admitted = false
    try {
      const children = (await ctx.subagents.listChildren(agent.session.id, execution.signal)).filter(child => child.createdAt >= since())
      const outcomes: ChildOutcome[] = []
      for (const child of children) {
        const events = await sessionEvents(ctx, child.id as SessionId)
        const end = events.findLast(event => event.type === 'turn/end')
        const open = events.findLastIndex(event => event.type === 'turn/start') > events.findLastIndex(event => event.type === 'turn/end')
        const active = ctx.agents.get(child.id)?.status
        const settled = !open && (active === undefined || active === 'idle') && end?.type === 'turn/end'
        outcomes.push({ completed: !!settled && end.data.reason.kind === 'completed', failed: !!settled && end.data.reason.kind !== 'completed' })
      }
      const reason = stageAdmission(ready ? 'ready' : execution.name, outcomes)
      if (reason) return { kind: 'deny', reason }
      const decision = await next()
      admitted = decision.kind === 'allow'
      return decision
    } finally { if (!admitted) reserved = undefined }
  }, { prepend: true })
  return () => { offGuard(); offResult() }
}
