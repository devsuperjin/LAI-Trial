import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { AgentToolCatalog, retainSelection, TOOL_ROLES } from '../src/tools.ts'

const directories: string[] = []
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }) })
const directory = async () => { const path = await mkdtemp(join(tmpdir(), 'lai-tool-selection-')); directories.push(path); return path }
const tool = (name: string): ToolDefinition => ({ name, description: name, parameters: { type: 'object' }, output: { schema: { type: 'object' }, render: () => [] }, execute: vi.fn(async () => ({})) })
async function fixture() {
  const read = tool('read'), write = tool('write')
  const released = vi.fn()
  const ctx = { agentPresets: { acquireScope: vi.fn(async (key: string) => ({ key: { preset: key }, [Symbol.asyncDispose]: async () => { released() } })) }, tools: { definitions: (scope: { preset?: string; session?: { header: { agentPreset: string } } }) => !scope ? [] : (scope.preset ?? scope.session?.header.agentPreset) === TOOL_ROLES.reproduce ? [read, write] : [read], get: () => undefined, executable: () => undefined } } as unknown as Context
  const catalog = new AgentToolCatalog(ctx, await directory())
  const agent = (id: string, preset = TOOL_ROLES.triage) => {
    const mounted = new Map<string, ToolDefinition>()
    const masks: { deny: string[] }[] = []
    const guards: ((execution: { name: string }) => string | undefined)[] = []
    const value = { id, session: { header: { agentPreset: preset }, snapshotEvents: () => [], isOwnSeq: () => true }, ctx: { tools: {
      register: (definition: ToolDefinition) => { mounted.set(definition.name, definition); return () => { mounted.delete(definition.name) } },
      restrict: (mask: { deny: string[] }) => { masks.push(mask); return () => { masks.splice(masks.indexOf(mask), 1) } },
      guard: (guard: (execution: { name: string }) => string | undefined) => { guards.push(guard); return () => { guards.splice(guards.indexOf(guard), 1) } },
    } } } as unknown as Agent
    return { value, mounted, masks, guards }
  }
  return { ctx, catalog, agent, read, write, released }
}

it('retains a Run selection across configuration changes and concurrent creation', async () => {
  const path = await directory()
  const [one, two] = await Promise.all([retainSelection(path, 'same-run', 'triage', ['first']), retainSelection(path, 'same-run', 'triage', ['second'])])
  expect(one).toEqual(two)
  expect(await retainSelection(path, 'same-run', 'triage', [])).toEqual(one)
  await expect(retainSelection(path, 'same-run', 'review', [])).rejects.toThrow('Invalid saved')
})

it('lists real preset tools by plugin and does not expose execution callbacks', async () => {
  const { catalog, released } = await fixture()
  catalog.registerTools({ id: '@lai/feishu-tools', title: 'Feishu', tools: [tool('feishu_send_message')] })
  const view = await catalog.catalog()
  expect(view.groups.find(group => group.id === '@deepseek-ai/dsh-tool-fs')?.tools.find(tool => tool.name === 'write')?.defaultRoles).toEqual(['reproduce'])
  expect(view.groups.find(group => group.id === '@lai/feishu-tools')?.tools[0]).toEqual({ id: '@lai/feishu-tools#feishu_send_message', name: 'feishu_send_message', description: 'feishu_send_message', defaultRoles: [] })
  expect(JSON.stringify(view)).not.toContain('execute')
  expect(released).toHaveBeenCalledTimes(5)
})

it('mounts only selected custom tools, masks unselected inherited tools and preserves live selections', async () => {
  const { catalog, agent } = await fixture()
  const send = tool('feishu_send_message'), receive = tool('feishu_read_message')
  catalog.registerTools({ id: '@lai/feishu-tools', title: 'Feishu', tools: [send, receive] })
  const first = agent('one')
  await catalog.mount(first.value, { triage: ['@lai/feishu-tools#feishu_read_message'] })
  expect([...first.mounted.keys()]).toEqual(['feishu_read_message'])
  expect(first.masks).toEqual([{ deny: ['read'] }])
  expect(catalog.allowedToolNames(first.value)).toEqual(['feishu_read_message'])
  expect(catalog.toolDenial(first.value, 'feishu_send_message')).toContain('not selected')
  await catalog.mount(first.value, { triage: ['@lai/feishu-tools#feishu_send_message'] })
  expect([...first.mounted.keys()]).toEqual(['feishu_read_message'])
  const second = agent('two')
  await catalog.mount(second.value, { triage: ['@lai/feishu-tools#feishu_send_message'] })
  expect([...second.mounted.keys()]).toEqual(['feishu_send_message'])
  await catalog.dispose()
  expect(first.mounted.size + second.mounted.size).toBe(0)
  expect(first.guards).toHaveLength(0)
})

