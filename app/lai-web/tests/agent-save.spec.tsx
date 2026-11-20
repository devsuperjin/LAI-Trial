import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { expect, it, vi } from 'vitest'
import { LaiAgentsPage } from '../src/pages/LaiAgentsPage.tsx'
import { AgentConfigDialog } from '../src/components/AgentConfigDialog.tsx'
vi.mock('../src/api/gateway.ts', () => ({
  describeSettings: async () => ({ writable: true, namespaces: [{ ns: 'lai-agents', revision: 1, value: { prompts: { orchestrator: 'W', triage: 'T', reproduce: 'R', ticket: 'K', review: 'V', report: 'P' }, models: {}, tools: {} } }] }),
  modelCatalog: async () => ({ groups: [] }), mutateSettings: vi.fn(),
}))
vi.mock('@lai/dsh-adapter/agent-tools', () => ({ agentToolCatalog: async () => ({ groups: [] }), defaultToolIds: () => [] }))
it('enables the blue save action after applying role tools to the draft', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(createElement(LaiAgentsPage), { createNodeMock: () => ({ showModal: vi.fn(), close: vi.fn() }) }) })
  const save = () => renderer!.root.findAllByType('button').find(button => button.children.includes('Save configuration'))!
  expect(save().props.disabled).toBe(true)
  act(() => { renderer!.root.findAllByType('button').find(button => button.props['aria-label'] === 'Triage Tools')!.props.onClick() })
  act(() => { renderer!.root.findByType(AgentConfigDialog).props.onApply({ prompt: 'T', route: '', tools: ['dsh:registered-tools#feishu_send_message'] }) })
  expect(save().props.disabled).toBe(false)
  expect(save().props.className).toContain('bg-fd-primary')
  expect(renderer!.root.findAllByProps({ role: 'status' }).some(node => node.children.includes('Unsaved changes'))).toBe(true)
  act(() => { renderer!.unmount() })
})
