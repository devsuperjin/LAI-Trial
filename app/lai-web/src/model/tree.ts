import type { PageResponse, SessionListEntry, WireEvent } from '../api/gateway.ts'
import { deriveDag, record, textOf } from './dag.ts'
export const STAGES = ['monitor', 'triage', 'reproduce', 'ticket', 'review', 'report']
const PRESET_STAGES: Record<string, number> = { 'iqe-monitor': 1, 'iqe-triage': 2, 'iqe-reproduction': 3, 'iqe-ticket': 4, 'iqe-reviewer': 5, 'iqe-reporting': 6 }
const PRESET_LABELS: Record<string, string> = { 'iqe-monitor': 'Monitor', 'iqe-triage': 'Triage', 'iqe-reproduction': 'Reproduction', 'iqe-ticket': 'Ticket', 'iqe-reviewer': 'Reviewer', 'iqe-reporting': 'Reporter' }
const HUES = ['#60a5fa', '#a78bfa', '#fbbf24', '#fb923c', '#34d399', '#f472b6']
export const stageHue = (stage: number): string => HUES[((stage % HUES.length) + HUES.length) % HUES.length]!
export const truncate = (value: string, max: number): string => value.length > max ? value.slice(0, Math.max(0, max - 1)) + '…' : value
export const formatTokens = (value: number): string => value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
export const formatDuration = (ms: number): string => ms >= 60000 ? `${(ms / 60000).toFixed(1)}m` : `${(ms / 1000).toFixed(1)}s`
export interface Delegation { id: string; seq: number; stage: number; hue: string; toolName: string; name: string; description: string; settled: string | null; receiptError: string | null }
export interface TreeChild { sessionId: string; delegation: Delegation | null; stage: number; hue: string; running: boolean }
export interface ChildModel { label: string | null; preset: string | null; status: 'running' | 'completed' | 'failed'; tools: { name: string; isError: boolean; time: number; preview: string }[]; toolErrors: number; tokens: number | null; durationMs: number | null; model: string | null; finalText: string }
export function summarizeChild(events: WireEvent[], entry: SessionListEntry): ChildModel {
  const dag = deriveDag(events)
  const tools = events.filter(e => e.type === 'tool/call').map(e => {
    const result = events.find(r => r.type === 'tool/result' && record(r.data.message).toolCallId === (e.data.callId ?? e.data.id))
    return { name: String(e.data.name ?? 'tool'), time: e.time, preview: JSON.stringify(e.data.arguments ?? {}), isError: record(result?.data.message).isError === true }
  })
  const values = entry.projections?.values
  const usage = values?.tokenUsage
  const route = values?.modelSelection?.lastUsed
  return { label: PRESET_LABELS[values?.agentPreset ?? ''] ?? values?.subagent?.label ?? values?.title ?? null, preset: values?.agentPreset ?? null, status: entry.running ? 'running' : dag.turnEnd === 'completed' ? 'completed' : 'failed', tools, toolErrors: tools.filter(t => t.isError).length, tokens: usage ? Object.values(usage).reduce((a, b) => a + b, 0) : null, durationMs: values?.subagentTiming?.settledMs ?? null, model: route ? `${route.provider}/${route.model}` : null, finalText: textOf(record(events.findLast(e => e.type === 'assistant/message')?.data.message).content) }
}
export function deriveTree(page: PageResponse, entries: SessionListEntry[], sessionId: string, labels: Record<string, string | null> = {}) {
  const events = page.records.map(r => r.event)
  const dag = deriveDag(events)
  const taskEvent = events.find(e => e.type === 'user/message' && record(e.data.source).kind === 'pipeline') ?? events.find(e => e.type === 'user/message' && textOf(e.data.content).trim())
  const delegations: Delegation[] = events.filter(e => e.type === 'tool/call' && STAGES.includes(e.data.name === 'reporter' ? 'report' : String(e.data.name))).map(e => {
    const args = record(e.data.arguments)
    const result = events.find(r => r.type === 'tool/result' && record(r.data.message).toolCallId === (e.data.callId ?? e.data.id))
    const receipt = record(result?.data.message)
    const stage = STAGES.indexOf(e.data.name === 'reporter' ? 'report' : String(e.data.name)) + 1
    return { id: String(e.data.callId ?? e.data.id ?? e.seq), seq: e.seq, stage, hue: stageHue(stage - 1), toolName: String(e.data.name), name: String(args.name ?? e.data.name), description: String(args.prompt ?? args.description ?? ''), settled: result ? textOf(receipt.content) : null, receiptError: receipt.isError ? textOf(receipt.content) : null }
  })
  const children: TreeChild[] = entries.filter(e => e.parentSessionId === sessionId).map(entry => {
    const label = labels[entry.sessionId] ?? entry.projections?.values.subagent?.label
    const preset = entry.projections?.values.agentPreset ?? ''
    const stage = PRESET_STAGES[preset] ?? (STAGES.findIndex(name => label?.toLowerCase().includes(name)) + 1)
    // A repeated role may have several calls: match durable receipt child ids first.
    const delegation = delegations.find(d => d.settled?.includes(entry.sessionId)) ?? delegations.find(d => d.stage === stage) ?? null
    return { sessionId: entry.sessionId, delegation, stage: delegation?.stage ?? stage, hue: delegation?.hue ?? stageHue(stage - 1), running: entry.running }
  })
  type Tool = { id: string; name: string; preview: string; result: string; isError: boolean; delegationId: string | null }
  const steps: { id: string; kind: 'turn'; turn: number; time: number; label: string; preview: string; delegationId: string | null; isError: boolean; tools: Tool[] }[] = []
  let current: typeof steps[number] | undefined
  let number = 0
  for (const event of events) {
    if (event.type === 'turn/start') {
      current = { id: `t-${event.seq}`, kind: 'turn', turn: ++number, time: event.time, label: 'Assistant', preview: '', delegationId: null, isError: false, tools: [] }
      steps.push(current)
    }
    if (event.type === 'turn/end') { current = undefined; continue }
    if (event.type !== 'assistant/message' && event.type !== 'tool/call') continue
    if (!current) {
      current = { id: `t-${event.seq}`, kind: 'turn', turn: ++number, time: event.time, label: 'Assistant', preview: '', delegationId: null, isError: false, tools: [] }
      steps.push(current)
    }
    if (event.type === 'assistant/message') {
      const text = textOf(record(event.data.message).content)
      if (text.trim()) current.preview = text
    } else {
      const result = events.find(r => r.type === 'tool/result' && record(r.data.message).toolCallId === (event.data.callId ?? event.data.id))
      const message = record(result?.data.message)
      const delegation = delegations.find(d => d.seq === event.seq)
      const isError = message.isError === true
      current.tools.push({ id: `t-${event.seq}`, name: String(event.data.name ?? 'tool'), preview: JSON.stringify(event.data.arguments ?? {}), result: textOf(message.content), isError, delegationId: delegation?.id ?? null })
      current.isError ||= isError
    }
    // A terminal boundary keeps later turns separate, including paged histories.
  }
  return { task: taskEvent ? { taskId: String(record(taskEvent.data.source).runId ?? sessionId), prompt: textOf(taskEvent.data.content), time: taskEvent.time } : children.length ? { taskId: sessionId, prompt: 'LAI Pipeline · Orchestrator', time: entries.find(entry => entry.sessionId === sessionId)?.updatedAt ?? Date.now() } : null, turnEnd: dag.turnEnd, delegations, children, steps }
}
export interface SvgEdge { d: string; hue: string; active: boolean }
export interface SvgNode { x: number; y: number; w: number; h: number; hue: string; badge: string; title: string; lines: string[]; status: 'neutral' | 'running' | 'completed' | 'failed' }
const escapeXml = (s: string): string => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!)
export function buildExportSvg(input: { width: number; height: number; nodes: SvgNode[]; edges: SvgEdge[]; title: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${input.width}" height="${input.height + 40}" viewBox="0 -40 ${input.width} ${input.height + 40}"><rect x="0" y="-40" width="100%" height="100%" fill="#101827"/><text x="16" y="-16" fill="white">${escapeXml(input.title)}</text>${input.edges.map(e => `<path d="${escapeXml(e.d)}" fill="none" stroke="${escapeXml(e.hue)}"/>`).join('')}${input.nodes.map(n => `<g><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="#1e293b" stroke="${escapeXml(n.hue)}"/>${[n.badge, n.title, ...n.lines].map((line, i) => `<text x="${n.x + 10}" y="${n.y + 18 + i * 18}" fill="white" font-size="11">${escapeXml(truncate(line, Math.floor(n.w / 7)))}</text>`).join('')}</g>`).join('')}</svg>`
}
export function buildSummaryText(tree: ReturnType<typeof deriveTree>, models: Record<string, ChildModel | undefined>): string {
  return [`Task: ${tree.task?.taskId ?? 'Pipeline run'}`, tree.task?.prompt ?? '', ...tree.children.map(c => `${c.stage}. ${models[c.sessionId]?.label ?? c.sessionId}: ${models[c.sessionId]?.status ?? 'pending'}\n${models[c.sessionId]?.finalText ?? ''}`)].join('\n')
}
