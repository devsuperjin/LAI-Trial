import { Context } from '@deepseek-ai/cordis'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { describe, expect, it } from 'vitest'
import * as PromptSections from '../src/index.ts'

describe('prompt-sections', () => {
  it('contributes configured sections and contexts to assembly', async () => {
    const ctx = new Context()
    try {
      await ctx.plugin(SystemPrompt, {})
      await ctx.plugin(PromptSections, {
        sections: [
          { name: 'later', order: 20, text: 'SECOND' },
          { name: 'earlier', order: 10, text: 'FIRST {{place}}' },
        ],
        contexts: [{ name: 'task-fact', order: 0, text: 'CONTEXT FACT' }],
      })
      ctx.systemPrompt.variable('place', () => 'HERE')
      const assembly = await ctx.systemPrompt.assemble()
      const texts = assembly.sections.map(section => section.text)
      expect(texts.indexOf('FIRST {{place}}')).toBeLessThan(texts.indexOf('SECOND'))
      expect(renderPrompt(assembly)).toContain('FIRST HERE')
      expect(assembly.contexts.map(context => context.text)).toContain('CONTEXT FACT')
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('replaces the whole prompt with a complete section', async () => {
    const ctx = new Context()
    try {
      await ctx.plugin(SystemPrompt, { personaPrefix: 'Deployment persona.' })
      await ctx.plugin(PromptSections, {
        sections: [{ name: 'whole', order: 0, text: 'THE ENTIRE PROMPT', complete: true }],
        contexts: [],
      })
      const assembly = await ctx.systemPrompt.assemble()
      expect(assembly.sections.map(section => section.text)).toEqual(['THE ENTIRE PROMPT'])
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('removes exactly its contributions on disposal', async () => {
    const ctx = new Context()
    try {
      await ctx.plugin(SystemPrompt, {})
      const fiber = await ctx.plugin(PromptSections, {
        sections: [{ name: 'owned', order: 10, text: 'OWNED SECTION' }],
        contexts: [{ name: 'owned-context', order: 0, text: 'OWNED CONTEXT' }],
      })
      expect(renderPrompt(await ctx.systemPrompt.assemble())).toContain('OWNED SECTION')
      await fiber.dispose()
      const assembly = await ctx.systemPrompt.assemble()
      expect(assembly.sections.map(section => section.name)).not.toContain('owned')
      expect(assembly.contexts.map(context => context.name)).not.toContain('owned-context')
    } finally {
      await ctx.fiber.dispose()
    }
  })

  it('fails loud on a duplicate section name', async () => {
    const ctx = new Context()
    try {
      await ctx.plugin(SystemPrompt, {})
      ctx.systemPrompt.section({ name: 'taken', order: 0, text: 'EXISTING' })
      await expect(ctx.plugin(PromptSections, {
        sections: [{ name: 'taken', order: 10, text: 'CLASH' }],
        contexts: [],
      })).rejects.toThrow()
    } finally {
      await ctx.fiber.dispose()
    }
  })
})
