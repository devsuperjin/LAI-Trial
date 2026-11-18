/** Six specialist presets and one orchestrator, with settings-owned prompt text. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-settings'
import { DEFAULT_PROMPTS, PRESETS } from './definitions.ts'

export { DEFAULT_PROMPTS, PRESETS }
export const name = 'lai-agents'
export const inject = ['agentPresets', 'systemPrompt']

/** Each role's prompt is editable through ordinary DSH settings. */
export interface Prompts {
  orchestrator: string
  monitor: string
  triage: string
  reproduce: string
  ticket: string
  review: string
  report: string
}

export interface Config {
  /** Prompt templates used by the next prompt assembly in each agent scope. */
  prompts: Volatile<Prompts>
}

export const Config: z<Config> = z.object({
  prompts: z.object({
    orchestrator: z.string().min(1).default(DEFAULT_PROMPTS.orchestrator),
    monitor: z.string().min(1).default(DEFAULT_PROMPTS.monitor),
    triage: z.string().min(1).default(DEFAULT_PROMPTS.triage),
    reproduce: z.string().min(1).default(DEFAULT_PROMPTS.reproduce),
    ticket: z.string().min(1).default(DEFAULT_PROMPTS.ticket),
    review: z.string().min(1).default(DEFAULT_PROMPTS.review),
    report: z.string().min(1).default(DEFAULT_PROMPTS.report),
  }).default(DEFAULT_PROMPTS).volatile(),
})

/**
 * Register prompt variables and the presets that consume them.
 * @param ctx - Host composition with the public preset and prompt services.
 * @param config - Settings-backed role prompts; edits apply at the next assembly.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
  for (const role of Object.keys(DEFAULT_PROMPTS) as (keyof Prompts)[]) {
    ctx.effect(() => ctx.systemPrompt.variable(`lai_agent_${role}`, () => config.prompts.get()[role]), `lai-agents prompt: ${role}`)
  }
  for (const preset of PRESETS) {
    ctx.effect(() => ctx.agentPresets.register(preset), `lai-agents preset: ${preset.id}`)
  }
}
