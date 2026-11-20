import { GlossaryPage } from './GlossaryPage.tsx'
import { PageHeader, PageTabs } from '../layout/PageLayout.tsx'
import { useLanguage } from '../i18n.tsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ModelCatalog, ModelSelection, SettingsNamespaceView } from '../api/gateway.ts'
import { describeSettings, modelCatalog, updateSettings } from '../api/gateway.ts'
import { GeneralSettings } from '../components/GeneralSettings.tsx'
import { ProviderSettings } from '../components/ProviderSettings.tsx'
import { selectionKey } from '../model/settings.ts'

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

function ModelConfiguration() {
  const { t } = useLanguage()
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null)
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
      const [catalogValue, settingsValue] = await Promise.all([
        modelCatalog(),
        describeSettings(),
      ])
      setCatalog(catalogValue)
      setWritable(settingsValue.writable)
      const ns = settingsValue.namespaces.find(row => row.ns === 'agent-default-model') ?? null
      setDefaultNs(ns)
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const options = useMemo(() => catalog !== null ? flattenCatalog(catalog) : [], [catalog])
  const fallback: ModelSelection = catalog?.default ?? { provider: '', model: '' }
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

  const applyDefault = async (key: string): Promise<void> => {
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
        text: `Default model set to ${option.providerName} · ${option.name}`,
      })
    } catch (cause) {
      setNotice({ kind: 'err', text: cause instanceof Error ? cause.message : String(cause) })
    } finally {
      setSavingKey(null)
    }
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
        <p className="text-sm text-fd-danger">{t("Could not load configuration: ")}{loadError}</p>
        <button className="rounded-md border border-fd-border bg-fd-secondary px-3 py-1.5 text-sm hover:bg-fd-muted" onClick={() => { void load() }} type="button">{t("Retry")}</button>
      </div>
    )
  }

  const defaultDirty = defaultDraft !== selectionKey(fallback)

  return (
    <div className="space-y-5">
        <ProviderSettings onSaved={refreshModels} />
        <section className="rounded-xl border border-fd-border bg-fd-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-base font-semibold">{t("Default model")}</h2>
            <span className="rounded-full border border-fd-success/40 bg-fd-success/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-fd-success">{t("live")}</span>
          </div>
          <p className="mb-4 text-sm text-fd-muted-foreground">{t("The route new agents use when no explicit model is pinned. Saved to the profile and applied without a restart.")}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label className="mb-1 block text-xs text-fd-muted-foreground" htmlFor="default-model">{t("Provider · model")}</label>
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
              {t(savingKey === 'default' ? 'Saving…' : 'Save default')}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="rounded-md border border-fd-border px-3 py-1.5 text-xs disabled:opacity-50" disabled={catalogBusy} type="button" onClick={() => { void refreshModels().catch(() => {}) }}>{catalogBusy ? 'Refreshing…' : 'Refresh models'}</button>
            {options.length === 0 && <p className="text-xs text-fd-warning">{t("DSH has not advertised any available models. Check the provider's API key and model list above.")}</p>}
          </div>
          {catalogError && <p className="mt-2 text-xs text-fd-danger" role="alert">{catalogError}</p>}
          {catalog !== null && catalog.failures.length > 0 && (
            <p className="mt-3 text-xs text-fd-warning">
              {catalog.failures.length}{t(" provider catalog")}{catalog.failures.length === 1 ? '' : 's'}{t(" failed to load: ")}{catalog.failures.map(failure => `${failure.name}: ${failure.message}`).join('; ')}
            </p>
          )}
          {!writable && <p className="mt-3 text-xs text-fd-warning">{t("This profile is read-only; model changes are disabled.")}</p>}
        </section>

        {notice !== null && (
          <div
            className={`rounded-lg border px-4 py-2.5 text-sm ${notice.kind === 'ok' ? 'border-fd-success/40 bg-fd-success/10 text-fd-success' : 'border-fd-danger/40 bg-fd-danger/10 text-fd-danger'}`}
            role="status"
          >
            {notice.text}
          </div>
        )}

    </div>
  )
}


export function SettingsPage() {
  const [section, setSection] = useState<'general' | 'models' | 'glossary'>('general')
  return <div className="space-y-5">
    <PageHeader page="settings" />
    <PageTabs id="settings" label="Settings sections" items={[{ id: 'general', name: 'General' }, { id: 'models', name: 'Model configuration' }, { id: 'glossary', name: 'Glossary' }]} value={section} onChange={setSection} />
    <div role="tabpanel" id="settings-panel-general" aria-labelledby="settings-tab-general" hidden={section !== 'general'}><GeneralSettings /></div>
    <div role="tabpanel" id="settings-panel-models" aria-labelledby="settings-tab-models" hidden={section !== 'models'}><ModelConfiguration /></div>
    <div role="tabpanel" id="settings-panel-glossary" aria-labelledby="settings-tab-glossary" hidden={section !== 'glossary'}><GlossaryPage /></div>
  </div>
}
