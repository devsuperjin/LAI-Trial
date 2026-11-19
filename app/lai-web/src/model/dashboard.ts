import type { SessionListEntry } from '../api/gateway.ts'
import { readableRunTitle, rootRuns } from './runs.ts'
import { stageHue } from './tree.ts'
export { formatDuration, formatTokens } from './tree.ts'
export type RunStatus = 'running' | 'completed' | 'failed' | 'idle'
export const STATUS_HUE: Record<RunStatus, string> = { running: '#fbbf24', completed: '#34d399', failed: '#f87171', idle: '#94a3b8' }
const tokens = (entry: SessionListEntry): number => Object.values(entry.projections?.values.tokenUsage ?? {}).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
const status = (entry: SessionListEntry): RunStatus => {
  if (entry.running) return 'running'
  // Child timing projections are not root-session outcome projections.
  if (entry.parentSessionId) {
    const completed = entry.projections?.values.subagentTiming?.lastTurnCompleted
    if (completed === true) return 'completed'
    if (completed === false) return 'failed'
  }
  return 'idle'
}
const STAGES = [
  ['triage', 'Triage', 'iqe-triage'], ['reproduce', 'Reproduction', 'iqe-reproduction'], ['ticket', 'Ticket', 'iqe-ticket'], ['review', 'Reviewer', 'iqe-reviewer'], ['report', 'Reporter', 'iqe-reporting'],
] as const
export function deriveDashboard(entries: SessionListEntry[]) {
  const roots = rootRuns(entries)
  const byId = new Map(entries.map(entry => [entry.sessionId, entry]))
  const rootIds = new Set(roots.map(entry => entry.sessionId))
  const owner = (entry: SessionListEntry): string | undefined => {
    let current: SessionListEntry | undefined = entry
    const visited = new Set<string>()
    while (current && !visited.has(current.sessionId)) {
      if (rootIds.has(current.sessionId)) return current.sessionId
      visited.add(current.sessionId)
      current = current.parentSessionId ? byId.get(current.parentSessionId) : undefined
    }
    return undefined
  }
  const owned = entries.filter(entry => owner(entry) !== undefined)
  const children = owned.filter(entry => !rootIds.has(entry.sessionId))
  const runs = roots.map(entry => {
    const descendants = children.filter(child => owner(child) === entry.sessionId)
    const all = [entry, ...descendants]
    const preset = entry.projections?.values.agentPreset ?? ''
    const role = preset === 'dsh-superagent-router' || entry.sessionId.startsWith('orchestrator-') ? 'Monitor / Router' : entry.sessionId.startsWith('worker-') ? 'Worker' : 'Other run'
    return { sessionId: entry.sessionId, title: readableRunTitle(entry.projections?.values.title, entry.sessionId), role, status: status(entry), tokens: all.reduce((sum, item) => sum + tokens(item), 0), childCount: descendants.length, time: entry.updatedAt, model: entry.projections?.values.modelSelection?.lastUsed?.model ?? null }
  }).sort((a, b) => b.time - a.time)
  // Attribute usage to each session's actual route, including pinned specialists.
  const groups = new Map<string, { model: string; tokens: number; output: number; sessions: number; hue: string }>()
  for (const entry of owned) {
    const route = entry.projections?.values.modelSelection?.lastUsed
    const name = route ? `${route.provider} / ${route.model}` : 'Unreported model'
    const group = groups.get(name) ?? { model: name, tokens: 0, output: 0, sessions: 0, hue: stageHue(groups.size) }
    group.tokens += tokens(entry); group.output += entry.projections?.values.tokenUsage?.outputTokens ?? 0; group.sessions++
    groups.set(name, group)
  }
  return {
    runs,
    totals: { runs: roots.length, subagents: children.length, running: runs.filter(run => run.status === 'running').length, tokens: owned.reduce((sum, entry) => sum + tokens(entry), 0), outputTokens: owned.reduce((sum, entry) => sum + (entry.projections?.values.tokenUsage?.outputTokens ?? 0), 0) },
    modelBreakdown: [...groups.values()].sort((a, b) => b.tokens - a.tokens),
    stageStats: STAGES.map(([id, label, preset], index) => {
      const instances = children.filter(entry => entry.projections?.values.agentPreset === preset)
      const durations = instances.flatMap(entry => { const value = entry.projections?.values.subagentTiming?.settledMs; return value === undefined || !Number.isFinite(value) ? [] : [value] })
      return { id, label, hue: stageHue(index), runs: instances.length, active: instances.filter(entry => entry.running).length, completed: instances.filter(entry => status(entry) === 'completed').length, failed: instances.filter(entry => status(entry) === 'failed').length, tokens: instances.reduce((sum, entry) => sum + tokens(entry), 0), avgMs: durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null }
    }),
  }
}
