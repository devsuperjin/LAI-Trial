import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { expect, it, vi } from 'vitest'
import { AgentConfigDialog } from '../src/components/AgentConfigDialog.tsx'

const fixture = () => ({ role: 'report', title: 'Reporter', initialTab: 'prompt' as const, value: { prompt: 'Original prompt', route: '', tools: null }, catalog: null, toolsCatalog: null, disabled: false, onApply: vi.fn(), onClose: vi.fn() })
const nodeMock = () => ({ showModal: vi.fn(), close: vi.fn() })
it('keeps modal changes out of the page draft when cancelled', () => {
  const props = fixture()
  let renderer: ReturnType<typeof create>
  act(() => { renderer = create(createElement(AgentConfigDialog, props), { createNodeMock: nodeMock }) })
  act(() => { renderer!.root.findByType('textarea').props.onChange({ target: { value: 'Unsaved edit' } }) })
  act(() => { renderer!.root.findAllByType('button').find(button => button.children.includes('Cancel'))!.props.onClick() })
  expect(props.onApply).not.toHaveBeenCalled()
  expect(props.onClose).toHaveBeenCalledOnce()
  expect(props.value.prompt).toBe('Original prompt')
  act(() => { renderer!.unmount() })
})
it('applies modal edits to the page draft only after confirmation', () => {
  const props = fixture()
  let renderer: ReturnType<typeof create>
  act(() => { renderer = create(createElement(AgentConfigDialog, props), { createNodeMock: nodeMock }) })
  act(() => { renderer!.root.findByType('textarea').props.onChange({ target: { value: 'Updated prompt' } }) })
  act(() => { renderer!.root.findAllByType('button').find(button => button.children.includes('Apply changes'))!.props.onClick() })
  expect(props.onApply).toHaveBeenCalledWith({ prompt: 'Updated prompt', route: '', tools: null })
  expect(props.onClose).toHaveBeenCalledOnce()
  expect(props.value.prompt).toBe('Original prompt')
  act(() => { renderer!.unmount() })
})
