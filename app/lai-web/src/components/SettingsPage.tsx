import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentPresetDocument, AgentPresetRow, ModelCatalog, ModelSelection, SessionListEntry, SettingsNamespaceView } from '../api/gateway.ts'
import { describeSettings, listAgentPresets, modelCatalog, readAgentPreset, updateSettings } from '../api/gateway.ts'
import { AgentPrompts } from './AgentPrompts.tsx'
import { ProviderSettings } from './ProviderSettings.tsx'
import type { AgentModelInfo } from '../model/settings.ts'
import { buildAgentModels, effectiveModel, selectionKey } from '../model/settings.ts'

interface FlatModel {
  key: string
  provider: string
  model: string
  name: string
  providerName: string
}

function flattenCatalog(catalog: ModelCatalog): FlatModel[] {
  return catalog.groups.flatMap(group => group.models.map(model => ({
    key: `${group.id}/${model.id}`,
    provider: group.id,
    model: model.id,
    name: model.name,
    providerName: group.name,
  })))
}

function ModelSelect(props: {
  value: string
  options: FlatModel[]
  disabled?: boolean
  onChange: (key: string) => void
  ariaLabel: string
}) {
  return (
    <select
      aria-label={props.ariaLabel}
      className="fd-scroll w-full rounded-md border border-fd-border bg-fd-muted px-2.5 py-1.5 font-mono text-xs text-fd-foreground outline-none transition-colors focus:border-fd-primary disabled:cursor-not-allowed disabled:opacity-50"
      disabled={props.disabled}
      onChange={(event) => { props.onChange(event.target.value) }}
      value={props.options.some(option => option.key === props.value) ? props.value : ''}
    >
      <option disabled value="">{props.options.length ? 'Select a model' : 'No models available — check provider setup'}</option>
      {props.options.map(option => (
        <option key={option.key} value={option.key}>{option.providerName} · {option.name}</option>
      ))}
    </select>
  )
}

