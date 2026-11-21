import { Switch } from './Switch.tsx'
import { APPLICATION_NAME, WEB_COMPONENT_NAME } from '../brand.ts'
import { PagePanel } from '../layout/PageLayout.tsx'
import { useLanguage } from '../i18n.tsx'
import { useAppearance } from '../appearance.tsx'
import type { ThemeMode } from '../appearance.tsx'

export function GeneralSettings() {
  const { t, language, setLanguage } = useLanguage()
  const { mode, setMode, reduceMotion, setReduceMotion } = useAppearance()
  return <div className="space-y-5">
    <PagePanel title={t('Appearance')}>
      <p className="mt-1 text-sm text-fd-muted-foreground">{t('Personalize this browser. Changes apply immediately.')}</p>
      <div className="mt-5 space-y-5">
        <div><span id="appearance-theme-label" className="block text-sm font-medium">{t('Theme')}</span><div role="group" aria-labelledby="appearance-theme-label" className="mt-2 flex flex-wrap gap-2">{(['light', 'dark', 'system'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value as ThemeMode)} className={`rounded-lg border px-4 py-2 text-sm transition-colors ${mode === value ? 'border-fd-primary bg-fd-primary/10 font-medium text-fd-primary' : 'border-fd-border hover:bg-fd-secondary'}`}>{t(value === 'light' ? 'Light' : value === 'dark' ? 'Dark' : 'System')}</button>)}</div></div>
        <label className="block max-w-xs text-sm font-medium">{t('Language')}<select aria-label={t('Interface language')} value={language} onChange={event => setLanguage(event.target.value === 'zh' ? 'zh' : 'en')} className="mt-2 w-full rounded-md border border-fd-border bg-fd-muted px-3 py-2 text-sm"><option value="en">English</option><option value="zh">简体中文</option></select></label>
        <div className="flex max-w-xs items-center justify-between gap-4"><span className="text-sm font-medium">{t('Reduce motion')}</span><Switch checked={reduceMotion} onChange={setReduceMotion} label={t('Reduce motion')} /></div>
      </div>
    </PagePanel>
    <PagePanel title={t('Version information')}>
      <dl className="divide-y divide-fd-border text-sm">{[
        [APPLICATION_NAME, `v${__LAI_BUILD__.version}`], [WEB_COMPONENT_NAME, `v${__LAI_BUILD__.webVersion}`], ['DeepSeek Harness', __LAI_BUILD__.dshVersion], [t('Built at'), new Date(__LAI_BUILD__.builtAt).toLocaleString()],
      ].map(([label, value]) => <div key={label} className="flex flex-wrap items-center justify-between gap-2 py-3"><dt className="text-fd-muted-foreground">{label}</dt><dd className="font-mono text-xs">{value}</dd></div>)}</dl>
      <div className="mt-5 border-t border-fd-border pt-4">
        <h3 className="text-sm font-medium">{t('Bundled plugins')}</h3>
        <p className="mt-1 text-xs text-fd-muted-foreground">{t('Plugin versions included in this build.')}</p>
        <dl className="mt-2 divide-y divide-fd-border">{(__LAI_BUILD__.plugins ?? []).map(plugin => <div key={plugin.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><dt className="min-w-0"><span className="text-sm">{t(({ '@lai/credentials': 'Credentials', '@lai/feishu-tools': 'Feishu tools', '@lai/lai-agents': 'LAI Agents', '@lai/superagent': 'Superagent', '@lai/dsh-web-host': 'Web host' } as Record<string, string>)[plugin.name] ?? plugin.name)}</span><span className="mt-0.5 block break-all font-mono text-[11px] text-fd-muted-foreground">{plugin.name}</span></dt><dd className="shrink-0 font-mono text-xs">v{plugin.version}</dd></div>)}</dl>
      </div>
      <a href="https://github.com/IQE-SUZHOU/LAI-Superagent" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-fd-primary hover:underline">{t('Source code')} ↗</a>
    </PagePanel>
  </div>
}
