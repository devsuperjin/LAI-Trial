import { useEffect, useRef, useState } from 'react'
import { mutateSettings, type SettingsNamespaceView, type SettingsPathOp } from '../api/gateway.ts'
import { useLanguage } from '../i18n.tsx'
import { Switch } from './Switch.tsx'

type Field = { path: string[]; value: unknown; secret: boolean; configured?: boolean }
function fieldsFor(ns: SettingsNamespaceView): Field[] {
  const result: Field[] = []
  const secretPaths = ns.secrets ?? []
  function visit(value: unknown, schema: any, path: string[]) {
    const secret = secretPaths.find(entry => JSON.stringify(entry.path) === JSON.stringify(path))
    if (secret) { result.push({ path, value: '', secret: true, configured: secret.set }); return }
    const dict = schema?.dict ?? Object.assign({}, ...(schema?.type === 'intersect' ? (schema.list ?? []).map((part: any) => part.dict ?? {}) : []))
    if ((value !== null && typeof value === 'object' && !Array.isArray(value)) || schema?.type === 'object' || Object.keys(dict).length) {
      const object = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
      for (const key of new Set([...Object.keys(object), ...Object.keys(dict)])) {
        visit(object[key] ?? dict[key]?.meta?.default, dict[key], [...path, key])
      }
    } else if (path.length && !secretPaths.some(entry => path.every((part, i) => entry.path[i] === part))) {
      result.push({ path, value, secret: false })
    }
  }
  visit(ns.value, ns.schema, [])
  for (const entry of secretPaths) if (!result.some(field => JSON.stringify(field.path) === JSON.stringify(entry.path))) result.push({ path: entry.path, value: '', secret: true, configured: entry.set })
  return result
}

export function PluginSettingsDialog({ namespace, writable, onSaved, onClose }: { namespace: SettingsNamespaceView; writable: boolean; onSaved: () => void; onClose: () => void }) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const [edits, setEdits] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fields = fieldsFor(namespace)
  useEffect(() => { const node = dialog.current!; node.showModal(); return () => node.close() }, [])
  async function save() {
    setBusy(true); setError('')
    try {
      const ops: SettingsPathOp[] = fields.filter(field => Object.hasOwn(edits, JSON.stringify(field.path))).flatMap(field => {
        const edit = edits[JSON.stringify(field.path)]
        if (field.secret && edit === '') return []
        let value = edit
        if (!field.secret && typeof field.value !== 'string' && typeof field.value !== 'boolean') {
          value = JSON.parse(String(edit))
        }
        return [{ op: 'set' as const, path: field.path, value }]
      })
      if (ops.length) await mutateSettings(namespace.ns, ops, namespace.revision)
      onSaved(); onClose()
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }
  const input = 'w-full rounded-lg border border-fd-border bg-fd-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-fd-primary'
  return <dialog ref={dialog} aria-labelledby="plugin-settings-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }} className="m-auto w-[min(48rem,calc(100vw-2rem))] max-w-none rounded-xl border border-fd-border bg-fd-card p-0 text-fd-foreground shadow-xl backdrop:bg-black/45">
    <header className="flex items-center justify-between border-b border-fd-border px-5 py-4"><h2 id="plugin-settings-title" className="font-semibold">{t('Configure plugin')} · {namespace.ns}</h2><button type="button" disabled={busy} aria-label={t('Close')} onClick={onClose}>×</button></header>
    <div className="fd-scroll max-h-[65vh] space-y-4 overflow-y-auto p-5">
      <p className="text-xs text-fd-muted-foreground">{t('Only edited fields are saved. Blank secrets keep existing values.')}</p>
      {fields.map(field => { const key = JSON.stringify(field.path); const value = edits[key] ?? field.value; return <div key={key} className="space-y-2"><label htmlFor={`plugin-field-${key}`} className="block break-all text-sm font-medium">{field.path.join('.')}</label>{typeof field.value === 'boolean' && !field.secret ? <Switch label={field.path.join('.')} checked={Boolean(value)} disabled={!writable || busy} onChange={next => setEdits(current => ({ ...current, [key]: next }))} /> : field.secret || typeof field.value === 'string' || typeof field.value === 'number' ? <input id={`plugin-field-${key}`} className={input} type={field.secret ? 'password' : typeof field.value === 'number' ? 'number' : 'text'} autoComplete="off" disabled={!writable || busy} placeholder={field.secret && field.configured ? t('Configured — leave blank to keep') : ''} value={String(value ?? '')} onChange={event => setEdits(current => ({ ...current, [key]: event.target.value }))} /> : <textarea id={`plugin-field-${key}`} className={`${input} min-h-20 font-mono text-xs`} disabled={!writable || busy} value={Object.hasOwn(edits, key) ? String(edits[key]) : JSON.stringify(field.value ?? null, null, 2)} onChange={event => setEdits(current => ({ ...current, [key]: event.target.value }))} />}</div> })}
      {!fields.length && <p className="text-sm text-fd-muted-foreground">{t('No editable fields.')}</p>}
      {error && <p role="alert" className="text-sm text-fd-danger">{error}</p>}
    </div>
    <footer className="flex justify-end gap-2 border-t border-fd-border px-5 py-3"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-fd-border px-4 py-2 text-sm">{t('Cancel')}</button><button type="button" disabled={!writable || busy || !Object.keys(edits).length} onClick={() => void save()} className="rounded-lg bg-fd-primary px-4 py-2 text-sm text-white disabled:opacity-40">{t(busy ? 'Saving…' : 'Save')}</button></footer>
  </dialog>
}