function AgentCard(props: {
  agent: AgentModelInfo
  options: FlatModel[]
  fallback: ModelSelection
  writable: boolean
  saving: boolean
  onApply: (agent: AgentModelInfo, key: string) => void
}) {
  const effective = effectiveModel(props.agent, props.fallback)
  const [draft, setDraft] = useState(selectionKey(effective))
  useEffect(() => { setDraft(selectionKey(effective)) }, [effective.provider, effective.model])
  const dirty = draft !== selectionKey(effective)
  const source = props.agent.configured !== null ? 'pinned' : props.agent.observed !== null ? 'observed' : 'default'
  const sourceLabel = source === 'pinned' ? 'Pinned in composition' : source === 'observed' ? 'Observed from runs' : 'Inherits default'
  return (
    <div className="relative overflow-hidden rounded-xl border border-fd-border bg-fd-card p-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: props.agent.hue }} />
      <div className="mb-3 flex items-center gap-2">
        {props.agent.stage !== null && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium text-white" style={{ background: props.agent.hue }}>
            {props.agent.stage}
          </span>
        )}
        <span className="text-sm font-medium">{props.agent.role}</span>
        {props.agent.toolName !== null && (
          <span className="rounded border border-fd-border bg-fd-secondary px-1.5 py-0.5 font-mono text-[10px] text-fd-muted-foreground">{props.agent.toolName}</span>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-wider text-fd-muted-foreground">{sourceLabel}</span>
      </div>
      <p className="mb-2 font-mono text-[11px] text-fd-muted-foreground">{props.agent.presetId}</p>
      <ModelSelect
        ariaLabel={`Model for ${props.agent.role}`}
        disabled={!props.writable || props.saving}
        onChange={setDraft}
        options={props.options}
        value={draft}
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          className="rounded-md bg-fd-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!dirty || !props.writable || props.saving}
          onClick={() => { props.onApply(props.agent, draft) }}
          type="button"
        >
          {props.saving ? 'Saving…' : 'Apply'}
        </button>
        {props.agent.inherits && (
          <span className="text-[11px] text-fd-muted-foreground">Follows the orchestrator route</span>
        )}
      </div>
    </div>
  )
}

export function SettingsPage(props: { entries: SessionListEntry[] }) {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
  const [presets, setPresets] = useState<AgentPresetRow[]>([])
  const [orchestratorDoc, setOrchestratorDoc] = useState<AgentPresetDocument | null>(null)
  const [defaultNs, setDefaultNs] = useState<SettingsNamespaceView | null>(null)
  const [writable, setWritable] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [catalogBusy, setCatalogBusy] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [defaultDraft, setDefaultDraft] = useState<string>('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setLoadError(null)
    try {
      const [catalogValue, presetValue, settingsValue] = await Promise.all([
        modelCatalog(),
        listAgentPresets(),
        describeSettings(),
      ])
      setCatalog(catalogValue)
      setPresets(presetValue.presets)
      setWritable(settingsValue.writable)
      const ns = settingsValue.namespaces.find(row => row.ns === 'agent-default-model') ?? null
      setDefaultNs(ns)
      const orchestrator = presetValue.presets.find(preset => preset.id === 'iqe-orchestrator')
      setOrchestratorDoc(orchestrator !== undefined ? await readAgentPreset(orchestrator.id) : null)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const options = useMemo(() => catalog !== null ? flattenCatalog(catalog) : [], [catalog])
  const fallback: ModelSelection = catalog?.default ?? { provider: '', model: '' }
  const agents = useMemo(
    () => buildAgentModels(presets, orchestratorDoc, props.entries),
    [presets, orchestratorDoc, props.entries],
  )

  useEffect(() => {
    if (defaultNs !== null) {
      const value = defaultNs.value as { provider?: string; model?: string }
      if (value.provider !== undefined && value.model !== undefined) setDefaultDraft(`${value.provider}/${value.model}`)
    }
  }, [defaultNs])

  const refreshModels = async (): Promise<void> => {
    setCatalogBusy(true)
    setCatalogError(null)
    try {
      const [nextCatalog, settings] = await Promise.all([modelCatalog(), describeSettings()])
      setCatalog(nextCatalog)
      setDefaultNs(settings.namespaces.find(ns => ns.ns === 'agent-default-model') ?? null)
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : String(error))
      throw error
    } finally { setCatalogBusy(false) }
  }

  const applyDefault = async (key: string, role?: string): Promise<void> => {
    const option = options.find(item => item.key === key)
    if (option === undefined || defaultNs === null) return
    setSavingKey('default')
    setNotice(null)
    try {
      const updated = await updateSettings('agent-default-model', { provider: option.provider, model: option.model }, defaultNs.revision)
      setDefaultNs(updated)
      setCatalog(await modelCatalog())
      setNotice({
        kind: 'ok',
        text: role !== undefined
          ? `${role} now routes through ${option.providerName} · ${option.name} (shared default)`
          : `Default model set to ${option.providerName} · ${option.name}`,
      })
    } catch (cause) {
      setNotice({ kind: 'err', text: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      setSavingKey(null)
    }
  }

  const applyAgent = (agent: AgentModelInfo, key: string): void => {
    // Specialist routes inherit the orchestrator; applying one updates the shared default route.
    void applyDefault(key, agent.role)
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-fd-border border-t-fd-primary" />
      </div>
    )
  }

  if (loadError !== null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-fd-danger">Could not load configuration: {loadError}</p>
        <button className="rounded-md border border-fd-border bg-fd-secondary px-3 py-1.5 text-sm hover:bg-fd-muted" onClick={() => { void load() }} type="button">
          Retry
        </button>
      </div>
    )
  }

  const defaultDirty = defaultDraft !== selectionKey(fallback)

  return (
    <div className="fd-scroll min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <ProviderSettings onSaved={refreshModels} />
        <section className="rounded-xl border border-fd-border bg-fd-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-base font-semibold">Default model</h2>
            <span className="rounded-full border border-fd-success/40 bg-fd-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-fd-success">live</span>
          </div>
          <p className="mb-4 text-sm text-fd-muted-foreground">
            The route new agents use when no explicit model is pinned. Saved to the profile and applied without a restart.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label className="mb-1 block text-xs text-fd-muted-foreground" htmlFor="default-model">Provider · model</label>
              <ModelSelect
                ariaLabel="Default model"
                disabled={!writable || savingKey !== null}
                onChange={setDefaultDraft}
                options={options}
                value={defaultDraft}
              />
            </div>
            <button
              className="rounded-md bg-fd-primary px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!defaultDirty || !writable || savingKey !== null}
              onClick={() => { void applyDefault(defaultDraft) }}
              type="button"
            >
              {savingKey === 'default' ? 'Saving…' : 'Save default'}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="rounded-md border border-fd-border px-3 py-1.5 text-xs disabled:opacity-50" disabled={catalogBusy} type="button" onClick={() => { void refreshModels().catch(() => {}) }}>{catalogBusy ? 'Refreshing…' : 'Refresh models'}</button>
            {options.length === 0 && <p className="text-xs text-fd-warning">DSH has not advertised any available models. Check the provider's API key and model list above.</p>}
          </div>
          {catalogError && <p className="mt-2 text-xs text-fd-danger" role="alert">{catalogError}</p>}
          {catalog !== null && catalog.failures.length > 0 && (
            <p className="mt-3 text-xs text-fd-warning">
              {catalog.failures.length} provider catalog{catalog.failures.length === 1 ? '' : 's'} failed to load: {catalog.failures.map(failure => `${failure.name}: ${failure.message}`).join('; ')}
            </p>
          )}
          {!writable && <p className="mt-3 text-xs text-fd-warning">This profile is read-only; model changes are disabled.</p>}
        </section>

        {notice !== null && (
          <div
            className={`rounded-lg border px-4 py-2.5 text-sm ${notice.kind === 'ok' ? 'border-fd-success/40 bg-fd-success/10 text-fd-success' : 'border-fd-danger/40 bg-fd-danger/10 text-fd-danger'}`}
            role="status"
          >
            {notice.text}
          </div>
        )}

        <AgentPrompts />
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Pipeline agents</h2>
            <span className="text-xs text-fd-muted-foreground">{agents.length} presets · {options.length} model{options.length === 1 ? '' : 's'} available</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map(agent => (
              <AgentCard
                agent={agent}
                fallback={fallback}
                key={agent.presetId}
                onApply={applyAgent}
                options={options}
                saving={savingKey !== null}
                writable={writable}
              />
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-fd-muted-foreground">
            Specialist agents inherit the orchestrator&apos;s model route unless their delegation tool pins an explicit
            <span className="font-mono"> agentOptions</span> model in the composition. Applying a model here updates the shared
            default route that the pipeline follows; pinned routes are edited in the IQE composition overlay.
          </p>
        </section>
      </div>
    </div>
  )
}
