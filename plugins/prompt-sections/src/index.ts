/**
 * Configuration-driven system-prompt injection: each configured section joins
 * prompt assembly at its declared order, and each configured context joins as
 * a dynamic runtime-context snapshot. Registrations are effects, so unloading
 * the plugin or editing its configuration removes exactly its contributions.
 * @module @lai/dsh-prompt-sections
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-system-prompt'

/** Stable Cordis plugin name. */
export const name = 'prompt-sections'

/** Required prompt assembly service. */
export const inject = ['systemPrompt']

/** One configured prompt section; field semantics follow `PromptSection`. */
export interface SectionEntry {
  /** Unique section name; a duplicate registration fails plugin loading. */
  name: string
  /** Ascending assembly position among all contributed sections. */
  order: number
  /** Section text; `{{variable}}` references interpolate unless disabled. */
  text: string
  /** Whether to interpolate prompt variables. Defaults to true. */
  interpolate?: boolean
  /** Treat this section as the complete system prompt. Defaults to false. */
  complete?: boolean
}

/** One configured runtime context; field semantics follow `PromptContext`. */
export interface ContextEntry {
  /** Unique context name; a duplicate registration fails plugin loading. */
  name: string
  /** Ascending join position among all contributed contexts. */
  order: number
  /** Context text; empty text contributes nothing. */
  text: string
  /** Whether to interpolate prompt variables. Defaults to true. */
  interpolate?: boolean
  /** Keep this context when optional runtime context is disabled. Defaults to false. */
  required?: boolean
}

/** Prompt-injection configuration. */
export interface Config {
  /** Standing system-prompt sections contributed by this deployment. */
  sections: SectionEntry[]
  /** Dynamic runtime contexts contributed by this deployment. */
  contexts: ContextEntry[]
}

/** Loader schema for the section and context lists. */
export const Config: z<Config> = z.object({
  sections: z.array(z.object({
    name: z.string().required(),
    order: z.number().required(),
    text: z.string().required(),
    interpolate: z.boolean(),
    complete: z.boolean(),
  })).default([]),
  contexts: z.array(z.object({
    name: z.string().required(),
    order: z.number().required(),
    text: z.string().required(),
    interpolate: z.boolean(),
    required: z.boolean(),
  })).default([]),
})

/**
 * Register every configured contribution as one effect-owned registration.
 * @param ctx - plugin context carrying the prompt assembly service.
 * @param config - validated section and context lists.
 */
export function apply(ctx: Context, config: Config): void {
  for (const section of config.sections) {
    ctx.effect(() => ctx.systemPrompt.section(section), `prompt-sections: section ${section.name}`)
  }
  for (const context of config.contexts) {
    ctx.effect(() => ctx.systemPrompt.context(context), `prompt-sections: context ${context.name}`)
  }
}
