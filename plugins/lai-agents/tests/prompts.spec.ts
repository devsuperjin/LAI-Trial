import { Context } from '@deepseek-ai/cordis'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { expect, it } from 'vitest'
import { apply, DEFAULT_PROMPTS, PRESETS } from '../src/index.ts'

it('owns seven presets, reads changed role prompts, and removes its contributions', async () => {
  const ctx = new Context()
  const registered: string[] = []
  const removed: string[] = []
  ctx.provide('agentPresets' as never, {
    register: (preset: { id: string }) => {
      registered.push(preset.id)
      return Promise.resolve(() => { removed.push(preset.id); return Promise.resolve() })
    },
  } as never)
  let prompts = { ...DEFAULT_PROMPTS, monitor: 'Monitor custom prompt.' }
  try {
    await ctx.plugin(SystemPrompt, { personaPrefix: '{{lai_agent_monitor}}' })
    const fiber = await ctx.plugin({ name: 'prompt-fixture', inject: ['systemPrompt', 'agentPresets'], apply: (child: Context) => apply(child, { prompts: { get: () => prompts } as never }) })
    expect(registered).toEqual(PRESETS.map(preset => preset.id))
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toContain('Monitor custom prompt.')
    prompts = { ...prompts, monitor: 'Updated prompt.' }
    expect(renderPrompt(await ctx.systemPrompt.assemble())).toContain('Updated prompt.')
    await fiber.dispose()
    expect(removed.sort()).toEqual(registered.sort())
  } finally { await ctx.fiber.dispose() }
})
