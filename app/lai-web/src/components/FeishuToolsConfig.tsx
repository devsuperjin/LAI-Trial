import { useEffect, useState } from 'react'
import { describeSettings, mutateSettings, type SettingsNamespaceView } from '../api/gateway.ts'
import { HelpTip } from './HelpTip.tsx'
import { useLanguage } from '../i18n.tsx'

export function FeishuToolsConfig() {
  const { language } = useLanguage()
  const zh = language === 'zh'
  const [ns, setNs] = useState<SettingsNamespaceView | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [writable, setWritable] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => { void open() }, [])
  async function open() {
    setError(''); setNotice(''); setDraft({}); setNs(null); setBusy(true)
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
      setNs(await mutateSettings(ns.ns, ops, ns.revision))
      setDraft(current => ({ ...current, appSecret: '', token: '' }))
      setNotice(zh ? '配置已保存。' : 'Configuration saved.')
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  return <section className="mx-auto w-full max-w-3xl">
    <header className="flex items-center gap-2"><h1 className="text-lg font-semibold">{zh ? '飞书工具' : 'Feishu tools'}</h1><HelpTip text={zh ? '配置独立飞书工具插件的凭证。工具权限在 LAI Agents 中按角色选择；Superagent 的飞书事件来源单独配置。' : 'Configure credentials for the standalone Feishu tool plugin. Select tools per role in LAI Agents; Superagent incoming Feishu sources are configured separately.'} /></header>
    <div className="mt-5 rounded-xl border border-fd-border bg-fd-card p-5">
      <h2 className="text-sm font-medium">{zh ? '凭证与连接' : 'Credentials & connection'}</h2>
      <p className="mt-2 text-xs text-fd-muted-foreground">{zh ? '填写 App ID 和 App Secret，或提供 Tenant Access Token。密钥留空保留已有值。' : 'Provide App ID and App Secret, or a tenant access token. Blank secrets preserve existing values.'}</p>
      <div className="mt-4 space-y-3">{['appId', 'appSecret', 'token', 'baseUrl', 'timeoutMs'].map(key => <label key={key} className="block text-xs"><span>{({appId:'App ID',appSecret:'App Secret',token:'Tenant Access Token',baseUrl:'API base URL (optional)',timeoutMs:'Timeout (ms)'} as Record<string,string>)[key]}</span><input autoComplete="off" type={key === 'appSecret' || key === 'token' ? 'password' : key === 'timeoutMs' ? 'number' : 'text'} value={draft[key] ?? ''} disabled={busy || !ns || !writable} placeholder={key === 'baseUrl' ? 'https://open.feishu.cn/open-apis' : undefined} onChange={e => setDraft(current => ({...current,[key]:e.target.value}))} className="mt-1 w-full rounded-md border border-fd-border bg-fd-background px-3 py-2" /></label>)}</div>
      {error && <p role="alert" className="mt-3 text-xs text-fd-danger">{error}</p>}
      {notice && <p role="status" className="mt-3 text-xs text-fd-success">{notice}</p>}
      <div className="mt-5 flex gap-2"><button type="button" disabled={busy} onClick={() => { void open() }} className="rounded-md border border-fd-border px-3 py-2 text-xs">{zh ? '重新加载' : 'Reload'}</button><button type="button" disabled={busy || !ns || !writable} onClick={() => { void save() }} className="rounded-md bg-fd-primary px-3 py-2 text-xs text-white disabled:opacity-40">{zh ? '保存' : 'Save'}</button></div>
    </div>
  </section>
}
