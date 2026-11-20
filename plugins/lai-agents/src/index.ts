import { join } from 'node:path'
import { homedir } from 'node:os'
import { AgentToolCatalog, SKILL_TOOL_ID, type RoleTools } from './tools.ts'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
/** Independent LAI Agents bundle: Worker coordinator and five configurable native specialists. */
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-settings'
import { DEFAULT_PROMPTS, PRESETS, withoutCredentialAccess, withSkillDiscovery } from './definitions.ts'

export { DEFAULT_PROMPTS, PRESETS }
export type { ToolGroup, ToolCatalogView, RoleTools } from './tools.ts'
export const name = 'lai-agents'
export const inject = ['agentPresets', 'systemPrompt', 'tools']

declare module '@deepseek-ai/cordis' { interface Context { laiAgents: { readonly presets: readonly string[]; registerTools: AgentToolCatalog['registerTools']; catalog: AgentToolCatalog['catalog']; toolDenial: AgentToolCatalog['toolDenial']; allowedToolNames: AgentToolCatalog['allowedToolNames'] } } }

/** Each role's prompt is editable through ordinary DSH settings. */
export interface Prompts {
  orchestrator: string
  triage: string
  reproduce: string
  ticket: string
  review: string
  report: string
}

export const SPECIALIST_PRESETS = { triage: 'iqe-triage', reproduce: 'iqe-reproduction', ticket: 'iqe-ticket', review: 'iqe-reviewer', report: 'iqe-reporting' } as const
export type RoleModels = Partial<Record<keyof typeof SPECIALIST_PRESETS, { provider: string; model: string } | null>>

/** Select a role route for new children, preserving durable manual selections on restored sessions. */
export function seedRoleModel(agent: Agent, models: RoleModels): void {
  const role = (Object.keys(SPECIALIST_PRESETS) as (keyof RoleModels)[]).find(key => SPECIALIST_PRESETS[key] === agent.session.header.agentPreset)
  const route = role && models[role]
  if (!route || agent.session.snapshotEvents().some(event => agent.session.isOwnSeq(event.seq) && (event.type === 'request/header' || event.type === 'model/selection'))) return
  agent.model.select(route)
}

export interface Config {
  /** Prompt templates used by the next prompt assembly in each agent scope. */
  prompts: Volatile<Prompts>
  models?: Volatile<RoleModels>
  tools?: Volatile<RoleTools>
  skillDefaults?: Volatile<{ version: number }>
}

const Route = z.union([z.object({ provider: z.string().min(1).required(), model: z.string().min(1).required() }), z.const(null)]).default(null)
const ToolSelection = z.union([z.array(z.string().min(1)), z.const(null)]).default(null)
export const Config: z<Config> = z.object({
  skillDefaults: z.object({ version: z.number().default(0) }).default({}).volatile(),
  tools: z.object({ triage: ToolSelection, reproduce: ToolSelection, ticket: ToolSelection, review: ToolSelection, report: ToolSelection }).default({}).volatile(),
  models: z.object({ triage: Route, reproduce: Route, ticket: Route, review: Route, report: Route }).default({}).volatile(),
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
    child.effect(async () => {
      const section = child.settings.describe().find(section => section.ns === 'lai-agents')
      if (!section) return () => {}
      const prompts = config.prompts.get()
      const ops: { op: 'set'; path: string[]; value: string | string[] | number }[] = (Object.keys(DEFAULT_PROMPTS) as (keyof Prompts)[]).flatMap(role => {
        const body = withoutCredentialAccess(prompts[role]) || DEFAULT_PROMPTS[role]
        const cleaned = role === 'orchestrator' ? body : withSkillDiscovery(body)
        return cleaned === prompts[role] ? [] : [{ op: 'set' as const, path: ['prompts', role], value: cleaned }]
      })
      // Upgrade saved explicit selections once; later deliberate opt-outs remain respected.
      if ((config.skillDefaults?.get().version ?? 0) < 1) {
        const tools = config.tools?.get() ?? {}
        for (const role of Object.keys(SPECIALIST_PRESETS) as (keyof RoleTools)[]) {
          const selected = tools[role]
          if (selected && !selected.includes(SKILL_TOOL_ID)) ops.push({ op: 'set', path: ['tools', role], value: [...selected, SKILL_TOOL_ID] })
        }
        ops.push({ op: 'set', path: ['skillDefaults', 'version'], value: 1 })
      }
      if (ops.length) await child.settings.mutate('lai-agents', ops, section.revision).catch(() => { ctx.logger.warn('Could not migrate LAI prompt and Skill defaults; reload configuration before creating new subagents.') })
      return () => {}
    }, 'Migrate role prompts and enable Skill defaults')
  })

  for (const role of Object.keys(DEFAULT_PROMPTS) as (keyof Prompts)[]) {
    ctx.effect(() => ctx.systemPrompt.variable(`lai_agent_${role}`, () => {
      const body = withoutCredentialAccess(config.prompts.get()[role]) || DEFAULT_PROMPTS[role]
      return role === 'orchestrator' ? body : withSkillDiscovery(body)
    }), `lai-agents prompt: ${role}`)
  }
  ctx.effect(() => ctx.systemPrompt.section({ name: 'lai-agents:available-roles', order: 2790, text: 'Available LAI role presets: iqe-triage (root cause), iqe-reproduction (controlled reproduction), iqe-ticket (ticket draft), iqe-reviewer (independent review), iqe-reporting (reporter). These role definitions are distinct from live descendants returned by list_agents. The Superagent Router performs monitoring and dispatch. Each ticket Worker uses iqe-orchestrator and invokes its five delegation tools to create LAI subagents in stage order. list_agents reports actual descendants of the current session; unrelated chats can have no children. Use the tools actually mounted in this session; do not invent delegation tools.' }), 'LAI role catalog')
  for (const preset of PRESETS) {
    await ctx.effect(() => ctx.agentPresets.register(preset), `lai-agents preset: ${preset.id}`)
  }
  const toolCatalog = new AgentToolCatalog(ctx, join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'lai-agents', 'tool-selections'))
  ctx.effect(() => () => toolCatalog.dispose(), 'LAI tools lifecycle')
  ctx.on('agent/created', async ({ agent }) => {
    seedRoleModel(agent, config.models?.get() ?? {})
    await toolCatalog.mount(agent, config.tools?.get() ?? {})
  }, { prepend: true })
  ctx.on('agent/disposed', ({ agent }) => toolCatalog.release(agent))
  ctx.provide('laiAgents', { presets: PRESETS.map(preset => preset.id), registerTools: toolCatalog.registerTools.bind(toolCatalog), catalog: toolCatalog.catalog.bind(toolCatalog), toolDenial: toolCatalog.toolDenial.bind(toolCatalog), allowedToolNames: toolCatalog.allowedToolNames.bind(toolCatalog) })
  ctx.inject(['webServer', 'connection'], web => {
    web.effect(() => web.webServer.register({ kind: 'exact', path: '/lai-api/agents/tools', handler: async (req, res) => {
      const rejection = web.connection.requestRejection(req)
      if (rejection !== undefined) { res.writeHead(rejection); res.end(); return }
      if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
      try { const value = await toolCatalog.catalog(); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)) }
      catch (error) { res.writeHead(503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) })) }
    } }), 'LAI tool catalog API')
  })
}
