import { Context } from '@deepseek-ai/cordis'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { expect, it } from 'vitest'
import { apply, DEFAULT_PROMPTS, PRESETS } from '../src/index.ts'

it('owns six presets, reads changed role prompts, and removes its contributions', async () => {
  const ctx = new Context()
  const registered: string[] = []
  const removed: string[] = []
  ctx.provide('agentPresets' as never, {
    register: (preset: { id: string }) => {
      registered.push(preset.id)
      return Promise.resolve(() => { removed.push(preset.id); return Promise.resolve() })
    },
  } as never)
  let prompts = { ...DEFAULT_PROMPTS, orchestrator: 'Orchestrator custom prompt.' }
  try {
    await ctx.plugin(SystemPrompt, { personaPrefix: '{{lai_agent_orchestrator}}' })
    const fiber = await ctx.plugin({ name: 'prompt-fixture', inject: ['systemPrompt', 'agentPresets'], apply: (child: Context) => apply(child, { prompts: { get: () => prompts } as never }) })
    expect(registered).toEqual(PRESETS.map(preset => preset.id))
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toContain('Orchestrator custom prompt.')
    prompts = { ...prompts, orchestrator: 'Updated prompt.' }
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toContain('Updated prompt.')
    await fiber.dispose()
    expect(removed.sort()).toEqual(registered.sort())
  } finally { await ctx.fiber.dispose() }
})

it('merges monitoring into the orchestrator and exposes exactly five delegation tools', () => {
  expect(PRESETS).toHaveLength(6)
  expect(PRESETS.some(preset => preset.id === 'iqe-monitor')).toBe(false)
  expect(DEFAULT_PROMPTS).not.toHaveProperty('monitor')
  const parent = PRESETS.find(preset => preset.id === 'iqe-orchestrator')!
  const tools = parent.plugins!.filter(plugin => plugin.name === '@deepseek-ai/dsh-tool-subagent')
  expect(tools.map(plugin => (plugin.config as { toolName: string }).toolName)).toEqual(['triage', 'reproduce', 'ticket', 'review', 'report'])
  expect(parent.plugins!.some(plugin => plugin.name === '@deepseek-ai/dsh-tool-bash')).toBe(true)
})
