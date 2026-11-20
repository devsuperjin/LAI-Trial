import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { useEffect, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type { PluginConfigViewProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { describeSettings, mutateSettings, type SettingsNamespaceView } from '@lai/dsh-adapter/gateway'

const field = { display: 'block', width: '100%', boxSizing: 'border-box' as const, marginTop: 6, padding: '10px 12px', border: '1px solid #8885', borderRadius: 8, color: 'inherit', background: 'transparent', font: 'inherit' }
const button = { padding: '8px 16px', border: '1px solid #8885', borderRadius: 8, color: 'inherit', background: 'transparent', font: 'inherit', cursor: 'pointer' }
const words = { en: { title: 'Feishu tools', hint: 'Configure App ID and App Secret, or a tenant access token. Select tools separately in LAI Agents. Blank secrets preserve existing values. Saving does not send a message.', save: 'Save configuration', reload: 'Reload', saved: 'Configuration saved.', loading: 'Loading…', unavailable: 'Feishu tool settings unavailable.', timeout: 'Timeout must be between 1 and 90000 ms.' }, zh: { title: '飞书工具', hint: '填写 App ID 和 App Secret，或 Tenant Access Token。工具需在 LAI Agents 中另行勾选。密钥留空保留已有值，保存不会发送消息。', save: '保存配置', reload: '重新加载', saved: '配置已保存。', loading: '加载中…', unavailable: '飞书工具配置不可用。', timeout: '超时必须是 1 到 90000 毫秒之间的整数。' } }
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { laiFeishuTools: keyof typeof words.en } }
type T = (key: keyof typeof words.en) => string
function Page({ t }: { t: T }) {
  const [ns, setNs] = useState<SettingsNamespaceView | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [writable, setWritable] = useState(false)
  const [busy, setBusy] = useState(true)
  const [notice, setNotice] = useState('')
  async function load() {
    setBusy(true); setNotice('')
    try {
      const settings = await describeSettings()
      const found = settings.namespaces.find(item => item.ns === 'lai-feishu-tools')
      if (!found) throw new Error(t('unavailable'))
      const values = (found.value.credentials ?? {}) as Record<string, unknown>
      setNs(found); setWritable(settings.writable)
      setDraft({ appId: String(values.appId ?? ''), baseUrl: String(values.baseUrl ?? ''), timeoutMs: String(values.timeoutMs ?? 15000) })
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [])
  async function save() {
    if (!ns) return
    setBusy(true); setNotice('')
    try {
      const ops: Parameters<typeof mutateSettings>[1] = []
      for (const key of ['appId', 'baseUrl', 'timeoutMs']) {
        const value = draft[key]?.trim() ?? ''
        if (key === 'timeoutMs' && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 90000)) throw new Error(t('timeout'))
        ops.push(value ? { op: 'set', path: ['credentials', key], value: key === 'timeoutMs' ? Number(value) : value } : { op: 'unset', path: ['credentials', key] })
      }
      for (const key of ['appSecret', 'token']) if (draft[key]?.trim()) ops.push({ op: 'set', path: ['credentials', key], value: draft[key]!.trim() })
      setNs(await mutateSettings(ns.ns, ops, ns.revision))
      setDraft(current => ({ ...current, appSecret: '', token: '' })); setNotice(t('saved'))
    } catch (e) { setNotice(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(false) }
  }
  return <section style={{ padding: 24, width: '100%', boxSizing: 'border-box', maxHeight: '100%', overflowY: 'auto', scrollbarWidth: 'thin' }}>
    <h2 style={{ marginTop: 0 }}>{t('title')}</h2><p style={{ opacity: .7, lineHeight: 1.6 }}>{t('hint')}</p>
    <fieldset disabled={busy || !ns || !writable} style={{ border: '1px solid #8884', borderRadius: 12, padding: 20, maxWidth: 720, margin: '20px 0' }}>
      {Object.entries({ appId: 'App ID', appSecret: 'App Secret', token: 'Tenant Access Token', baseUrl: 'API base URL (optional)', timeoutMs: 'Timeout (ms)' }).map(([key, label]) => <label key={key} style={{ display: 'block', marginBottom: 18, fontSize: 13 }}>{label}<input style={field} autoComplete="off" type={key === 'appSecret' || key === 'token' ? 'password' : key === 'timeoutMs' ? 'number' : 'text'} placeholder={key === 'baseUrl' ? 'https://open.feishu.cn/open-apis' : undefined} value={draft[key] ?? ''} onChange={event => setDraft(current => ({ ...current, [key]: event.target.value }))} /></label>)}
    </fieldset>
    <div style={{ display: 'flex', gap: 12 }}><button type="button" style={button} disabled={busy || !ns || !writable} onClick={() => { void save() }}>{busy ? t('loading') : t('save')}</button><button type="button" style={button} disabled={busy} onClick={() => { void load() }}>{t('reload')}</button></div>{notice && <p role="status">{notice}</p>}
  </section>
}
export const inject = ['slots', 'locale']
export function apply(ctx: Context) {
  ctx.effect(() => ctx.locale.register('laiFeishuTools', words))
  const t = ctx.locale.bind('laiFeishuTools') as T
  for (const [name, key] of [['plugins.bundle.config', '@lai/feishu-tools'], ['plugins.row.config', '@lai/feishu-tools#lai-feishu-tools']] as const) {
    ctx.slots.inject(name, () => ctx.slots.register({ name, key, locale: 'laiFeishuTools' }, (props: PluginConfigViewProps) => props.view === 'page' ? <Page t={t} /> : null))
  }
}
