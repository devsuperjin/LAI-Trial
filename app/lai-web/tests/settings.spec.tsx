import { afterEach, expect, it, vi } from 'vitest'
import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { SettingsPage } from '../src/components/SettingsPage.tsx'

let view: ReactTestRenderer | undefined
afterEach(() => { if (view) act(() => view?.unmount()); view = undefined; vi.unstubAllGlobals() })

it('stores an API key through DSH and lets the first available model be selected', async () => {
  let configured = false
  let defaultValue = { provider: 'deepseek-official', model: 'unavailable-old-model' }
  const defaultNs = () => ({ ns: 'agent-default-model', value: defaultValue, revision: 0, applies: 'live', autoGenerate: false })
  const providerNs = { ns: 'llm-deepseek', value: { apiKeyEnv: 'DEEPSEEK_API_KEY' }, revision: 0, applies: 'live', autoGenerate: false }
  const calls: { endpoint: string; args: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const request = JSON.parse(String(init.body))
    const endpoint = url.replace('/api/', '')
    const args = request.payload.args
    calls.push({ endpoint, args })
    let value: unknown
    switch (endpoint) {
      case 'session/modelCatalog': value = { default: defaultValue, routableProviders: configured ? ['deepseek-official'] : [], groups: configured ? [{ id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'first-model', name: 'First model' }] }] : [], failures: [] }; break
      case 'agentPresets/list': value = { presets: [] }; break
      case 'settings/describe': value = { writable: true, hasDocument: true, namespaces: [defaultNs(), providerNs] }; break
      case 'llm/listConfigurableProviders': value = [{ provider: 'deepseek-official', displayName: 'DeepSeek', settingsNs: 'llm-deepseek', settingsPath: [] }]; break
      case 'credentials/describe': value = { DEEPSEEK_API_KEY: { configured, writable: true } }; break
      case 'credentials/set': configured = true; value = undefined; break
      case 'settings/update': defaultValue = args.patch; value = defaultNs(); break
      default: throw new Error(`Unexpected endpoint: ${endpoint}`)
    }
    return Response.json({ type: 'server-response', rpcId: request.rpcId, result: { ok: true, value } })
  }))
  await act(async () => { view = create(<SettingsPage entries={[]} />) })
  const button = (label: string) => view!.root.findAllByType('button').find(node => node.children.join('') === label)!
  await act(async () => { button('Configure DeepSeek').props.onClick() })
  act(() => view!.root.findByProps({ type: 'password' }).props.onChange({ target: { value: 'test-only-not-a-real-key' } }))
  await act(async () => { await view!.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  expect(calls).toContainEqual({ endpoint: 'credentials/set', args: { ref: 'DEEPSEEK_API_KEY', value: 'test-only-not-a-real-key' } })
  expect(calls.filter(call => call.endpoint === 'settings/mutate').some(call => JSON.stringify(call.args).includes('test-only-not-a-real-key'))).toBe(false)
  const select = view!.root.findByProps({ 'aria-label': 'Default model' })
  expect(select.props.value).toBe('')
  expect(select.findAllByType('option').map(option => option.props.value)).toEqual(['', 'deepseek-official/first-model'])
  act(() => select.props.onChange({ target: { value: 'deepseek-official/first-model' } }))
  await act(async () => { button('Save default').props.onClick() })
  expect(calls).toContainEqual({ endpoint: 'settings/update', args: { ns: 'agent-default-model', patch: { provider: 'deepseek-official', model: 'first-model' }, expectedRevision: 0 } })
})
