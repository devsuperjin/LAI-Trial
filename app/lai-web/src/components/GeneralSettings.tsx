import { useLanguage } from '../i18n.tsx'
import { useAppearance } from '../appearance.tsx'
import type { ThemeMode } from '../appearance.tsx'

export function GeneralSettings() {
  const { t, language, setLanguage } = useLanguage()
  const { mode, setMode } = useAppearance()
  return <div className="space-y-5">
    <section className="rounded-xl border border-fd-border bg-fd-card p-5">
      <h2 className="text-base font-semibold">{t('Appearance')}</h2>
      <p className="mt-1 text-sm text-fd-muted-foreground">{t('Personalize this browser. Changes apply immediately.')}</p>
      <div className="mt-5 space-y-5">
        <div><span id="appearance-theme-label" className="block text-sm font-medium">{t('Theme')}</span><div role="group" aria-labelledby="appearance-theme-label" className="mt-2 flex flex-wrap gap-2">{(['light', 'dark', 'system'] as const).map(value => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value as ThemeMode)} className={`rounded-lg border px-4 py-2 text-sm transition-colors ${mode === value ? 'border-fd-primary bg-fd-primary/10 font-medium text-fd-primary' : 'border-fd-border hover:bg-fd-secondary'}`}>{t(value === 'light' ? 'Light' : value === 'dark' ? 'Dark' : 'System')}</button>)}</div></div>
        <label className="block max-w-xs text-sm font-medium">{t('Language')}<select aria-label={t('Interface language')} value={language} onChange={event => setLanguage(event.target.value === 'zh' ? 'zh' : 'en')} className="mt-2 w-full rounded-md border border-fd-border bg-fd-muted px-3 py-2 text-sm"><option value="en">English</option><option value="zh">简体中文</option></select></label>
      </div>
    </section>
    <section className="rounded-xl border border-fd-border bg-fd-card p-5">
      <h2 className="text-base font-semibold">{t('Version information')}</h2>
      <dl className="mt-4 divide-y divide-fd-border text-sm">{[
        ['LAI Trial', `v${__LAI_BUILD__.version}`], ['LAI Web', `v${__LAI_BUILD__.webVersion}`], ['DeepSeek Harness', __LAI_BUILD__.dshVersion], [t('Built at'), new Date(__LAI_BUILD__.builtAt).toLocaleString()],
      ].map(([label, value]) => <div key={label} className="flex flex-wrap items-center justify-between gap-2 py-3"><dt className="text-fd-muted-foreground">{label}</dt><dd className="font-mono text-xs">{value}</dd></div>)}</dl>
      <a href="https://github.com/devsuperjin/LAI-Trial" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-fd-primary hover:underline">{t('Source code')} ↗</a>
    </section>
  </div>
}
