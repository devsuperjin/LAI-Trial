/** One orchestrator/monitor and five specialist presets, with settings-owned prompt text. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-settings'
import { DEFAULT_PROMPTS, PRESETS } from './definitions.ts'

export { DEFAULT_PROMPTS, PRESETS }
export const name = 'lai-agents'
export const inject = ['agentPresets', 'systemPrompt']

declare module '@deepseek-ai/cordis' { interface Context { laiAgents: { readonly presets: readonly string[] } } }

/** Each role's prompt is editable through ordinary DSH settings. */
export interface Prompts {
  orchestrator: string
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
export async function apply(ctx: Context, config: Config): Promise<void> {
  ctx.inject(['settings'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))
  })
  for (const role of Object.keys(DEFAULT_PROMPTS) as (keyof Prompts)[]) {
    ctx.effect(() => ctx.systemPrompt.variable(`lai_agent_${role}`, () => config.prompts.get()[role]), `lai-agents prompt: ${role}`)
  }
  ctx.effect(() => ctx.systemPrompt.section({ name: 'lai-agents:available-roles', order: 2790, text: 'Available LAI role presets: iqe-triage (root cause), iqe-reproduction (controlled reproduction), iqe-ticket (ticket draft), iqe-reviewer (independent review), iqe-reporting (report). These role definitions are distinct from live descendants returned by list_agents. The pipeline uses iqe-orchestrator as its parent and performs monitoring itself and invokes its five delegation tools to create LAI subagents in stage order. list_agents reports actual descendants of the current session; unrelated chats can have no children. Use the tools actually mounted in this session; do not invent delegation tools.' }), 'LAI role catalog')
  for (const preset of PRESETS) {
    await ctx.effect(() => ctx.agentPresets.register(preset), `lai-agents preset: ${preset.id}`)
  }
  ctx.provide('laiAgents', { presets: PRESETS.map(preset => preset.id) })
}
