import { act, create } from 'react-test-renderer'
import { afterEach, expect, it, vi } from 'vitest'
import { LanguageProvider, LanguageSwitch, useLanguage } from '../src/i18n.tsx'

afterEach(() => vi.unstubAllGlobals())
it('defaults to English, switches live, and restores the saved choice', () => {
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) })
  vi.stubGlobal('document', { documentElement: { lang: '' } })
  function Label() { const { t } = useLanguage(); return <span>{t('Settings')}</span> }
  let root!: ReturnType<typeof create>
  const view = <LanguageProvider><Label /><LanguageSwitch /></LanguageProvider>
  act(() => { root = create(view) })
  expect(root.root.findByType('span').children).toEqual(['Settings'])
  act(() => { root.root.findAllByType('button')[1]!.props.onClick() })
  expect(root.root.findByType('span').children).toEqual(['设置'])
  expect(document.documentElement.lang).toBe('zh-CN')
  act(() => root.unmount())
  act(() => { root = create(view) })
  expect(root.root.findByType('span').children).toEqual(['设置'])
  act(() => { root.root.findAllByType('button')[0]!.props.onClick() })
  expect(root.root.findByType('span').children).toEqual(['Settings'])
  act(() => root.unmount())
})
