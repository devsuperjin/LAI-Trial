import type { SessionListEntry } from '../api/gateway.ts'
import { rootRuns } from './runs.ts'
import { stageHue, STAGES } from './tree.ts'
export { formatDuration, formatTokens } from './tree.ts'
export type RunStatus = 'running' | 'completed' | 'failed'
export const STATUS_HUE = { running: '#fbbf24', completed: '#34d399', failed: '#f87171' }
const tokens = (e: SessionListEntry): number => Object.values(e.projections?.values.tokenUsage ?? {}).reduce((a, b) => a + b, 0)
const status = (e: SessionListEntry): RunStatus => e.running ? 'running' : e.projections?.values.subagentTiming?.lastTurnCompleted === true ? 'completed' : 'failed'
export function deriveDashboard(entries: SessionListEntry[]) {
  const roots = rootRuns(entries)
  const childEntries = entries.filter(e => e.parentSessionId && roots.some(r => r.sessionId === e.parentSessionId))
  const runs = roots.map(e => {
    const children = childEntries.filter(c => c.parentSessionId === e.sessionId)
    return { sessionId: e.sessionId, title: e.projections?.values.title ?? e.sessionId, status: status(e), tokens: tokens(e) + children.reduce((s, c) => s + tokens(c), 0), outputTokens: [e, ...children].reduce((s, c) => s + (c.projections?.values.tokenUsage?.outputTokens ?? 0), 0), childCount: children.length, settledChildren: children.filter(c => !c.running).length, durationMs: e.projections?.values.subagentTiming?.settledMs ?? null, model: e.projections?.values.modelSelection?.lastUsed?.model ?? '—', preset: e.projections?.values.agentPreset ?? 'default', time: e.updatedAt }
  }).sort((a, b) => b.time - a.time)
  const totals = { runs: runs.length, subagents: childEntries.length, running: runs.filter(r => r.status === 'running').length, completed: runs.filter(r => r.status === 'completed').length, failed: runs.filter(r => r.status === 'failed').length, tokens: runs.reduce((s, r) => s + r.tokens, 0), outputTokens: runs.reduce((s, r) => s + r.outputTokens, 0) }
  const breakdown = (key: 'model' | 'preset') => [...new Set(runs.map(r => r[key]))].map((value, i) => ({ model: value, preset: value, count: runs.filter(r => r[key] === value).length, tokens: runs.filter(r => r[key] === value).reduce((s, r) => s + r.tokens, 0), hue: stageHue(i) }))
  return { runs, totals, successRate: totals.completed + totals.failed ? totals.completed / (totals.completed + totals.failed) : null, statusBreakdown: (['running', 'completed', 'failed'] as const).map(s => ({ status: s, count: totals[s], hue: STATUS_HUE[s] })), presetBreakdown: breakdown('preset'), modelBreakdown: breakdown('model'), stageStats: STAGES.map((name, i) => {
    const children = childEntries.filter(e => e.projections?.values.agentPreset?.includes(name))
    const durations = children.flatMap(e => e.projections?.values.subagentTiming?.settledMs === undefined ? [] : [e.projections.values.subagentTiming.settledMs])
    return { label: name, hue: stageHue(i), runs: children.length, tokens: children.reduce((s, c) => s + tokens(c), 0), avgMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null }
  }), tokenTimeline: [...runs].reverse().map(r => ({ ...r, hue: STATUS_HUE[r.status] })) }
}
