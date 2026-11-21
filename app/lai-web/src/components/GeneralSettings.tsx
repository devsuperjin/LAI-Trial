import { SettingsRow } from '../layout/SettingsRow.tsx'
import { SelectionGroup, SelectionIndicator } from './SelectionMotion.tsx'
import { Switch } from './Switch.tsx'
import { APPLICATION_NAME, WEB_COMPONENT_NAME } from '../brand.ts'
import { PagePanel } from '../layout/PageLayout.tsx'
import { useLanguage } from '../i18n.tsx'
import { useAppearance } from '../appearance.tsx'
import type { ThemeMode } from '../appearance.tsx'

export function GeneralSettings() {
  const { t, language, setLanguage } = useLanguage()
  const { mode, setMode, reduceMotion, setReduceMotion } = useAppearance()
  return <div className="w-full space-y-5">
    <PagePanel title={t('Appearance')}>
      <p className="mt-1 text-sm text-fd-muted-foreground">{t('Personalize this browser. Changes apply immediately.')}</p>
      <div className="mt-5 divide-y divide-fd-border">
        <SettingsRow label={t('Theme')} description={t('Choose a light or dark appearance, or follow your system.')}>
          <SelectionGroup><div role="group" aria-label={t('Theme')} className="relative flex rounded-lg border border-fd-border bg-fd-muted/50 p-1">{(['light', 'dark', 'system'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value as ThemeMode)} className={`relative isolate rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-fd-primary ${mode === value ? 'font-medium text-fd-primary' : 'text-fd-muted-foreground hover:text-fd-foreground'}`}>
            {mode === value && <SelectionIndicator className="rounded-md bg-fd-card shadow-sm ring-1 ring-fd-border" />}
            <span className="relative">{t(value === 'light' ? 'Light' : value === 'dark' ? 'Dark' : 'System')}</span>
          </button>)}</div></SelectionGroup>
        </SettingsRow>
        <SettingsRow label={t('Language')} description={t('Choose the language used throughout the interface.')}>
          <select aria-label={t('Interface language')} value={language} onChange={event => setLanguage(event.target.value === 'zh' ? 'zh' : 'en')} className="w-48 rounded-lg border border-fd-border bg-fd-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-fd-primary"><option value="en">English</option><option value="zh">简体中文</option></select>
        </SettingsRow>
        <SettingsRow label={t('Reduce motion')} description={t('Minimize interface animations and transitions.')}>
          <Switch checked={reduceMotion} onChange={setReduceMotion} label={t('Reduce motion')} />
        </SettingsRow>
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
