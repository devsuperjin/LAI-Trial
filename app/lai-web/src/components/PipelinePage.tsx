import { useLanguage } from '../i18n.tsx'
import { useCallback, useEffect, useState } from 'react'
import type { PipelineRun, PipelineSnapshot, Role } from '@lai/dsh-adapter/pipeline'
import { cancelPipeline, pipelineSnapshot, simulatePipeline } from '@lai/dsh-adapter/pipeline'
import { useInterval } from '../hooks/useInterval.ts'

const ROLES: { id: Role; name: string; purpose: string; color: string }[] = [
  { id: 'monitor', name: 'Orchestrator', purpose: 'Monitor inputs and delegate tasks', color: 'var(--color-fd-primary)' },
  { id: 'triage', name: 'Triage', purpose: 'Classify root cause and evidence', color: 'var(--color-fd-primary)' },
  { id: 'reproduce', name: 'Reproduction', purpose: 'Run controlled local checks', color: 'var(--color-fd-primary)' },
  { id: 'ticket', name: 'Ticket', purpose: 'Prepare an evidence-backed draft', color: 'var(--color-fd-primary)' },
  { id: 'review', name: 'Reviewer', purpose: 'Independently validate the result', color: 'var(--color-fd-primary)' },
  { id: 'report', name: 'Reporter', purpose: 'Consolidate findings and metrics', color: 'var(--color-fd-primary)' },
]
const panel = 'rounded-xl border border-fd-border bg-fd-card p-4'
const button = 'rounded-md border border-fd-border bg-fd-secondary px-3 py-2 text-sm hover:border-fd-primary disabled:cursor-not-allowed disabled:opacity-40'
const stateColor = (state: string): string => state === 'failed' || state === 'error' || state === 'REJECT' ? 'text-fd-danger' : state === 'running' || state === 'needs-review' || state === 'REQUEST_INFO' ? 'text-fd-warning' : state === 'completed' || state === 'APPROVE' ? 'text-fd-success' : 'text-fd-muted-foreground'
const date = (time: number): string => new Date(time).toLocaleString()

