import { AnimatedDisclosure } from '../components/AnimatedDisclosure.tsx'
import { useCallback, useEffect, useState } from 'react'
import { describeSettings, listManagedBundles, listManagedPlugins, removePluginBundle, setBundleEnabled, setPluginEnabled, type ManagedBundle, type ManagedPlugin, type PluginMeta, type PluginChange, type SettingsDescribeValue, type SettingsNamespaceView } from '../api/gateway.ts'
import { useLanguage } from '../i18n.tsx'
import { PagePanel, RefreshAction } from '../layout/PageLayout.tsx'
import { Switch } from '../components/Switch.tsx'
import { PluginSettingsDialog } from '../components/PluginSettingsDialog.tsx'
import { PluginInstallDialog } from '../components/PluginInstallDialog.tsx'

export function PluginSettingsPage({ active }: { active: boolean }) {
  const { t, language } = useLanguage()
  const [data, setData] = useState<{ bundles: ManagedBundle[]; plugins: ManagedPlugin[]; settings: SettingsDescribeValue } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<SettingsNamespaceView | null>(null)
  const [install, setInstall] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ManagedBundle | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const results = await Promise.allSettled([listManagedBundles(), listManagedPlugins(), describeSettings()] as const)
    if (results[0].status === 'fulfilled' && results[1].status === 'fulfilled' && results[2].status === 'fulfilled') setData({ bundles: results[0].value, plugins: results[1].value, settings: results[2].value })
    else setError(results.filter(result => result.status === 'rejected').map(result => String((result as PromiseRejectedResult).reason)).join('\n'))
    setLoading(false)
  }, [])
  useEffect(() => { if (active) void load() }, [active, load])
  const local = (value?: string | Record<string, string>) => typeof value === 'string' ? value : value?.[language] ?? value?.en ?? Object.values(value ?? {})[0] ?? ''
  const title = (meta: PluginMeta | undefined, fallback: string) => local(meta?.title) || fallback
  const match = (...values: string[]) => values.join(' ').toLowerCase().includes(query.trim().toLowerCase())
  async function act(key: string, action: () => Promise<PluginChange>) {
    setBusy(key); setError(''); setNotice('')
    try {
      const result = await action()
      if (result.application === 'failed') throw new Error(result.error?.diagnostic ?? result.error?.code ?? t('Operation failed.'))
      setNotice(t(result.application === 'restart-required' ? 'Saved — restart required.' : result.application === 'overridden' ? 'Saved, but overridden by another configuration layer.' : 'Saved.'))
      await load(); setRemoving(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(null) }
  }
  function icon(meta?: PluginMeta) {
    return <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-fd-border bg-fd-muted/40 text-fd-muted-foreground">{meta?.icon?.startsWith('data:image/') ? <img src={meta.icon} alt="" className="h-7 w-7 object-contain" /> : <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3v4m6-4v4M6 7h12v5a6 6 0 0 1-6 6v3m-6-9H3m18 0h-3" /></svg>}</span>
  }
  const button = 'rounded-lg border border-fd-border px-3 py-1.5 text-xs hover:bg-fd-secondary disabled:opacity-40'
  const unavailable = busy !== null || install !== null || loading
  const empty = <p className="py-4 text-sm text-fd-muted-foreground">{t('No matching plugins.')}</p>
  function bundleRow(bundle: ManagedBundle) {
    const name = title(bundle.meta, bundle.name)
    return <div key={bundle.name} className="flex flex-wrap items-center justify-between gap-4 py-4">{icon(bundle.meta)}<div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{name}</h3><p className="mt-1 break-all font-mono text-xs text-fd-muted-foreground">{bundle.name}{bundle.version ? ` · v${bundle.version}` : ''}</p><p className="mt-1 text-xs leading-5 text-fd-muted-foreground">{local(bundle.meta?.description) || bundle.description}</p>{bundle.error && <p className="mt-1 text-xs text-fd-danger">{bundle.error.diagnostic ?? bundle.error.code}</p>}</div><div className="flex items-center gap-3">{bundle.removable && <button type="button" className={`${button} text-fd-danger`} disabled={unavailable} onClick={() => setRemoving(bundle)}>{t('Remove')}</button>}{bundle.availability === 'missing' ? <button type="button" className={button} disabled={unavailable} onClick={() => setInstall(bundle.installTarget?.spec ?? bundle.name)}>{t('Install')}</button> : <Switch label={`${t('Enabled')} ${name}`} checked={bundle.enabled} disabled={unavailable || !!bundle.readOnlyReason} onChange={enabled => void act(bundle.name, () => setBundleEnabled(bundle.name, enabled))} />}</div></div>
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-3"><input aria-label={t('Search plugins')} value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search plugins')} className="min-w-48 flex-1 rounded-lg border border-fd-border bg-fd-card px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-fd-primary" /><RefreshAction busy={loading} onRefresh={() => void load()} /><button type="button" disabled={unavailable} onClick={() => setInstall('')} className="rounded-lg bg-fd-primary px-4 py-2 text-sm text-white disabled:opacity-40">＋ {t('Add plugin')}</button></div>
    {error && <p role="alert" className="whitespace-pre-wrap text-sm text-fd-danger">{error}</p>}{notice && <p role="status" className="text-sm text-fd-success">{notice}</p>}
    {!data && loading && <p role="status" className="text-sm text-fd-muted-foreground">{t('Loading…')}</p>}
    {data && <>
      <PagePanel title={t('Plugin configuration')}><div className="divide-y divide-fd-border">{data.settings.namespaces.filter(ns => match(ns.ns, title(data.plugins.find(plugin => plugin.patchId === ns.ns || plugin.entryId === ns.ns)?.meta, ''))).map(ns => {
        const plugin = data.plugins.find(plugin => plugin.patchId === ns.ns || plugin.entryId === ns.ns)
        return <div key={ns.ns} className="flex items-center justify-between gap-4 py-4">{icon(plugin?.meta)}<div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{title(plugin?.meta, ns.ns)}</h3><p className="mt-1 break-all font-mono text-xs text-fd-muted-foreground">{ns.ns}</p>{plugin?.meta?.description && <p className="mt-1 text-xs text-fd-muted-foreground">{local(plugin.meta.description)}</p>}</div><button type="button" disabled={unavailable} className={button} onClick={() => setEditing(ns)}>{t('Configure')}</button></div>
      })}</div></PagePanel>
      <PagePanel title={t('Installed plugins')}><div className="divide-y divide-fd-border">{data.bundles.filter(bundle => (bundle.installed || bundle.enabled) && match(bundle.name, title(bundle.meta, ''), bundle.description ?? '')).map(bundleRow)}{!data.bundles.some(bundle => (bundle.installed || bundle.enabled) && match(bundle.name, title(bundle.meta, ''), bundle.description ?? '')) && empty}</div></PagePanel>
      <PagePanel title={t('Optional plugins')}><div className="divide-y divide-fd-border">{data.bundles.filter(bundle => !bundle.installed && !bundle.enabled && (bundle.optional || bundle.installTarget) && match(bundle.name, title(bundle.meta, ''), bundle.description ?? '')).map(bundleRow)}{!data.bundles.some(bundle => !bundle.installed && !bundle.enabled && (bundle.optional || bundle.installTarget) && match(bundle.name, title(bundle.meta, ''), bundle.description ?? '')) && empty}</div></PagePanel>
      <PagePanel><AnimatedDisclosure title={t('Runtime plugins')}><div className="divide-y divide-fd-border">{data.plugins.filter(plugin => match(plugin.moduleName, plugin.entryId, title(plugin.meta, ''))).map(plugin => <div key={plugin.entryId} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><h3 className="text-sm font-medium">{title(plugin.meta, plugin.moduleName)}</h3><p className="mt-1 break-all font-mono text-xs text-fd-muted-foreground">{plugin.entryId} · {plugin.fiberPhase ?? t('Inactive')}</p>{plugin.diagnostic && <p className="mt-1 text-xs text-fd-danger">{plugin.diagnostic}</p>}</div><Switch label={`${t('Enabled')} ${plugin.entryId}`} checked={plugin.enabled} disabled={unavailable || !!plugin.readOnlyReason} onChange={enabled => void act(plugin.entryId, () => setPluginEnabled(plugin.entryId, enabled))} /></div>)}</div></AnimatedDisclosure></PagePanel>
    </>}
    {editing && <PluginSettingsDialog namespace={editing} writable={data?.settings.writable ?? false} onSaved={() => void load()} onClose={() => setEditing(null)} />}
    {install !== null && <PluginInstallDialog initialSpec={install} onClose={() => setInstall(null)} onChanged={() => void load()} />}
    {removing && <div role="alert" className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-fd-danger/40 bg-fd-card p-4 shadow-lg"><p className="break-all text-sm">{t('Remove plugin?')} {removing.name}</p><div className="flex gap-2"><button type="button" disabled={busy !== null} className={button} onClick={() => setRemoving(null)}>{t('Cancel')}</button><button type="button" disabled={busy !== null} className={`${button} text-fd-danger`} onClick={() => void act(removing.name, () => removePluginBundle(removing.name))}>{t('Remove')}</button></div></div>}
  </div>
}
