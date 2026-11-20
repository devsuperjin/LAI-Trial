import { PageHeader } from '../layout/PageLayout.tsx'
import { useEffect, useState } from 'react'
import { describeSettings, mutateSettings, listAgentPresets, type AgentPresetRow, type SettingsNamespaceView, type SettingsPathOp } from '../api/gateway.ts'
import { useLanguage } from '../i18n.tsx'

import { CredentialDialog } from '../components/CredentialDialog.tsx'
import { credentialStatus, type CredentialStatus } from '@lai/dsh-adapter/credentials'
import { emptyCredential, editCredential, type CredentialDraft, type CredentialEntry } from '../model/credentials.ts'
const button = 'rounded-lg border border-fd-border px-3 py-2 text-xs hover:bg-fd-secondary disabled:opacity-40'
export function CredentialsPage() {
  const { language } = useLanguage()
  const zh = language === 'zh'
  const [ns, setNs] = useState<SettingsNamespaceView | null>(null)
  const [status, setStatus] = useState<CredentialStatus>({})
  const [presets, setPresets] = useState<AgentPresetRow[]>([])
  const [draft, setDraft] = useState<CredentialDraft | null>(null)
  const [writable, setWritable] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const entries = (ns?.value.entries ?? {}) as Record<string, CredentialEntry>
  async function load() {
    setBusy(true); setError(''); setNotice('')
    try {
      const [settings, available] = await Promise.all([describeSettings(), listAgentPresets()])
      const found = settings.namespaces.find(value => value.ns === 'lai-credentials')
      if (!found) throw new Error(zh ? '凭证插件尚未加载，请重启服务。' : 'Credentials plugin is not loaded. Restart the service.')
      setStatus(await credentialStatus().catch(() => {
        if (!found.secrets) return {}
        const fallback: CredentialStatus = {}
        for (const id of Object.keys((found.value.entries ?? {}) as object)) fallback[id] = {
          username: found.secrets.some(secret => secret.path.join('/') === `entries/${id}/username` && secret.set),
          token: found.secrets.some(secret => secret.path.join('/') === `entries/${id}/token` && secret.set),
          password: found.secrets.some(secret => secret.path.join('/') === `entries/${id}/password` && secret.set),
        }
        return fallback
      }))
      setNs(found); setWritable(settings.writable); setPresets(available.presets); setDraft(null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])
  async function save() {
    if (!ns || !draft) return
    setBusy(true); setError(''); setNotice('')
    try {
      const id = draft.id.trim()
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error(zh ? '名称只能包含字母、数字、点、下划线和短横线。' : 'Use letters, digits, dots, underscores or hyphens for the name.')
      if (!draft.existing && Object.hasOwn(entries, id)) throw new Error(zh ? '名称已存在。' : 'Name already exists.')
      const ops: SettingsPathOp[] = []
      const port = draft.port ? Number(draft.port) : 0
      if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port')
      const metadata = { kind: draft.kind, endpoint: draft.endpoint.trim(), host: draft.host.trim(), port, allowUpdates: draft.allowUpdates, description: draft.description.trim(), service: draft.service.trim(), enabled: draft.enabled, allowedPresets: draft.allowedPresets }
      if (!draft.existing) {
        if (!draft.username && !draft.token && !draft.password && !metadata.endpoint && !metadata.host && !metadata.description && !metadata.service) throw new Error(zh ? '请至少填写一个凭证值。' : 'Provide at least one credential value.')
        ops.push({ op: 'set', path: ['entries', id], value: { ...metadata, username: draft.username, token: draft.token, password: draft.password } })
      } else {
        for (const [key, value] of Object.entries(metadata)) ops.push({ op: 'set', path: ['entries', id, key], value })
        for (const key of ['username', 'token', 'password'] as const) if (draft[key]) ops.push({ op: 'set', path: ['entries', id, key], value: draft[key] })
      }
      setNs(await mutateSettings(ns.ns, ops, ns.revision)); setDraft(null)
      setStatus(await credentialStatus().catch(() => ({})))
      setNotice(zh ? '凭证已保存。授权角色可通过工具读取。' : 'Credential saved. Authorized presets can retrieve it through tools.')
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  async function remove(id: string) {
    if (!ns) return
    setBusy(true); setError('')
    try { setNs(await mutateSettings(ns.ns, [{ op: 'unset', path: ['entries', id] }], ns.revision)); if (draft?.id === id) setDraft(null) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  return <section className="min-w-0">
    <PageHeader page="credentials" actions={<button className={button} type="button" disabled={busy || !writable} onClick={() => { setDraft(emptyCredential()); setError(''); setNotice('') }}>{zh ? '添加凭证' : 'Add credential'}</button>} />
    <p className="mt-3 rounded-lg border border-fd-warning/30 bg-fd-warning/5 p-3 text-xs leading-5 text-fd-muted-foreground">{zh ? '读取的明文会发送给该 Agent 使用的模型，并可能保存在 Run 记录中。默认不授权任何预设；密钥输入留空会保留已有值。' : 'Retrieved plaintext is sent to the agent’s model and may be stored in Run history. No presets are authorized by default. Blank secret inputs preserve existing values.'}</p>
    {error && <p role="alert" className="mt-3 text-sm text-fd-danger">{error}</p>}{notice && <p role="status" className="mt-3 text-sm text-fd-success">{notice}</p>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2">{Object.entries(entries).map(([id, entry]) => <article key={id} className="rounded-xl border border-fd-border bg-fd-card p-4"><div className="flex items-center justify-between gap-3"><h2 className="truncate font-mono text-sm font-semibold">{id}</h2><span className="text-xs text-fd-muted-foreground">{entry.enabled ? zh ? '启用' : 'Enabled' : zh ? '关闭' : 'Off'}</span></div><p className="mt-2 break-all text-xs">{entry.endpoint || entry.host || entry.kind || 'generic'}{entry.port ? `:${entry.port}` : ''}{entry.allowUpdates ? zh ? ' · 允许更新' : ' · Updates allowed' : ''}</p><p className="mt-2 text-xs text-fd-muted-foreground">{entry.description || entry.service || '—'}</p><p className="mt-2 break-words text-xs">{entry.allowedPresets?.length ? entry.allowedPresets.join(', ') : zh ? '未授权任何 Agent' : 'No authorized agents'}</p><div className="mt-4 flex gap-2"><button type="button" className={button} disabled={busy || !writable} onClick={() => { setError(''); setDraft(editCredential(id, entry)); void credentialStatus().then(setStatus).catch(() => {}) }}>{zh ? '编辑' : 'Edit'}</button><button type="button" className={button} disabled={busy || !writable} onClick={() => { void remove(id) }}>{zh ? '删除' : 'Delete'}</button></div></article>)}</div>
    {!busy && !Object.keys(entries).length && !draft && <p className="py-8 text-center text-sm text-fd-muted-foreground">{zh ? '暂无凭证。' : 'No credentials yet.'}</p>}
    {draft && <CredentialDialog key={draft.existing ? draft.id : 'new'} draft={draft} presets={presets} status={status[draft.id]} zh={zh} busy={busy || !writable} error={error} onChange={patch => setDraft(current => current ? { ...current, ...patch } : null)} onSave={() => { void save() }} onClose={() => { setDraft(null); setError('') }} />}
    <button className={`${button} mt-4`} type="button" disabled={busy} onClick={() => { void load() }}>{zh ? '重新加载' : 'Reload'}</button>
  </section>
}
