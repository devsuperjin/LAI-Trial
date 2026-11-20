/** Plugin-owned tool catalog and per-Run selections, using published DSH scopes. */
import type { Context } from '@deepseek-ai/cordis'
import { scopeParentOf } from '@deepseek-ai/dsh-scope'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { createHash, randomUUID } from 'node:crypto'
import { link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const TOOL_ROLES = { triage: 'iqe-triage', reproduce: 'iqe-reproduction', ticket: 'iqe-ticket', review: 'iqe-reviewer', report: 'iqe-reporting' } as const
export type ToolRole = keyof typeof TOOL_ROLES
/** null / missing preserves the role's original tools; [] explicitly selects none from the catalog. */
export type RoleTools = Partial<Record<ToolRole, readonly string[] | null>>
export interface ToolGroup { id: string; title: string; tools: readonly ToolDefinition[] }
export interface CatalogTool { id: string; name: string; description: string; defaultRoles: ToolRole[] }
export interface ToolCatalogView { groups: { id: string; title: string; tools: CatalogTool[] }[] }
const BUILTINS: Record<string, { title: string; names: string[] }> = {
  '@deepseek-ai/dsh-tool-fs': { title: 'Files', names: ['read', 'read_image', 'write', 'edit', 'apply_patch'] },
  '@deepseek-ai/dsh-tool-fs-search': { title: 'File search', names: ['glob', 'grep'] },
  '@deepseek-ai/dsh-tool-bash': { title: 'Shell', names: ['bash'] },
  '@deepseek-ai/dsh-tool-jobs': { title: 'Background jobs', names: ['job_output', 'job_list', 'job_kill'] },
  '@deepseek-ai/dsh-tool-skill': { title: 'Skills', names: ['skill'] },
  '@deepseek-ai/dsh-tool-web': { title: 'Web', names: ['web_search', 'web_fetch'] },
  '@deepseek-ai/dsh-tool-present': { title: 'Presentation', names: ['present'] },
}
const builtinGroup = (name: string) => Object.keys(BUILTINS).find(id => BUILTINS[id]!.names.includes(name))
export const SKILL_TOOL_ID = '@deepseek-ai/dsh-tool-skill#skill'
const idOf = (group: string, name: string) => `${group}#${name}`
export const toolRole = (preset: string | undefined): ToolRole | undefined => (Object.keys(TOOL_ROLES) as ToolRole[]).find(role => TOOL_ROLES[role] === preset)

export interface ToolSelection { version: 1; role: ToolRole; tools: string[] }
/** Persist once so settings edits and process restarts do not change an existing Run. */
export async function retainSelection(directory: string, runId: string, role: ToolRole, tools: readonly string[]): Promise<ToolSelection> {
  await mkdir(directory, { recursive: true })
  const path = join(directory, `${createHash('sha256').update(runId).digest('hex')}.json`)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, role, tools: [...new Set(tools)] }), { flag: 'wx', mode: 0o600 })
    try { await link(temporary, path) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error }
  } finally { await unlink(temporary).catch(() => {}) }
  const saved: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== 1 || !('role' in saved) || saved.role !== role || !('tools' in saved) || !Array.isArray(saved.tools) || saved.tools.some(tool => typeof tool !== 'string')) throw new Error('Invalid saved LAI tool selection')
  return saved as ToolSelection
}

export class AgentToolCatalog {
  private groups = new Map<string, ToolGroup>()
  private selections = new Map<Agent, ReadonlySet<string>>()
  private bindings = new Map<Agent, (() => void | PromiseLike<void>)[]>()
  constructor(private ctx: Context, private directory: string) {}

  /** Install the plugin once; opt-in tools are mounted only in selected specialist scopes. */
  registerTools(group: ToolGroup): () => void {
    if (!/^@lai\/[a-z0-9-]+$/.test(group.id) || !group.title.trim() || !group.tools.length) throw new Error('Tool group needs an @lai package id, title and tools')
    if (this.groups.has(group.id)) throw new Error(`Duplicate tool group: ${group.id}`)
    const names = new Set<string>()
    for (const tool of group.tools) {
      if (!/^[a-z][a-z0-9_]*$/.test(tool.name) || builtinGroup(tool.name) || /^(orchestrator_|triage$|reproduce$|ticket$|review$|reporter$|subagent$|run_code$)/.test(tool.name)) throw new Error(`Reserved or invalid tool name: ${tool.name}`)
      if (names.has(tool.name) || [...this.groups.values()].some(other => other.tools.some(item => item.name === tool.name))) throw new Error(`Duplicate tool name: ${tool.name}`)
      names.add(tool.name)
    }
    const registration = { ...group, tools: [...group.tools] }
    this.groups.set(group.id, registration)
    return () => { if (this.groups.get(group.id) === registration) this.groups.delete(group.id) }
  }

  /** Inspect the public DSH registry. Tool plugins do not depend on LAI. */
  private availableGroups(): ToolGroup[] {
    const registered = this.ctx.tools.definitions().filter(tool =>
      !builtinGroup(tool.name) &&
      !/^(orchestrator_|triage$|reproduce$|ticket$|review$|reporter$|subagent$|run_code$)/.test(tool.name) &&
      // Conditional registrations must retain their step activation policy; do not clone them.
      this.ctx.tools.executable(tool.name) === tool &&
      ![...this.groups.values()].some(group => group.tools.some(item => item.name === tool.name)))
    return [...this.groups.values(), ...(registered.length ? [{ id: 'dsh:registered-tools', title: 'Registered DSH tools', tools: registered }] : [])]
  }