/** Simulation input, LAI subagent stages and execution history. */
export function PipelinePage(props: { onSettings: () => void; view?: 'pipeline' | 'history' }) {
  const { t } = useLanguage()
  const [snapshot, setSnapshot] = useState<PipelineSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const load = useCallback(async (): Promise<void> => {
    try {
      const next = await pipelineSnapshot()
      setSnapshot(next)
      setError(null)
      setSelectedId(current => current && next.runs.some(run => run.id === current) ? current : next.activeRunId ?? next.runs[0]?.id ?? null)
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
  }, [])
  useEffect(() => { void load() }, [load])
  useInterval(() => { void load() }, 2000)

  const simulate = async (source: string, id: string): Promise<void> => {
    setBusy(true); setActionError(null)
    try {
      const run = await simulatePipeline(source, id)
      setSelectedId(run.id); setSelectedRole(null)
      await load()
    } catch (failure) { setActionError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  const cancel = async (): Promise<void> => {
    if (!snapshot?.activeRunId) return
    setBusy(true); setActionError(null)
    try { await cancelPipeline(snapshot.activeRunId); await load() }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setBusy(false) }
  }
  const run = snapshot?.runs.find(item => item.id === selectedId)
  const stage = run?.stages.find(item => item.role === selectedRole) ?? run?.stages.find(item => item.status === 'running') ?? run?.stages.findLast(item => item.status === 'completed' || item.status === 'failed') ?? run?.stages[0]
  const readyWorkers = snapshot?.workers.filter(worker => worker.state !== 'starting').length ?? 0

  return <div className="p-4 md:p-6">
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-fd-muted-foreground">{t("LAI · IQE validation")}</p>
          <h1 className="mt-1 text-xl font-medium">{t(props.view === 'history' ? 'History' : 'Agent pipeline')}</h1>
          <p className="mt-1 text-sm text-fd-muted-foreground">{t("Simulate a CI failure or code change, then analyze, reproduce, draft, review, and report.")}</p>
        </div>
        <button className={button} onClick={props.onSettings} type="button">{t("Models & prompts")}</button>
      </div>
      {(error || snapshot?.error || actionError) && <div className="rounded-lg border border-fd-danger/40 bg-fd-danger/10 p-3 text-sm text-fd-danger" role="alert">{actionError ?? error ?? snapshot?.error}</div>}
      {!snapshot && !error && <p role="status" className="text-sm text-fd-muted-foreground">{t("Loading LAI agents…")}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['LAI roles', `${readyWorkers} / 6`], ['Event sources', String(snapshot?.sources.length ?? 0)], ['Total runs', String(snapshot?.runs.length ?? 0)], ['Completed', String(snapshot?.runs.filter(item => item.status === 'completed').length ?? 0)]].map(([label, value]) => <div className={panel} key={t(label)}><p className="text-xs text-fd-muted-foreground">{t(label)}</p><p className="mt-1 text-xl font-medium tabular-nums">{value}</p></div>)}
      </div>
      {props.view !== 'history' && <section className={panel} aria-label={t("Input sources")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-medium">{t("Simulated inputs")}</h2><p className="mt-1 text-xs text-fd-muted-foreground">{t("Start with local fixtures. Connect CI or GitHub later through source plugins.")}</p></div>
          {snapshot?.activeRunId && <button className={`${button} text-fd-danger`} disabled={busy} onClick={() => { void cancel() }} type="button">{t("Cancel run")}</button>}
        </div>
        <div className="mt-4 space-y-3">{snapshot?.sources.map(source => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fd-border p-3" key={source.id}>
          <div className="min-w-0"><p className="text-sm font-medium">{source.name} <span className="ml-1 rounded border border-fd-border px-1.5 py-0.5 text-[10px] uppercase text-fd-warning">{source.simulated ? 'simulated input' : 'live source'}</span></p><p className="mt-1 max-w-2xl text-xs text-fd-muted-foreground">{source.description}</p></div>
          <div className="flex flex-wrap gap-2">{source.cases.map(input => <button className={button} key={input.id} title={input.description} disabled={busy || !snapshot.ready || snapshot.activeRunId !== null} onClick={() => { void simulate(source.id, input.id) }} type="button">{t(busy ? 'Starting…' : input.title)}</button>)}</div>
        </div>)}</div>
        {snapshot && !snapshot.sources.length && <p className="mt-3 text-sm text-fd-warning">{t("No event source is enabled. Enable the simulator or install an input-source plugin.")}</p>}
      </section>}
      {props.view !== 'history' && <section aria-label={t("LAI agents")}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-medium">{t("1 orchestrator + 5 subagents")}</h2><p className="text-xs text-fd-muted-foreground">{t("The orchestrator monitors inputs and delegates sequentially to five specialist agents.")}</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">{ROLES.map((role, index) => {
          const worker = snapshot?.workers.find(item => item.role === role.id)
          return <article className={`${panel} relative overflow-hidden`} key={role.id} style={{ borderTop: `3px solid ${role.color}` }}>
            <div className="flex items-center justify-between gap-2"><span className="text-xs tabular-nums" style={{ color: role.color }}>0{index + 1}</span><span className={`text-[11px] uppercase ${stateColor(worker?.state ?? 'starting')}`}>{t(worker?.state ?? 'starting')}</span></div>
            <h3 className="mt-3 text-sm font-medium">{t(role.name)}</h3><p className="mt-1 min-h-8 text-xs text-fd-muted-foreground">{t(role.purpose)}</p>
            <p className="mt-3 truncate font-mono text-[10px] text-fd-muted-foreground" title={worker?.model}>{worker?.model ?? 'Model from settings'}</p>
            <p className="mt-1 truncate font-mono text-[9px] text-fd-muted-foreground" title={worker?.sessionId}>{worker?.sessionId ?? t('Waiting for an event')}</p>
            {worker?.error && <p className="mt-2 break-words text-xs text-fd-danger">{worker.error}</p>}
          </article>
        })}</div>
      </section>}
      <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]" aria-label={t("Pipeline runs")}>
        <aside className={panel}><h2 className="mb-3 text-sm font-medium">{t("History")}</h2><div className="space-y-2">{snapshot?.runs.map(item => <button className={`w-full rounded-lg border p-3 text-left ${item.id === selectedId ? 'border-fd-primary/50 bg-fd-secondary' : 'border-fd-border hover:bg-fd-muted'}`} key={item.id} onClick={() => { setSelectedId(item.id); setSelectedRole(null) }} type="button">
          <p className="break-words text-sm">{item.event.title}</p><p className={`mt-1 text-xs ${stateColor(item.status)}`}>{t(item.status)}</p><p className="mt-1 text-[10px] text-fd-muted-foreground">{date(item.createdAt)}</p>
        </button>)}</div>{snapshot?.runs.length === 0 && <p className="text-xs text-fd-muted-foreground">{t("No events yet. Simulate an input above to start the six-stage flow.")}</p>}</aside>
        <div className={`${panel} min-w-0`}>
          {run ? <>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="break-words text-sm font-medium">{run.event.title}</h2><p className="mt-1 text-xs text-fd-muted-foreground">{run.event.type} · {run.event.sourceId} · {run.event.simulated ? 'simulation' : 'live event'}</p></div><span className={`text-xs uppercase ${stateColor(run.status)}`}>{t(run.status)}</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{run.stages.map(item => <button className={`rounded-md border px-2 py-2 text-left text-xs ${stage?.role === item.role ? 'border-fd-primary' : 'border-fd-border'}`} key={item.role} onClick={() => { setSelectedRole(item.role) }} type="button"><span className="block">{ROLES.find(role => role.id === item.role)?.name}</span><span className={`mt-1 block ${stateColor(item.status)}`}>{t(item.status)}</span></button>)}</div>
            <RunFacts run={run} />
            {stage && <div className="mt-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{ROLES.find(role => role.id === stage.role)?.name}{t(" output")}</h3>{stage.startedAt && <span className="text-xs text-fd-muted-foreground">{Math.max(0, Math.round(((stage.endedAt ?? Date.now()) - stage.startedAt) / 1000))}{t("s")}</span>}</div>{stage.error && <p className="mb-2 text-sm text-fd-danger" role="alert">{stage.error}</p>}<pre className="fd-scroll max-h-[36rem] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-fd-border bg-fd-muted p-3 font-sans text-sm leading-relaxed">{stage.result?.text || (stage.status === 'running' ? 'Agent is analyzing the evidence…' : 'This stage has not produced an output.')}</pre></div>}
          </> : <div className="flex min-h-48 flex-col justify-center gap-2 text-sm text-fd-muted-foreground"><p>{t("Select a run to inspect its six stages, evidence and outputs.")}</p><p className="text-xs">{t("The reviewer verdict stays attached to the report. Incomplete or rejected work is marked explicitly.")}</p></div>}
        </div>
      </section>

    </div>
  </div>
}

function RunFacts(props: { run: PipelineRun }) {
  const { t } = useLanguage()
  const run = props.run
  return <div className="mt-3 space-y-2 text-xs text-fd-muted-foreground">
    <p>{t("Reviewer decision: ")}<span className={stateColor(run.reviewDecision)}>{run.reviewDecision}</span> · {run.evidencePaths.length}{t(" evidence files")}</p>
    {run.error && <p className="text-fd-danger" role="alert">{run.error}</p>}
    <details><summary className="cursor-pointer">{t("Input & local artifacts")}</summary><p className="mt-2 whitespace-pre-wrap">{run.event.summary}</p><p className="mt-2 break-all font-mono">{run.artifactDirectory}</p>{run.evidencePaths.map(path => <p className="mt-1 break-all font-mono" key={path}>{path}</p>)}</details>
  </div>
}
