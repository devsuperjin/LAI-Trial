/** Sequential event orchestration over six native LAI subagents; no transport broker. */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { inputSchema } from './store.ts'
import { PipelineError, ROLE_ORDER } from './types.ts'
import type { PipelineDriver, PipelineInput, PipelineRun, PipelineSnapshot, PipelineState, PipelineStore, SourceHandle, SourceRegistration } from './types.ts'

const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error)
export class PipelineEngine {
  private state: PipelineState = { version: 1, runs: [] }
  private readonly sources = new Map<string, SourceRegistration>()
  private active: { run: PipelineRun; controller: AbortController; task: Promise<void> } | undefined
  private ready = false
  private closing = false
  private failure: string | null = null
  private persistence = Promise.resolve()
  constructor(private readonly driver: PipelineDriver, private readonly store: PipelineStore, private readonly workspace: string, private readonly historyLimit: number) {}
  async initialize(): Promise<void> {
    this.state = await this.store.load()
    for (const run of this.state.runs) if (run.status === 'running') {
      run.status = 'interrupted'; run.endedAt = Date.now(); run.error = 'Application restarted before this run settled. It was not replayed automatically.'
      for (const stage of run.stages) {
        if (stage.status === 'running') { stage.status = 'failed'; stage.error = run.error; stage.endedAt = run.endedAt }
        else if (stage.status === 'pending') stage.status = 'skipped'
      }
    }
    await this.save()
    await this.driver.initialize()
    this.ready = true
  }
  snapshot(): PipelineSnapshot {
    return structuredClone({ ready: this.ready && !this.closing, activeRunId: this.active?.run.id ?? null, workers: this.driver.workers(), sources: [...this.sources.values()].map(({ simulate: _simulate, ...info }) => info), runs: this.state.runs, error: this.failure })
  }
  registerSource(source: SourceRegistration): SourceHandle {
    if (this.closing || this.sources.has(source.id) || !/^[a-z][a-z0-9-]*$/.test(source.id)) throw new PipelineError('INVALID_EVENT', 'Source ID is invalid or already registered.')
    this.sources.set(source.id, source)
    let registered = true
    return {
      submit: input => {
        if (!registered) throw new PipelineError('UNKNOWN_SOURCE', 'This event source is no longer registered.')
        return this.start(source.id, input)
      },
      dispose: () => { if (registered) { registered = false; this.sources.delete(source.id) } },
    }
  }
  async simulate(sourceId: string, caseId: string): Promise<PipelineRun> {
    const source = this.sources.get(sourceId)
    if (!source?.simulated || !source.simulate || !source.cases.some(item => item.id === caseId)) throw new PipelineError('UNKNOWN_SOURCE', 'This simulation is not registered.')
    return this.start(sourceId, await source.simulate(caseId))
  }
  async start(sourceId: string, candidate: PipelineInput): Promise<PipelineRun> {
    if (!this.ready || this.closing || this.failure) throw new PipelineError('NOT_READY', this.failure ?? 'The six pipeline workers are not ready.')
    const source = this.sources.get(sourceId)
    if (!source) throw new PipelineError('UNKNOWN_SOURCE', 'The event source is not registered.')
    const parsed = inputSchema.safeParse(candidate)
    if (!parsed.success) throw new PipelineError('INVALID_EVENT', parsed.error.issues.map(issue => issue.message).join('; '))
    const input = JSON.parse(JSON.stringify(parsed.data)) as PipelineInput
    const duplicate = this.state.runs.find(run => run.event.sourceId === sourceId && run.event.id === input.id)
    if (duplicate) return structuredClone(duplicate)
    if (this.active) throw new PipelineError('BUSY', 'A pipeline run is already active. Wait for it to finish or cancel it before submitting another event.')
    const id = randomUUID()
    const run: PipelineRun = {
      id, event: { ...input, sourceId, simulated: source.simulated, receivedAt: Date.now() },
      status: 'running', createdAt: Date.now(), stages: ROLE_ORDER.map(role => ({ role, status: 'pending' })),
      reviewDecision: 'UNKNOWN', evidencePaths: [], artifactDirectory: join(this.workspace, 'runs', id),
    }
    const admitted = Promise.withResolvers<void>()
    const active: { run: PipelineRun; controller: AbortController; task: Promise<void> } = { run, controller: new AbortController(), task: admitted.promise.then(() => this.drive(active), () => { if (this.active === active) this.active = undefined }) }
    this.active = active
    this.state.runs.unshift(run)
    try { await this.save(); admitted.resolve() } catch (error) {
      run.status = 'failed'; run.error = messageOf(error); run.endedAt = Date.now()
      for (const stage of run.stages) stage.status = 'skipped'
      admitted.reject(error); await active.task; throw error
    }
    return structuredClone(run)
  }
  async cancel(runId: string): Promise<void> {
    if (this.active?.run.id !== runId) throw new PipelineError('NOT_FOUND', 'This run is no longer active.')
    this.active.controller.abort(new Error('Pipeline run cancelled by the user.'))
    await this.active.task
  }
  async whenIdle(): Promise<void> { await this.active?.task }
  async dispose(): Promise<void> {
    this.closing = true
    this.ready = false
    this.active?.controller.abort(new Error('Pipeline service is stopping.'))
    await this.active?.task
    await this.driver.dispose()
    await this.persistence
  }
  private async save(): Promise<void> {
    const snapshot = structuredClone(this.state)
    const pending = this.persistence.then(() => this.store.save(snapshot))
    this.persistence = pending.catch(error => { this.failure = `Pipeline persistence failed: ${messageOf(error)}. New events are blocked until the service is repaired and restarted.` })
    try { await pending } catch { throw new PipelineError('PERSISTENCE', this.failure ?? 'Pipeline persistence failed.') }
  }
  private async drive(active: { run: PipelineRun; controller: AbortController; task: Promise<void> }): Promise<void> {
    const { run, controller } = active
    try {
      controller.signal.throwIfAborted()
      run.evidencePaths = await this.store.prepare(run)
      controller.signal.throwIfAborted()
      await this.save()
      for (const stage of run.stages) {
        controller.signal.throwIfAborted()
        stage.status = 'running'; stage.startedAt = Date.now()
        await this.save()
        stage.result = await this.driver.execute(stage.role, {
          run: structuredClone(run), previous: run.stages.flatMap(item => item.result ? [{ role: item.role, text: item.result.text }] : []),
        }, controller.signal)
        controller.signal.throwIfAborted()
        await this.store.stage(run, stage.role, stage.result.text)
        stage.status = 'completed'; stage.endedAt = Date.now()
        if (stage.role === 'review') {
          const decision = stage.result.text.match(/^Decision:\s*(APPROVE|REQUEST_INFO|REJECT)\b/im)?.[1]?.toUpperCase()
          run.reviewDecision = decision === 'APPROVE' || decision === 'REQUEST_INFO' || decision === 'REJECT' ? decision : 'UNKNOWN'
        }
        await this.save()
      }
      run.status = run.reviewDecision === 'APPROVE' ? 'completed' : 'needs-review'

    } catch (error) {
      run.status = controller.signal.aborted ? 'cancelled' : 'failed'
      run.error = messageOf(error)
      for (const stage of run.stages) {
        if (stage.status === 'running') { stage.status = 'failed'; stage.error = run.error; stage.endedAt = Date.now() }
        else if (stage.status === 'pending') stage.status = 'skipped'
      }
    } finally {
      run.endedAt = Date.now()
      this.state.runs = this.state.runs.slice(0, this.historyLimit)
      try { await this.save() } catch (error) { this.failure = messageOf(error) }
      if (this.active === active) this.active = undefined
    }
  }
}
