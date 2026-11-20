import { useEffect, useRef, useState } from 'react'
import { describeSettings, mutateSettings, type SettingsNamespaceView } from '../api/gateway.ts'
import { useLanguage } from '../i18n.tsx'

export function FeishuToolsConfig() {
  const { language } = useLanguage()
  const zh = language === 'zh'
  const dialog = useRef<HTMLDialogElement>(null)
  const [ns, setNs] = useState<SettingsNamespaceView | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [writable, setWritable] = useState(false)
  useEffect(() => { const el = dialog.current; return () => el?.close() }, [])
  async function open() {
    setError(''); setDraft({}); setNs(null); setBusy(true)
    dialog.current?.showModal()
    try {
      const settings = await describeSettings()
      const found = settings.namespaces.find(item => item.ns === 'lai-feishu-tools')
      if (!found) throw new Error(zh ? '飞书工具配置不可用，请确认插件已加载。' : 'Feishu tool settings are unavailable. Check that the plugin is loaded.')
      setNs(found); setWritable(settings.writable)
      const credentials = (found.value.credentials ?? {}) as Record<string, unknown>
      setDraft({ appId: String(credentials.appId ?? ''), baseUrl: String(credentials.baseUrl ?? ''), timeoutMs: String(credentials.timeoutMs ?? 15000) })
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  async function save() {
    if (!ns) return
    setBusy(true); setError('')
    try {
      const ops: Parameters<typeof mutateSettings>[1] = []
      for (const key of ['appId', 'baseUrl', 'timeoutMs']) {
        const value = draft[key]?.trim() ?? ''
        if (key === 'timeoutMs' && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 90000)) throw new Error('Timeout must be between 1 and 90000 ms.')
        ops.push(value ? { op: 'set', path: ['credentials', key], value: key === 'timeoutMs' ? Number(value) : value } : { op: 'unset', path: ['credentials', key] })
      }
      for (const key of ['appSecret', 'token']) if (draft[key]?.trim()) ops.push({ op: 'set', path: ['credentials', key], value: draft[key]!.trim() })
      await mutateSettings(ns.ns, ops, ns.revision)
      dialog.current?.close(); setDraft({})
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  return <>
    <button type="button" onClick={() => { void open() }} className="mt-3 rounded-lg border border-fd-border px-3 py-2 text-xs hover:bg-fd-secondary">{zh ? '飞书工具配置' : 'Configure Feishu tools'}</button>
    <dialog ref={dialog} onClose={() => setDraft({})} className="m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto rounded-xl border border-fd-border bg-fd-card p-6 text-fd-foreground backdrop:bg-black/40">
      <h2 className="text-base font-semibold">{zh ? '飞书工具配置' : 'Feishu tool configuration'}</h2>
      <p className="mt-2 text-xs text-fd-muted-foreground">{zh ? '填写 App ID 和 App Secret，或提供 Tenant Access Token。密钥留空保留已有值。保存不会发送消息；角色工具需要另行勾选。' : 'Provide App ID and App Secret, or a tenant access token. Blank secrets preserve existing values. Saving sends no messages; select tools separately for each role.'}</p>
      <div className="mt-4 space-y-3">{['appId', 'appSecret', 'token', 'baseUrl', 'timeoutMs'].map(key => <label key={key} className="block text-xs"><span>{({appId:'App ID',appSecret:'App Secret',token:'Tenant Access Token',baseUrl:'API base URL (optional)',timeoutMs:'Timeout (ms)'} as Record<string,string>)[key]}</span><input autoComplete="off" type={key === 'appSecret' || key === 'token' ? 'password' : key === 'timeoutMs' ? 'number' : 'text'} value={draft[key] ?? ''} disabled={busy || !ns || !writable} placeholder={key === 'baseUrl' ? 'https://open.feishu.cn/open-apis' : undefined} onChange={e => setDraft(current => ({...current,[key]:e.target.value}))} className="mt-1 w-full rounded-md border border-fd-border bg-fd-background px-3 py-2" /></label>)}</div>
      {error && <p role="alert" className="mt-3 text-xs text-fd-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="rounded-md border border-fd-border px-3 py-2 text-xs">{zh ? '取消' : 'Cancel'}</button><button type="button" disabled={busy || !ns || !writable} onClick={() => { void save() }} className="rounded-md bg-fd-primary px-3 py-2 text-xs text-white disabled:opacity-40">{zh ? '保存' : 'Save'}</button></div>
    </dialog>
  </>
}
