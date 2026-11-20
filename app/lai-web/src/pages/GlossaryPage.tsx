import english from '../../../../docs/glossary.md?raw'
import chinese from '../../../../docs/glossary.zh-CN.md?raw'
import { useLanguage } from '../i18n.tsx'
import { PagePanel } from '../layout/PageLayout.tsx'
import { MarkdownContent } from '../components/MarkdownContent.tsx'

/** Render the same terminology used by repository documentation, without duplicate titles/locale links. */
export function GlossaryPage() {
  const { language, t } = useLanguage()
  const document = language === 'zh' ? chinese : english
  const body = document.split(/\r?\n/).slice(4).join('\n')
  return <PagePanel title={t('Glossary')}><MarkdownContent>{body}</MarkdownContent></PagePanel>
}