it('restores the saved tool selection and refuses calls after the supplying plugin unloads', async () => {
  const { catalog, agent } = await fixture()
  const send = tool('feishu_send_message')
  const off = catalog.registerTools({ id: '@lai/feishu-tools', title: 'Feishu', tools: [send] })
  const first = agent('restored')
  await catalog.mount(first.value, { triage: ['@lai/feishu-tools#feishu_send_message'] })
  await catalog.release(first.value)
  const restored = agent('restored')
  await catalog.mount(restored.value, { triage: [] })
  expect(restored.mounted.has('feishu_send_message')).toBe(true)
  off()
  expect(() => restored.mounted.get('feishu_send_message')!.execute({}, {} as never)).toThrow('unloaded')
  expect(send.execute).not.toHaveBeenCalled()
  await catalog.dispose()
})

it('rejects duplicate and host-owned tool identities', async () => {
  const { catalog } = await fixture()
  expect(() => catalog.registerTools({ id: '@lai/custom', title: 'Custom', tools: [tool('orchestrator_report')] })).toThrow('Reserved')
  catalog.registerTools({ id: '@lai/first', title: 'First', tools: [tool('custom_send')] })
  expect(() => catalog.registerTools({ id: '@lai/second', title: 'Second', tools: [tool('custom_send')] })).toThrow('Duplicate')
})

it('does not turn forged selection ids into Superagent whitelist entries', async () => {
  const { catalog, agent } = await fixture()
  const run = agent('forged')
  await catalog.mount(run.value, { triage: ['@lai/missing#plugin_manager', '@deepseek-ai/dsh-tool-fs#schedule_create'] })
  expect(catalog.allowedToolNames(run.value)).toEqual([])
  expect([...run.mounted.keys()]).toEqual([])
  await catalog.dispose()
})

it('does not install tools after disposal races asynchronous selection persistence', async () => {
  const { catalog, agent } = await fixture()
  const run = agent('disposed')
  const mounting = catalog.mount(run.value, {})
  await catalog.release(run.value)
  await mounting
  expect(run.mounted.size).toBe(0)
  expect(run.guards).toHaveLength(0)
})

it('discovers standard DSH registrations and mounts only explicit selections', async () => {
  const { ctx, catalog, agent } = await fixture()
  const external = tool('feishu_send_message')
  const conditional = tool('conditional_tool')
  const original = ctx.tools.definitions.bind(ctx.tools)
  let loaded = true
  ctx.tools.definitions = ((scope?: Parameters<typeof original>[0]) => scope ? original(scope) : loaded ? [external, conditional] : []) as typeof ctx.tools.definitions
  ctx.tools.executable = ((name: string) => loaded && name === external.name ? external : undefined) as typeof ctx.tools.executable
  const group = (await catalog.catalog()).groups.find(group => group.id === 'dsh:registered-tools')!
  expect(group.tools.map(tool => tool.name)).toEqual(['feishu_send_message'])
  expect(group.tools[0]?.defaultRoles).toEqual([])
  const selected = agent('scan-selected')
  await catalog.mount(selected.value, { triage: ['dsh:registered-tools#feishu_send_message'] })
  expect(catalog.allowedToolNames(selected.value)).toContain('feishu_send_message')
  const unselected = agent('scan-unselected')
  await catalog.mount(unselected.value, {})
  expect(catalog.toolDenial(unselected.value, external.name)).toContain('not selected')
  loaded = false
  expect((await catalog.catalog()).groups.some(group => group.id === 'dsh:registered-tools')).toBe(false)
  expect(() => selected.mounted.get(external.name)!.execute({}, {} as never)).toThrow('unloaded')
  await catalog.dispose()
})
