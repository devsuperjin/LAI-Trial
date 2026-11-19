/** Same-origin Superagent management protocol, owned by the LAI adapter. */
export type Localized = { en: string; zh: string }
export interface ConfigBlock { value: Record<string, unknown>; revision: number }
export interface SourceField { key: string; type: string; label: Localized; hint?: Localized; min?: number; max?: number; readonly?: boolean; options?: { value: string; label: Localized }[] }
export interface SourceSettings extends ConfigBlock { id: string; title: Localized; description: Localized; fields: SourceField[]; value: { enabled: boolean; config: Record<string, unknown> }; installed: boolean }
export interface SuperagentSettings { blocks: Record<'policy' | 'eval' | 'executor', ConfigBlock>; sources: SourceSettings[]; environment: { root: string } }
export interface SuperagentState { masterId: string; paused: boolean; load: { running: number; queued: number; maxWorkers: number }; health: Record<string, { state: string; detail: string }>; setup: { machine: { stateDir: string }; problem: { detail?: string; code?: string } | null; accounts: { repository: string; agent: string } | null } }
export interface SuperagentTicket { id: string; title: string; stage: string; action?: string; updatedAt: string; threads?: { key: string; title: string; url?: string }[]; report?: { state: string; summary: string }; actions?: { retry: boolean; stop: boolean }; sessionId?: string; directory?: string; summary?: string; assignments?: number | { id: string; ref?: string; report?: { state: string; summary: string } }[] }
export interface TicketPage { items: SuperagentTicket[]; total: number; offset: number; next_offset?: number | null }
export interface PromptView {
  current: { config: Record<string, unknown>; revision: number }
  defaults: Record<string, unknown>
  parts: { key: string; roles: string[]; text: string; base: string }[]
  revisions: { revision: number; savedAt: string; source: string; changed: string[] }[]
  next_offset: number | null
}
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

export interface RouterDecision { id: string; kind: string; outcome: string; reason: string; at: string; threadTitle?: string; ticketTitle?: string; ticketId?: string; preview: string }
export interface RouterDecisions { items: RouterDecision[]; next_offset: number | null }
/** Normalize structured API reasons before they reach React text children. */
export function routerReasonText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(routerReasonText).filter(Boolean).join('; ')
  if (!value || typeof value !== 'object') return ''
  const reason = value as { code?: string; values?: Record<string, string> }
  const templates: Record<string, string> = {
    said: '{text}', timeout: 'Assessment timed out', policyChanged: 'Policy changed during assessment',
    noAdmissible: 'No admissible trigger', startedTicket: 'Already started ticket {ticket}',
    acceptedBefore: 'Trigger {trigger} was accepted before', routed: 'Routed to ticket {ticket}',
    explicitRouted: 'Explicit request from an allowed sender routed by the Router', humanStop: 'Human asked to stop',
    legacyImport: 'Imported task record', forwarded: 'Forwarded to the existing Worker',
    senderNotMember: 'The sender is not on the allowed list', retried: 'Retried by a person',
    hostRestarted: 'Superagent restarted', stopUnknown: 'Stop target is unknown or already ended',
    stopNotExplicit: 'Stopping requires an explicit request from an allowed sender',
    directionUnsettled: 'Implementation direction requires clarification', noRuleMatched: 'No enabled admission rule matched',
    ignoredFromCard: 'Ignored without a rule assessment', observed: 'Observe mode: would accept ({text})',
  }
  return (templates[reason.code ?? ''] ?? reason.code ?? '').replace(/\{(\w+)\}/g, (match, key: string) => reason.values?.[key] ?? match)
}
export const superagentDecisions = async (kind: string, offset = 0): Promise<RouterDecisions> => {
  const page = await superagentRequest<Omit<RouterDecisions, 'items'> & { items: (Omit<RouterDecision, 'reason'> & { reason: unknown })[] }>(`decisions?kind=${encodeURIComponent(kind)}&offset=${offset}&limit=30`)
  return { ...page, items: page.items.map(item => ({ ...item, reason: routerReasonText(item.reason) })) }
}
export const previewSuperagentPrompts = async (config: unknown): Promise<{ orchestrator: string; worker: string }> => {
  const response = await superagentRequest<{ orchestrator: unknown; worker: unknown }>('prompts/preview', 'POST', config)
  if (typeof response.orchestrator !== 'string' || typeof response.worker !== 'string') throw new Error('Invalid Superagent prompt preview response')
  // The endpoint also returns structured parts, skills and scope metadata.
  return { orchestrator: response.orchestrator, worker: response.worker }
}

/** Ticket-owned metadata is only available for Superagent Worker Runs. */
export interface WorkerTicketDetails {
  id: string
  mandate: { scope: string; strength: string; policyVersion: string; actor: { source: string; id: string; name?: Localized } }
  basis: { legacy: boolean; facts: { name: string; value?: string | { id: string; name: string }[] }[] }
  decision?: { kind: string; reason: unknown; preview: string; at: string; rules?: { id: string; name: string; matched: boolean; reason: string }[] }
  environment: { key: string; value: string; description: Localized; owner: string }[]
}
export const superagentWorkerDetails = (runId: string) => {
  if (!runId.startsWith('worker-') || runId.length === 7) throw new Error('This Run is not a Superagent Worker')
  return superagentRequest<WorkerTicketDetails>(`tickets/${encodeURIComponent(runId.slice(7))}`)
}
