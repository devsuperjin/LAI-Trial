/** LAI specialist tool catalog protocol; contains no execution callbacks or credentials. */
export type AgentToolRole = 'triage' | 'reproduce' | 'ticket' | 'review' | 'report'
export interface AgentToolCatalog { groups: { id: string; title: string; tools: { id: string; name: string; description: string; defaultRoles: AgentToolRole[] }[] }[] }
export async function agentToolCatalog(): Promise<AgentToolCatalog> {
  const response = await fetch('/lai-api/agents/tools', { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Tool catalog unavailable (${response.status})`)
  return await response.json() as AgentToolCatalog
}
export function defaultToolIds(catalog: AgentToolCatalog, role: string): string[] {
  return catalog.groups.flatMap(group => group.tools.filter(tool => tool.defaultRoles.includes(role as AgentToolRole)).map(tool => tool.id))
}
