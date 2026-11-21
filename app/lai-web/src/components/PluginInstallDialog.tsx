import { useEffect, useRef, useState } from 'react'
import { cancelPluginInstall, installPluginBundle, type PluginChange } from '../api/gateway.ts'
import { useLanguage } from '../i18n.tsx'

export function PluginInstallDialog({ initialSpec = '', onClose, onChanged }: { initialSpec?: string; onClose: () => void; onChanged: () => void }) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const request = useRef<string | null>(null)
  const [spec, setSpec] = useState(initialSpec)
  const [busy, setBusy] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [result, setResult] = useState<PluginChange | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { const node = dialog.current!; node.showModal(); return () => node.close() }, [])
  async function install() {
    request.current = crypto.randomUUID(); setBusy(true); setResult(null); setError('')
    try { const next = await installPluginBundle(spec.trim(), request.current); setResult(next); onChanged() }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { request.current = null; setBusy(false); setCancelling(false) }
  }
  async function cancel() {
    if (!request.current) return
    setCancelling(true)
    try { await cancelPluginInstall(request.current) }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setCancelling(false) }
  }
  const failed = result?.application === 'failed'
  return <dialog ref={dialog} aria-labelledby="plugin-install-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }} className="m-auto w-[min(48rem,calc(100vw-2rem))] max-w-none rounded-xl border border-fd-border bg-fd-card p-0 text-fd-foreground shadow-xl backdrop:bg-black/45">
    <header className="flex items-center justify-between border-b border-fd-border px-5 py-4"><h2 id="plugin-install-title" className="font-semibold">{t('Add plugin')}</h2><button type="button" disabled={busy} aria-label={t('Close')} onClick={onClose}>×</button></header>
    <div className="fd-scroll max-h-[70vh] space-y-4 overflow-y-auto p-5">
      <label className="block text-sm font-medium">{t('Package or repository')}<input autoFocus value={spec} disabled={busy} onChange={event => setSpec(event.target.value)} placeholder="dsh-plugin-example@1.0.0 / github:owner/repo" className="mt-2 w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-fd-primary" /></label>
      <p className="text-xs leading-5 text-fd-muted-foreground">{t('Install a DSH Bundle from npm, a Git repository or a server-local path. It will be enabled in the current Profile.')}</p>
      {busy && <p role="status" className="text-sm text-fd-muted-foreground">{t(cancelling ? 'Cancelling installation…' : 'Installing plugin…')}</p>}
      {error && <p role="alert" className="text-sm text-fd-danger">{error}</p>}
      {result && <div role="status" className="space-y-3"><p className={`text-sm font-medium ${failed ? 'text-fd-danger' : 'text-fd-foreground'}`}>{t(result.application === 'restart-required' ? 'Installed — restart required.' : result.application === 'cancelled' ? 'Installation cancelled.' : failed ? 'Plugin installation failed.' : result.application === 'overridden' ? 'Saved, but overridden by another configuration layer.' : 'Plugin installed.')}</p>
        {result.error && <p className="break-words text-xs text-fd-danger">{result.error.diagnostic ?? result.error.code}</p>}
        {result.warnings?.map(warning => <p key={warning} className="text-xs text-fd-warning">{warning}</p>)}
        {!!result.pendingBuilds?.length && <p className="text-xs text-fd-warning">{t('Build scripts require approval in DSH: ')}{result.pendingBuilds.join(', ')}</p>}
        {result.packageResult && <><div className="flex items-center justify-between text-xs text-fd-muted-foreground"><span>{t('Installation details')}</span><span>{t('Exit code')} {result.packageResult.exitCode}</span></div><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-fd-border bg-fd-muted p-3 font-mono text-xs">{result.packageResult.output || '—'}</pre>{result.packageResult.truncated && <p className="text-xs text-fd-muted-foreground">{t('Output truncated. Full log: ')}{result.packageResult.logPath}</p>}</>}
      </div>}
    </div>
    <footer className="flex justify-end gap-2 border-t border-fd-border px-5 py-3"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-fd-border px-4 py-2 text-sm disabled:opacity-40">{t('Close')}</button>{busy ? <button type="button" disabled={cancelling} onClick={() => void cancel()} className="rounded-lg border border-fd-border px-4 py-2 text-sm disabled:opacity-40">{t('Cancel installation')}</button> : <button type="button" disabled={!spec.trim() || !!(result && !['failed', 'cancelled'].includes(result.application))} onClick={() => void install()} className="rounded-lg bg-fd-primary px-4 py-2 text-sm text-white disabled:opacity-40">{t(result ? 'Retry' : 'Install')}</button>}</footer>
  </dialog>
}
