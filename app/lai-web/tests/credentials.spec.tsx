import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { expect, it, vi } from 'vitest'
import { CredentialsPage } from '../src/pages/CredentialsPage.tsx'
vi.mock('@lai/dsh-adapter/credentials', () => ({ credentialStatus: async () => ({}), revealCredential: vi.fn() }))
const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }))
vi.mock('../src/api/gateway.ts', () => ({
  describeSettings: async () => ({ writable: true, namespaces: [{ ns: 'lai-credentials', revision: 7, value: { entries: { ci: { description: 'CI', service: 'https://ci.example', enabled: true, allowedPresets: ['iqe-triage'] } } } }] }),
  listAgentPresets: async () => ({ presets: [{ id: 'iqe-triage', name: 'Triage' }] }),
  mutateSettings: mutate,
}))
it('keeps stored secrets intact when saving metadata from a redacted settings response', async () => {
  mutate.mockResolvedValue({ ns: 'lai-credentials', revision: 8, value: { entries: {} } })
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(createElement(CredentialsPage), { createNodeMock: () => ({ showModal() {}, close() {} }) }) })
  const button = (label: string) => renderer!.root.findAllByType('button').find(node => node.children.includes(label))!
  act(() => { button('Edit').props.onClick() })
  const inputs = renderer!.root.findAllByType('input')
  for (const input of inputs.filter(input => input.props.type === 'password')) expect(input.props.value).toBe('')
  act(() => { renderer!.root.findByType('textarea').props.onChange({ target: { value: 'Updated purpose' } }) })
  await act(async () => { renderer!.root.findByType('form').props.onSubmit({ preventDefault() {} }) })
  expect(mutate).toHaveBeenCalledWith('lai-credentials', expect.any(Array), 7)
  const ops = mutate.mock.calls[0]![1]
  expect(ops).toContainEqual({ op: 'set', path: ['entries', 'ci', 'description'], value: 'Updated purpose' })
  expect(ops.some((op: { path: string[] }) => ['username', 'token', 'password'].includes(op.path.at(-1)!))).toBe(false)
  act(() => { renderer!.unmount() })
})