  private async builtins() {
    const tools = new Map<string, { definition: ToolDefinition; role: ToolRole; roles: ToolRole[]; byRole: Partial<Record<ToolRole, ToolDefinition>> }>()
    const leases: AsyncDisposable[] = []
    try {
      for (const role of Object.keys(TOOL_ROLES) as ToolRole[]) {
        const lease = await this.ctx.agentPresets.acquireScope(TOOL_ROLES[role]); leases.push(lease)
        for (const definition of this.ctx.tools.definitions(lease.key)) {
          const group = builtinGroup(definition.name)
          if (!group) continue
          const id = idOf(group, definition.name)
          const found = tools.get(id)
          if (found) { found.roles.push(role); found.byRole[role] = definition }
          else tools.set(id, { definition, role, roles: [role], byRole: { [role]: definition } })
        }
      }
      return { tools, leases }
    } catch (error) { for (const lease of leases.reverse()) await lease[Symbol.asyncDispose](); throw error }
  }

  async catalog(): Promise<ToolCatalogView> {
    const { tools, leases } = await this.builtins()
    try {
      return { groups: [
        ...Object.entries(BUILTINS).map(([id, group]) => ({ id, title: group.title, tools: [...tools].filter(([key]) => key.startsWith(`${id}#`)).map(([key, tool]) => ({ id: key, name: tool.definition.name, description: tool.definition.description, defaultRoles: tool.roles })) })).filter(group => group.tools.length),
        ...this.availableGroups().map(group => ({ id: group.id, title: group.title, tools: group.tools.map(tool => ({ id: idOf(group.id, tool.name), name: tool.name, description: tool.description, defaultRoles: [] })) })),
      ] }
    } finally { for (const lease of leases.reverse()) await lease[Symbol.asyncDispose]() }
  }

  async mount(agent: Agent, settings: RoleTools): Promise<void> {
    const role = toolRole(agent.session.header.agentPreset)
    if (!role || this.bindings.has(agent)) return
    const defaults = this.ctx.tools.definitions(agent).flatMap(tool => { const group = builtinGroup(tool.name); return group ? [idOf(group, tool.name)] : [] })
    const restored = agent.session.snapshotEvents().some(event => agent.session.isOwnSeq(event.seq) && event.type === 'turn/start')
    const cleanups: (() => void | PromiseLike<void>)[] = []
    this.bindings.set(agent, cleanups)
    try {
      const selection = await retainSelection(this.directory, agent.id, role, restored ? defaults : settings[role] ?? defaults)
      if (this.bindings.get(agent) !== cleanups) return
      this.selections.set(agent, new Set(selection.tools))
      const desired = new Set(selection.tools)
      cleanups.push(agent.ctx.tools.guard(execution => this.toolDenial(agent, execution.name)))
      // Only inherited catalog tools are masked. DSH lifecycle and delegation tools remain host-owned.
      const denied = this.ctx.tools.definitions(agent).filter(tool => { const group = builtinGroup(tool.name) ?? this.availableGroups().find(group => group.tools.some(item => item.name === tool.name))?.id; return group && !desired.has(idOf(group, tool.name)) }).map(tool => tool.name)
      if (denied.length) cleanups.push(agent.ctx.tools.restrict({ deny: denied }))
      const { tools, leases } = await this.builtins()
      if (this.bindings.get(agent) !== cleanups) { for (const lease of leases.reverse()) await lease[Symbol.asyncDispose](); return }
      cleanups.push(...leases.map(lease => () => lease[Symbol.asyncDispose]()))
      for (const id of desired) {
        const builtin = tools.get(id)
        if (builtin) {
          // The explicit selection guard and Superagent ticket guard also cover scoped registrations.
          if (!this.ctx.tools.get(builtin.definition.name, scopeParentOf(agent))) cleanups.push(agent.ctx.tools.register(builtin.byRole[role] ?? builtin.definition))
          continue
        }
        const group = this.availableGroups().find(group => group.tools.some(tool => idOf(group.id, tool.name) === id))
        const definition = group?.tools.find(tool => idOf(group.id, tool.name) === id)
        if (group && definition) cleanups.push(agent.ctx.tools.register({ ...definition, execute: (args, execution) => {
          if (group.id === 'dsh:registered-tools' ? this.ctx.tools.executable(definition.name) !== definition : this.groups.get(group.id) !== group) throw new Error('This tool plugin has been unloaded; create a new Run after installing it again')
          return definition.execute(args, execution)
        } }))
        // Removed tools remain unavailable; never replace them by an unrelated tool with the same name.
      }
    } catch (error) { await this.release(agent); throw error }
  }

  allowedToolNames(agent: Agent): string[] {
    return [...this.selections.get(agent) ?? []].flatMap(id => {
      const split = id.lastIndexOf('#'), group = id.slice(0, split), name = id.slice(split + 1)
      const declared = BUILTINS[group]?.names.includes(name) || this.availableGroups().find(item => item.id === group)?.tools.some(tool => tool.name === name)
      return declared ? [name] : []
    })
  }

  /** Superagent asks this guard as well as retaining its Ticket lifecycle guard. */
  toolDenial(agent: Agent, name: string): string | undefined {
    const selected = this.selections.get(agent)
    if (!selected) return undefined
    const group = builtinGroup(name) ?? this.availableGroups().find(group => group.tools.some(tool => tool.name === name))?.id
    return group && !selected.has(idOf(group, name)) ? `Tool ${name} is not selected for this LAI role` : undefined
  }

  async release(agent: Agent): Promise<void> {
    const cleanups = this.bindings.get(agent)
    this.bindings.delete(agent)
    this.selections.delete(agent)
    for (const cleanup of (cleanups ?? []).reverse()) await cleanup()
  }
  async dispose(): Promise<void> { for (const agent of [...this.bindings.keys()]) await this.release(agent) }
}
