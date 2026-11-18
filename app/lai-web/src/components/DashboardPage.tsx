import { useLanguage } from '../i18n.tsx'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SessionListEntry } from '../api/gateway.ts'
import type { RunStatus } from '../model/dashboard.ts'
import { deriveDashboard, formatDuration, formatTokens, STATUS_HUE } from '../model/dashboard.ts'

const STATUS_LABEL: Record<RunStatus, string> = { running: 'Running', completed: 'Completed', failed: 'Failed' }

function StatCard(props: { label: string; value: string; sub?: string; hue: string }) {
  const { t } = useLanguage()
  return (
    <div className="relative overflow-hidden rounded-xl border border-fd-border bg-fd-card p-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: props.hue }} />
      <p className="text-xs uppercase tracking-wider text-fd-muted-foreground">{t(props.label)}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: props.hue }}>{props.value}</p>
      {props.sub !== undefined && <p className="mt-0.5 text-xs text-fd-muted-foreground">{props.sub}</p>}
    </div>
  )
}

function Donut(props: { segments: { label: string; count: number; hue: string }[]; total: number }) {
  const { t } = useLanguage()
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="flex items-center gap-5">
      <svg aria-hidden height="140" viewBox="0 0 140 140" width="140">
        <circle cx="70" cy="70" fill="none" r={radius} stroke="var(--color-fd-secondary)" strokeWidth="16" />
        {props.segments.filter(segment => segment.count > 0).map((segment) => {
          const fraction = props.total > 0 ? segment.count / props.total : 0
          const dash = fraction * circumference
          const element = (
            <circle
              cx="70"
              cy="70"
              fill="none"
              key={segment.label}
              r={radius}
              stroke={segment.hue}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              strokeWidth="16"
              transform="rotate(-90 70 70)"
            />
          )
          offset += dash
          return element
        })}
        <text fill="var(--color-fd-foreground)" fontSize="26" fontWeight="600" textAnchor="middle" x="70" y="66">{props.total}</text>
        <text fill="var(--color-fd-muted-foreground)" fontSize="11" textAnchor="middle" x="70" y="84">{t("runs")}</text>
      </svg>
      <ul className="space-y-2">
        {props.segments.map(segment => (
          <li className="flex items-center gap-2 text-sm" key={segment.label}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: segment.hue }} />
            <span className="text-fd-muted-foreground">{segment.label}</span>
            <span className="ml-auto font-medium tabular-nums">{segment.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function BarRow(props: { label: string; value: number; max: number; hue: string; detail: string }) {
  const { t } = useLanguage()
  const width = props.max > 0 ? Math.max(2, (props.value / props.max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-fd-foreground">{t(props.label)}</span>
        <span className="shrink-0 tabular-nums text-fd-muted-foreground">{props.detail}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-fd-secondary">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ background: props.hue, width: `${width}%` }} />
      </div>
    </div>
  )
}

function Panel(props: { title: string; children: ReactNode; className?: string }) {
  const { t } = useLanguage()
  return (
    <section className={`rounded-xl border border-fd-border bg-fd-card p-4 ${props.className ?? ''}`}>
      <h3 className="mb-3 text-sm font-medium text-fd-foreground">{t(props.title)}</h3>
      {props.children}
    </section>
  )
}

export function DashboardPage(props: { entries: SessionListEntry[]; onOpenRun: (id: string) => void }) {
  const { t } = useLanguage()
  const model = useMemo(() => deriveDashboard(props.entries), [props.entries])
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'all'>('all')
  const visibleRuns = model.runs.filter(run => statusFilter === 'all' || run.status === statusFilter)
  const maxStageTokens = Math.max(1, ...model.stageStats.map(stage => stage.tokens))
  const maxPreset = Math.max(1, ...model.presetBreakdown.map(row => row.count))
  const maxTimeline = Math.max(1, ...model.tokenTimeline.map(row => row.tokens))
  const { totals } = model


  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div><h1 className="text-xl font-medium">{t("Dashboard")}</h1><p className="mt-1 text-sm text-fd-muted-foreground">{t("Run outcomes, agent activity, and token usage at a glance.")}</p></div>
        {totals.runs === 0 && <p className="rounded-lg border border-fd-border bg-fd-muted p-4 text-sm text-fd-muted-foreground">{t("No runs yet. Open Pipeline to simulate an input, or start a task in DSH.")}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard hue="var(--color-fd-primary)" label={t("Total runs")} sub={`${totals.subagents} subagents`} value={String(totals.runs)} />
          <StatCard hue={STATUS_HUE.completed} label={t("Completed")} value={String(totals.completed)} />
          <StatCard hue={STATUS_HUE.running} label={t("Running")} value={String(totals.running)} />
          <StatCard hue={STATUS_HUE.failed} label={t("Failed")} value={String(totals.failed)} />
          <StatCard hue="var(--color-fd-warning)" label={t("Tokens")} sub={`${formatTokens(totals.outputTokens)} output`} value={formatTokens(totals.tokens)} />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title={t("Outcome")}>
            <Donut
              segments={model.statusBreakdown.map(row => ({ label: STATUS_LABEL[row.status], count: row.count, hue: row.hue }))}
              total={totals.runs}
            />
            <p className="mt-3 text-xs text-fd-muted-foreground">{t("Success rate")}{' '}
              <span className="font-medium text-fd-success">
                {model.successRate !== null ? `${Math.round(model.successRate * 100)}%` : '—'}
              </span>{' '}{t("of settled runs")}</p>
          </Panel>

          <Panel title={t("Runs by preset")}>
            <div className="space-y-3">
              {model.presetBreakdown.map(row => (
                <BarRow detail={`${row.count} run${row.count === 1 ? '' : 's'}`} hue={row.hue} key={row.preset} label={row.preset} max={maxPreset} value={row.count} />
              ))}
            </div>
          </Panel>

          <Panel title={t("Model usage")}>
            <div className="space-y-3">
              {model.modelBreakdown.map(row => (
                <BarRow detail={`${formatTokens(row.tokens)} tok · ${row.count}`} hue={row.hue} key={row.model} label={row.model} max={Math.max(1, ...model.modelBreakdown.map(item => item.tokens))} value={row.tokens} />
              ))}
            </div>
          </Panel>
        </div>

        <Panel title={t("Pipeline stage activity")}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {model.stageStats.map(stage => (
              <div className="rounded-lg border border-fd-border bg-fd-muted/40 p-3" key={stage.label}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.hue }} />
                  <span className="text-sm font-medium">{stage.label}</span>
                  <span className="ml-auto text-xs tabular-nums text-fd-muted-foreground">{stage.runs}×</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-fd-secondary">
                  <div className="h-full rounded-full" style={{ background: stage.hue, width: `${(stage.tokens / maxStageTokens) * 100}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-fd-muted-foreground">
                  <span>{formatTokens(stage.tokens)}{t(" tok")}</span>
                  <span>{stage.avgMs !== null ? `avg ${formatDuration(stage.avgMs)}` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={t("Tokens per run (chronological)")}>
          <div className="flex h-36 items-end gap-2">
            {model.tokenTimeline.map(row => (
              <button
                className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                key={row.sessionId}
                onClick={() => { props.onOpenRun(row.sessionId) }}
                title={`${row.title} · ${formatTokens(row.tokens)} tokens`}
                type="button"
              >
                <span className="text-[10px] tabular-nums text-fd-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">{formatTokens(row.tokens)}</span>
                <span
                  className="w-full rounded-t transition-[height] duration-500 group-hover:opacity-80"
                  style={{ background: row.hue, height: `${Math.max(3, (row.tokens / maxTimeline) * 100)}%` }}
                />
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={t("Runs")}>
          <div className="mb-3 flex items-center gap-1">
            {(['all', 'completed', 'running', 'failed'] as const).map(candidate => (
              <button
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${statusFilter === candidate ? 'bg-fd-secondary text-fd-foreground' : 'text-fd-muted-foreground hover:text-fd-foreground'}`}
                key={candidate}
                onClick={() => { setStatusFilter(candidate) }}
                type="button"
              >
                {t(candidate === 'all' ? 'All' : STATUS_LABEL[candidate])}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-fd-border text-xs uppercase tracking-wider text-fd-muted-foreground">
                  <th className="pb-2 pr-3 font-normal">{t("Run")}</th>
                  <th className="pb-2 pr-3 font-normal">{t("Status")}</th>
                  <th className="pb-2 pr-3 font-normal">{t("Stages")}</th>
                  <th className="pb-2 pr-3 font-normal">{t("Tokens")}</th>
                  <th className="pb-2 pr-3 font-normal">{t("Duration")}</th>
                  <th className="pb-2 font-normal">{t("Model")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.map(run => (
                  <tr
                    className="cursor-pointer border-b border-fd-border/50 transition-colors hover:bg-fd-secondary/40"
                    key={run.sessionId}
                    onClick={() => { props.onOpenRun(run.sessionId) }}
                  >
                    <td className="max-w-56 truncate py-2 pr-3">
                      <span className="block truncate">{run.title}</span>
                      <span className="block truncate font-mono text-xs text-fd-muted-foreground">{run.sessionId}</span>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: `color-mix(in srgb, ${STATUS_HUE[run.status]} 33%, transparent)`, color: STATUS_HUE[run.status] }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_HUE[run.status] }} />
                        {t(STATUS_LABEL[run.status])}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-fd-muted-foreground">{run.settledChildren}/{run.childCount}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatTokens(run.tokens)}</td>
                    <td className="py-2 pr-3 tabular-nums text-fd-muted-foreground">{run.durationMs !== null ? formatDuration(run.durationMs) : '—'}</td>
                    <td className="max-w-40 truncate py-2 font-mono text-xs text-fd-muted-foreground">{run.model ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRuns.length === 0 && <p className="py-6 text-center text-xs text-fd-muted-foreground">{t("no runs match this filter")}</p>}
          </div>
        </Panel>
      </div>
    </div>
  )
}
