/** Provider-neutral input and observable state for the six-stage IQE pipeline. */
export const ROLE_ORDER = ['monitor', 'triage', 'reproduce', 'ticket', 'review', 'report'] as const
export type Role = typeof ROLE_ORDER[number]
export const ROLE_LABELS: Record<Role, string> = { monitor: 'Monitor', triage: 'Triage', reproduce: 'Reproduction', ticket: 'Ticket', review: 'Reviewer', report: 'Reporting' }
export const ROLE_PRESETS: Record<Role, string> = { monitor: 'iqe-monitor', triage: 'iqe-triage', reproduce: 'iqe-reproduction', ticket: 'iqe-ticket', review: 'iqe-reviewer', report: 'iqe-reporting' }
export type EventType = 'ci.failure' | 'code.commit' | 'pull_request.updated'
export interface EvidenceInput { name: string; content: string }
/** Connectors submit normalized facts; simulation is stamped by the registered source. */
export interface PipelineInput {
  id: string
  type: EventType
  title: string
  summary: string
  repository?: string
  commit?: string
  evidence: EvidenceInput[]
}
export interface PipelineEvent extends PipelineInput { sourceId: string; simulated: boolean; receivedAt: number }
export interface SourceCase { id: string; title: string; description: string }
export interface SourceInfo { id: string; name: string; simulated: boolean; description: string; cases: SourceCase[] }
/** A source may offer simulation cases, or submit its own normalized external events. */
export interface SourceRegistration extends SourceInfo { simulate?: (caseId: string) => PipelineInput | Promise<PipelineInput> }
export interface SourceHandle {
  submit(input: PipelineInput): Promise<PipelineRun>
  dispose(): void
}
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
export interface StageResult {
  text: string
  sessionId: string
  startSeq: number
  endSeq: number
}
export interface PipelineStage {
  role: Role
  status: StageStatus
  startedAt?: number
  endedAt?: number
  result?: StageResult
  error?: string
}
export type ReviewDecision = 'APPROVE' | 'REQUEST_INFO' | 'REJECT' | 'UNKNOWN'
export type RunStatus = 'running' | 'completed' | 'needs-review' | 'failed' | 'cancelled' | 'interrupted'
export interface PipelineRun {
  id: string
  event: PipelineEvent
  status: RunStatus
  createdAt: number
  endedAt?: number
  stages: PipelineStage[]
  reviewDecision: ReviewDecision
  evidencePaths: string[]
  artifactDirectory: string
  error?: string
}
export interface WorkerInfo {
  role: Role
  name: string
  preset: string
  state: 'starting' | 'standby' | 'running' | 'error'
  sessionId?: string
  provider?: string
  model?: string
  error?: string
}
export interface PipelineSnapshot {
  ready: boolean
  activeRunId: string | null
  workers: WorkerInfo[]
  sources: SourceInfo[]
  runs: PipelineRun[]
  error: string | null
}
export interface StageContext {
  run: PipelineRun
  previous: { role: Role; text: string }[]
}
/** Execution is independent of input transport and replaceable in deterministic tests. */
export interface PipelineDriver {
  initialize(): Promise<void>
  workers(): WorkerInfo[]
  execute(role: Role, context: StageContext, signal: AbortSignal): Promise<StageResult>
  dispose(): Promise<void>
}
export interface PipelineState { version: 1; runs: PipelineRun[] }
export interface PipelineStore {
  load(): Promise<PipelineState>
  save(state: PipelineState): Promise<void>
  prepare(run: PipelineRun): Promise<string[]>
  stage(run: PipelineRun, role: Role, text: string): Promise<void>
}
export class PipelineError extends Error {
  constructor(readonly code: 'BUSY' | 'NOT_READY' | 'UNKNOWN_SOURCE' | 'INVALID_EVENT' | 'PERSISTENCE' | 'NOT_FOUND', message: string) { super(message); this.name = 'PipelineError' }
}
