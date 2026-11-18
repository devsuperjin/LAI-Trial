import { useEffect, useState } from 'react'
import type { ConfigurableProvider, CredentialInfo, ModelCatalog, SettingsDescribeValue, SettingsNamespaceView, SettingsPathOp } from '../api/gateway.ts'
import { describeCredentials, describeSettings, listConfigurableProviders, modelCatalog, mutateSettings, setCredential } from '../api/gateway.ts'
import { record } from '../model/dag.ts'

const CUSTOM = '__custom__'
const PI_AI = 'llm-pi-ai'
const inputClass = 'w-full min-w-0 rounded-md border border-fd-border bg-fd-muted px-3 py-2 text-sm text-fd-foreground outline-none focus:border-fd-primary disabled:opacity-50'
const buttonClass = 'rounded-md border border-fd-border bg-fd-secondary px-3 py-2 text-sm hover:border-fd-primary disabled:cursor-not-allowed disabled:opacity-50'

function atPath(value: unknown, path: string[]): Record<string, unknown> {
  return record(path.reduce<unknown>((current, key) => record(current)[key], value))
}

function keyReference(provider: string): string {
  return `LAI_${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

interface ModelDraft {
  id: string
  name: string
  contextWindow: string
  maxTokens: string
  original: Record<string, unknown>
}

function modelDrafts(profile: Record<string, unknown>): ModelDraft[] {
  return Array.isArray(profile.models) ? profile.models.map(value => {
    const model = record(value)
    return { id: String(model.id ?? ''), name: String(model.name ?? ''), contextWindow: String(model.contextWindow ?? ''), maxTokens: String(model.maxTokens ?? ''), original: model }
  }) : []
}

function modelValues(models: ModelDraft[]): Record<string, unknown>[] {
  const ids = new Set<string>()
  return models.map((model, index) => {
    const id = model.id.trim()
    if (!id || ids.has(id)) throw new Error(`Model ${index + 1} needs a unique model ID.`)
    ids.add(id)
    const value: Record<string, unknown> = { ...model.original, id }
    if (model.name.trim()) value.name = model.name.trim()
    else delete value.name
    for (const key of ['contextWindow', 'maxTokens'] as const) {
      if (model[key].trim()) {
        const count = Number(model[key])
        if (!Number.isSafeInteger(count) || count < 1) throw new Error(`Model ${index + 1}: token limits must be positive whole numbers.`)
        value[key] = count
      } else delete value[key]
    }
    return value
  })
}

interface Snapshot {
  settings: SettingsDescribeValue
  providers: ConfigurableProvider[]
  credentials: Record<string, CredentialInfo>
  credentialError: string | null
  catalog: ModelCatalog
}

/** Provider edits use DSH's public settings and write-only credential endpoints. */
export function ProviderSettings(props: { onSaved: () => Promise<void> }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [editor, setEditor] = useState<ConfigurableProvider | 'add' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async (): Promise<Snapshot | null> => {
    setFailure(null)
    setLoading(true)
    try {
      const [settings, providers, catalog] = await Promise.all([describeSettings(), listConfigurableProviders(), modelCatalog()])
      const refs = [...new Set(providers.flatMap(provider => {
        const ns = settings.namespaces.find(view => view.ns === provider.settingsNs)
        const ref = atPath(ns?.value, provider.settingsPath).apiKeyEnv
        return typeof ref === 'string' ? [ref] : []
      }))]
      let credentials: Record<string, CredentialInfo> = {}
      let credentialError: string | null = null
      try {
        for (let i = 0; i < refs.length; i += 64) credentials = { ...credentials, ...await describeCredentials(refs.slice(i, i + 64)) }
      } catch (error) { credentialError = error instanceof Error ? error.message : String(error) }
      const next = { settings, providers, catalog, credentials, credentialError }
      setSnapshot(next)
      return next
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
      return null
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const available = snapshot?.providers.filter(provider => provider.settingsNs === PI_AI || provider.settingsNs === 'llm-deepseek') ?? []
  const configured = available.filter(provider => {
    const ns = snapshot?.settings.namespaces.find(view => view.ns === provider.settingsNs)
    return ns !== undefined && (provider.settingsPath.length === 0 || Object.keys(atPath(ns.value, provider.settingsPath)).length > 0)
  })
  const saved = async (): Promise<void> => {
    setEditor(null)
    const next = await load()
    const count = next?.catalog.groups.reduce((total, group) => total + group.models.length, 0) ?? 0
    setNotice(count ? `Provider saved. ${count} available models loaded.` : 'Provider settings saved, but DSH reports no available models. Check the API key status and model list.')
    try { await props.onSaved() } catch (error) {
      setNotice(`Provider saved, but models could not be refreshed: ${error instanceof Error ? error.message : String(error)}. Reload Settings to refresh them.`)
    }
  }

  return (
    <section className="rounded-xl border border-fd-border bg-fd-card p-5" aria-label="Model providers">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-medium">Model providers</h2>
          <p className="mt-1 text-sm text-fd-muted-foreground">Connect a provider or your own API endpoint, then choose its models below.</p>
        </div>
        <button className={buttonClass} disabled={loading || !snapshot?.settings.writable || editor !== null} onClick={() => { setNotice(null); setEditor('add') }} type="button">Add provider</button>
      </div>
      {loading && <p className="mt-4 text-sm text-fd-muted-foreground" role="status">Loading providers…</p>}
      {failure !== null && <div className="mt-4 text-sm text-fd-danger" role="alert">{failure} <button className={buttonClass} onClick={() => { void load() }} type="button">Retry</button></div>}
      {notice !== null && <p className="mt-3 text-sm text-fd-muted-foreground" role="status">{notice}</p>}
      {snapshot !== null && !loading && <>
        {!snapshot.settings.writable && <p className="mt-3 text-sm text-fd-warning">This profile is read-only; provider changes are disabled.</p>}
        {snapshot.credentialError && <p className="mt-3 text-xs text-fd-warning">Could not read API key status: {snapshot.credentialError}</p>}
        <div className="mt-4 space-y-2">
          {configured.map(provider => <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fd-border px-3 py-2" key={provider.provider}>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium">{provider.displayName} <span className="font-mono text-xs text-fd-muted-foreground">{provider.provider}</span></p>
              {provider.error && <p className="mt-1 break-words text-xs text-fd-warning">{provider.error}</p>}
              {(() => {
                const ns = snapshot.settings.namespaces.find(item => item.ns === provider.settingsNs)
                const ref = atPath(ns?.value, provider.settingsPath).apiKeyEnv
                const info = typeof ref === 'string' ? snapshot.credentials[ref] : undefined
                return info ? <p className={`mt-1 text-xs ${info.configured ? 'text-fd-success' : 'text-fd-warning'}`}>{info.configured ? 'API key configured' : 'API key not configured — enter and save a key to make models available'}</p> : null
              })()}
              {snapshot.catalog.failures.filter(failure => failure.id === provider.provider).map(failure => <p className="mt-1 break-words text-xs text-fd-danger" key={failure.id}>{failure.message}</p>)}
            </div>
            <button className={buttonClass} disabled={editor !== null} onClick={() => { setNotice(null); setEditor(provider) }} type="button">Configure {provider.displayName}</button>
          </div>)}
          {configured.length === 0 && editor === null && <p className="text-sm text-fd-muted-foreground">No providers configured. Add one to make models available.</p>}
        </div>
        {editor !== null && <ProviderEditor
          key={editor === 'add' ? 'add' : editor.provider}
          entry={editor === 'add' ? null : editor}
          snapshot={snapshot}
          available={available}
          onCancel={() => { setEditor(null); void load() }}
          onSaved={saved}
        />}
      </>}
    </section>
  )
}

function ProviderEditor(props: { entry: ConfigurableProvider | null; snapshot: Snapshot; available: ConfigurableProvider[]; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [choice, setChoice] = useState(props.entry?.provider ?? CUSTOM)
  const [route, setRoute] = useState(props.entry?.provider ?? '')
  const selected = props.available.find(provider => provider.provider === choice)
  const custom = choice === CUSTOM
  const nsName = selected?.settingsNs ?? PI_AI
  const path = selected?.settingsPath ?? ['providers', route.trim()]
  const initialNamespace = props.snapshot.settings.namespaces.find(ns => ns.ns === nsName)
  const [namespace, setNamespace] = useState<SettingsNamespaceView | undefined>(initialNamespace)
  const initialProfile = atPath(initialNamespace?.value, props.entry?.settingsPath ?? [])
  const [original, setOriginal] = useState<Record<string, unknown>>(props.entry ? initialProfile : {})
  const [displayName, setDisplayName] = useState(String(props.entry ? initialProfile.displayName ?? '' : ''))
  const [baseURL, setBaseURL] = useState(String(props.entry ? initialProfile.baseURL ?? '' : ''))
  const [api, setApi] = useState(String(props.entry ? initialProfile.api ?? '' : 'openai-completions'))
  const [models, setModels] = useState<ModelDraft[]>(props.entry ? modelDrafts(initialProfile) : [])
  const [apiKey, setApiKey] = useState('')
  const [credential, setCredentialInfo] = useState<CredentialInfo | null>(null)
  const [credentialError, setCredentialError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [keyPending, setKeyPending] = useState(false)
  const declared = custom || selected?.declared === true
  const keyRef = typeof original.apiKeyEnv === 'string' ? original.apiKeyEnv : keyReference(selected?.provider ?? route)
  const disabled = !props.snapshot.settings.writable || busy || namespace === undefined
  const profileDisabled = disabled || keyPending

  useEffect(() => {
    let active = true
    setCredentialInfo(null)
    setCredentialError(null)
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(keyRef)) {
      void describeCredentials([keyRef]).then(result => { if (active) setCredentialInfo(result[keyRef] ?? null) }).catch(error => {
        if (active) setCredentialError(error instanceof Error ? error.message : String(error))
      })
    }
    return () => { active = false }
  }, [keyRef])

  const choose = (value: string): void => {
    const provider = props.available.find(entry => entry.provider === value)
    const nextNamespace = props.snapshot.settings.namespaces.find(ns => ns.ns === (provider?.settingsNs ?? PI_AI))
    const profile = provider ? atPath(nextNamespace?.value, provider.settingsPath) : {}
    setChoice(value)
    setRoute(provider?.provider ?? '')
    setNamespace(nextNamespace)
    setOriginal(profile)
    setDisplayName(String(profile.displayName ?? ''))
    setBaseURL(String(profile.baseURL ?? ''))
    setApi(String(profile.api ?? (value === CUSTOM ? 'openai-completions' : '')))
    setModels(modelDrafts(profile))
    setApiKey('')
    setFailure(null)
  }

  const save = async (): Promise<void> => {
    if (disabled || !namespace) return
    setFailure(null)
    setBusy(true)
    try {
      if (keyPending && !apiKey.trim()) throw new Error('Enter the API key to finish saving this provider, or cancel to leave its credentials unchanged.')
      if (apiKey.trim() && /\s/.test(apiKey.trim())) throw new Error('The API key must not contain spaces or line breaks.')
      if (!keyPending) {
        const id = selected?.provider ?? route.trim()
        if (custom && !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Use a provider ID starting with a lowercase letter, with letters, digits and hyphens only.')
        if (custom && props.snapshot.providers.some(provider => provider.provider === id)) throw new Error('This provider ID already exists. Configure the existing provider instead.')
        if (baseURL.trim()) {
          const url = new URL(baseURL.trim())
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP or HTTPS endpoint without credentials in the URL.')
        }
        if (declared && (!baseURL.trim() || !api || models.length === 0)) throw new Error('A custom provider needs an API endpoint, protocol and at least one model.')
        const values = modelValues(models)
        const ops: SettingsPathOp[] = []
        const field = (name: string, value: unknown): void => {
          if (JSON.stringify(value) === JSON.stringify(original[name])) return
          ops.push(value === undefined ? { op: 'unset', path: [...path, name] } : { op: 'set', path: [...path, name], value })
        }
        if (custom) ops.push({ op: 'set', path, value: { displayName: displayName.trim() || id, baseURL: baseURL.trim(), api, models: values, ...(apiKey.trim() ? { apiKeyEnv: keyRef } : {}) } })
        else {
          if (nsName === PI_AI) { field('displayName', displayName.trim() || undefined); field('api', api || undefined) }
          field('baseURL', baseURL.trim() || undefined)
          if (JSON.stringify(models) !== JSON.stringify(modelDrafts(original))) field('models', models.length ? values : undefined)
          if (apiKey.trim()) field('apiKeyEnv', keyRef)
          // A dormant catalog route is activated by materializing its empty profile.
          if (ops.length === 0 && path.length > 0 && Object.keys(original).length === 0) ops.push({ op: 'set', path, value: {} })
        }
        if (ops.length > 0) {
          const updated = await mutateSettings(namespace.ns, ops, namespace.revision)
          setNamespace(updated)
          setOriginal(atPath(updated.value, path))
        }
        if (apiKey.trim()) setKeyPending(true)
      }
      if (apiKey.trim()) {
        try { await setCredential(keyRef, apiKey.trim()) } catch {
          throw new Error('Provider settings were saved, but the API key could not be stored. Retry API key to finish, or cancel and configure the provider again.')
        }
        setApiKey('')
        setKeyPending(false)
      }
      await props.onSaved()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally { setBusy(false) }
  }

  const changeModel = (index: number, key: Exclude<keyof ModelDraft, 'original'>, value: string): void => {
    setModels(current => current.map((model, i) => i === index ? { ...model, [key]: value } : model))
  }

  return (
    <form className="mt-4 space-y-4 rounded-lg border border-fd-border bg-fd-muted/30 p-4" onSubmit={event => { event.preventDefault(); void save() }}>
      <h3 className="text-sm font-medium">{props.entry ? `Configure ${props.entry.displayName}` : 'Add model provider'}</h3>
      {!props.entry && <label className="block text-xs text-fd-muted-foreground">Provider
        <select className={`${inputClass} mt-1`} value={choice} disabled={!props.snapshot.settings.writable || busy || keyPending} onChange={event => { choose(event.target.value) }}>
          <option value={CUSTOM}>Custom API / local server</option>
          {props.available.map(provider => <option key={provider.provider} value={provider.provider}>{provider.displayName} ({provider.provider})</option>)}
        </select>
      </label>}
      {namespace === undefined && <p className="text-sm text-fd-warning">The provider adapter is not mounted in this profile.</p>}
      <fieldset className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2" disabled={profileDisabled}>
        {custom && <label className="text-xs text-fd-muted-foreground">Provider ID<input className={`${inputClass} mt-1`} value={route} onChange={e => { setRoute(e.target.value) }} placeholder="my-gateway" required /></label>}
        {nsName === PI_AI && <label className="text-xs text-fd-muted-foreground">Display name<input className={`${inputClass} mt-1`} value={displayName} onChange={e => { setDisplayName(e.target.value) }} placeholder={selected?.displayName ?? 'My gateway'} /></label>}
        <label className="text-xs text-fd-muted-foreground">API endpoint<input className={`${inputClass} mt-1`} value={baseURL} onChange={e => { setBaseURL(e.target.value) }} placeholder={selected?.defaultBaseURL ?? 'https://api.example.com/v1'} type="url" required={declared} /></label>
        {nsName === PI_AI && <label className="text-xs text-fd-muted-foreground">API protocol<select className={`${inputClass} mt-1`} value={api} onChange={e => { setApi(e.target.value) }}>
          <option value="">Use provider defaults</option>
          <option value="openai-completions">OpenAI compatible (Chat Completions)</option>
          <option value="openai-responses">OpenAI Responses</option>
          <option value="anthropic-messages">Anthropic Messages</option>
          {api && !['openai-completions', 'openai-responses', 'anthropic-messages'].includes(api) && <option value={api}>{api}</option>}
        </select></label>}
      </fieldset>
      <label className="block text-xs text-fd-muted-foreground">API key
        <input className={`${inputClass} mt-1`} type="password" autoComplete="new-password" value={apiKey} onChange={event => { setApiKey(event.target.value) }} disabled={disabled || credential?.writable === false} placeholder={credential?.configured ? 'Configured — leave blank to keep existing key' : 'Enter API key, or leave blank for native authentication'} />
      </label>
      <p className="text-xs text-fd-muted-foreground">Keys are stored separately by DSH and never displayed here. Leaving this field blank keeps existing credentials. Local OpenAI-compatible servers may require a placeholder key.</p>
      {credentialError && <p className="text-xs text-fd-warning" role="status">Credential status is unavailable. {credentialError}</p>}
      {credential?.writable === false && <p className="text-xs text-fd-warning">This credential is read-only. Update it at its source.</p>}
      <fieldset className="min-w-0 space-y-3" disabled={profileDisabled}>
        <legend className="mb-2 text-sm font-medium">Models</legend>
        <p className="text-xs text-fd-muted-foreground">{declared ? 'Declare the model IDs served by this endpoint.' : 'Leave the list empty to use the provider catalog. An explicit list replaces that catalog.'} Token limits are optional.</p>
        {models.map((model, index) => <div className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border border-fd-border p-3 sm:grid-cols-2" key={index}>
          <label className="text-xs text-fd-muted-foreground">Model ID<input className={`${inputClass} mt-1`} value={model.id} onChange={e => { changeModel(index, 'id', e.target.value) }} required /></label>
          <label className="text-xs text-fd-muted-foreground">Model name<input className={`${inputClass} mt-1`} value={model.name} onChange={e => { changeModel(index, 'name', e.target.value) }} /></label>
          <label className="text-xs text-fd-muted-foreground">Context window<input className={`${inputClass} mt-1`} type="number" min="1" step="1" value={model.contextWindow} onChange={e => { changeModel(index, 'contextWindow', e.target.value) }} /></label>
          <label className="text-xs text-fd-muted-foreground">Maximum output tokens<input className={`${inputClass} mt-1`} type="number" min="1" step="1" value={model.maxTokens} onChange={e => { changeModel(index, 'maxTokens', e.target.value) }} /></label>
          <button className={`${buttonClass} justify-self-start`} type="button" onClick={() => { setModels(current => current.filter((_, i) => i !== index)) }}>Remove model {index + 1}</button>
        </div>)}
        <button className={buttonClass} type="button" onClick={() => { setModels(current => [...current, { id: '', name: '', contextWindow: '', maxTokens: '', original: {} }]) }}>Add model</button>
      </fieldset>
      {failure !== null && <div className="space-y-1" role="alert"><p className="break-words text-sm text-fd-danger">{failure}</p>{!keyPending && <p className="text-xs text-fd-muted-foreground">If settings changed elsewhere, cancel and reopen this provider before saving again.</p>}</div>}
      <div className="flex flex-wrap gap-2">
        <button className="rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled} type="submit">{busy ? 'Saving…' : keyPending ? 'Retry API key' : 'Save provider'}</button>
        <button className={buttonClass} disabled={busy} type="button" onClick={props.onCancel}>Cancel</button>
      </div>
    </form>
  )
}
