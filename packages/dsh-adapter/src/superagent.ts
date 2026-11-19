/** Same-origin Superagent management protocol, owned by the LAI adapter. */
export type Localized = { en: string; zh: string }
export interface ConfigBlock { value: Record<string, unknown>; revision: number }
export interface SourceField { key: string; type: string; label: Localized; hint?: Localized; min?: number; max?: number; readonly?: boolean; options?: { value: string; label: Localized }[] }
export interface SourceSettings extends ConfigBlock { id: string; title: Localized; description: Localized; fields: SourceField[]; value: { enabled: boolean; config: Record<string, unknown> }; installed: boolean }
export interface SuperagentSettings { blocks: Record<'policy' | 'eval' | 'executor', ConfigBlock>; sources: SourceSettings[]; environment: { root: string } }
export interface SuperagentState { masterId: string; paused: boolean; load: { running: number; queued: number; maxWorkers: number }; health: Record<string, { state: string; detail: string }>; setup: { machine: { stateDir: string }; problem: { detail?: string; code?: string } | null; accounts: { repository: string; agent: string } | null } }
export interface SuperagentTicket { id: string; title: string; stage: string; action?: string; updatedAt: string; threads?: { key: string; title: string; url?: string }[]; report?: { state: string; summary: string }; actions?: { retry: boolean; stop: boolean }; sessionId?: string; directory?: string; summary?: string; assignments?: number | { id: string; ref?: string; report?: { state: string; summary: string } }[] }
export interface TicketPage { items: SuperagentTicket[]; total: number; offset: number; next_offset?: number | null }
export interface PromptView { current: { config: Record<string, unknown>; revision: number } }
export async function superagentRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/orchestrator/api/${path}`, { method, credentials: 'same-origin', headers: { 'x-orchestrator-request': '1', ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const text = await response.text()
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error(`Superagent unavailable (${response.status}). Check application startup.`) }
  if (!response.ok) throw new Error((value as { error?: string }).error ?? `Superagent request failed (${response.status})`)
  return value as T
}
export const superagentState = () => superagentRequest<SuperagentState>('state')
export const superagentSettings = () => superagentRequest<SuperagentSettings>('settings')
export const saveSuperagentSettings = (block: string, value: unknown, revision: number) => superagentRequest<{ revision: number; restarting: boolean }>(`settings/${encodeURIComponent(block)}`, 'PUT', { value, revision })
export const superagentTickets = (state = 'open', offset = 0) => superagentRequest<TicketPage>(`tickets?state=${encodeURIComponent(state)}&offset=${offset}&limit=30`)
export const superagentTicket = (id: string) => superagentRequest<SuperagentTicket>(`tickets/${encodeURIComponent(id)}`)
export const superagentAction = (path: string, body?: unknown) => superagentRequest<Record<string, unknown>>(path, 'POST', body)
export const superagentPrompts = () => superagentRequest<PromptView>('prompts')
export const saveSuperagentPrompts = (config: unknown, baseRevision: number) => superagentRequest('prompts', 'PUT', { config, baseRevision })

/** Operator metrics come from the task engine, not inferred session completion. */
export interface SuperagentOverview {
  problems: { kind: string; detail?: string; name?: string; source?: { title: Localized; health: { detail: string } }; outgoing?: { error?: string } }[]
  person: SuperagentTicket[]
  executor: { running: number; queued: number; maxWorkers: number; idle: number }
  flow: { received: number; filtered: number; triggers: number; judged: number; accepted: number; evaluating: number; dropped: number }
  policyVersion: string
}
export const superagentOverview = () => superagentRequest<SuperagentOverview>('overview')
