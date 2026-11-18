export interface SessionListEntry {
  sessionId: string
  updatedAt: number
  running: boolean
  blank?: boolean
  cwd?: string
  parentSessionId?: string
  origin?: string
  projections?: {
    kind: 'sequenced' | 'cached'
    values: {
      title?: string | null
      agentPreset?: string | null
      tokenUsage?: {
        uncachedInputTokens: number
        outputTokens: number
        cacheReadTokens: number
        cacheWriteTokens: number
      }
      modelSelection?: {
        lastUsed?: { provider: string; model: string } | null
        next?: { provider: string; model: string } | null
      }
      subagentTiming?: {
        settledMs?: number
        lastTurnCompleted?: boolean
        active?: { since: number; through?: number }
      }
      subagent?: { mode?: string; label?: string; seq?: number } | null
      subagentCatalog?: { id: string; label?: string; name?: string; createdAt?: number }[]
    }
  } | null
}

export interface WireEvent {
  type: string
  seq: number
  time: number
  data: Record<string, unknown>
}

export interface PageResponse {
  cursor: unknown
  records: { type: string; event: WireEvent }[]
  hasMore: boolean
}

let nextRpcId = 0

interface ServerMessage {
  type: string
  rpcId?: string
  result?: { ok: boolean; value?: unknown; error?: unknown }
}

function rpc<Result>(endpoint: string, args: unknown): Promise<Result> {
  const rpcId = `lai-web-${Date.now()}-${nextRpcId++}`
  return fetch(`/api/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId,
      method: endpoint,
      payload: { args },
    }),
  }).then(async (response): Promise<Result> => {
    if (response.status === 401) throw new UnauthorizedError()
    if (!response.ok) throw new Error(`gateway returned ${response.status}`)
    const message = (await response.json()) as ServerMessage
    if (message.type !== 'server-response' || message.rpcId !== rpcId || !message.result) {
      throw new Error(`unexpected gateway response for ${rpcId}`)
    }
    const result = message.result
    if (!result.ok) throw new Error(typeof result.error === 'string' ? result.error : 'rpc failed')
    return result.value as Result
  })
}

export class UnauthorizedError extends Error {
  constructor() {
    super('gateway request unauthorized')
    this.name = 'UnauthorizedError'
  }
}

/** Exchange a URL token for the gateway cookie via the dev-proxy bootstrap path. */
export async function bootstrapWithToken(token: string): Promise<void> {
  const response = await fetch(`/dsh-auth?token=${encodeURIComponent(token)}`, { redirect: 'manual' })
  if (!response.ok && response.type !== 'opaqueredirect') {
    throw new Error(`token bootstrap failed (${response.status})`)
  }
}

export function listSessions(): Promise<{ items: SessionListEntry[] }> {
  return rpc('session/list', { _request: {} })
}

export function pageSession(sessionId: string, maxMessages: number): Promise<PageResponse> {
  return rpc('session/page', {
    request: { address: { kind: 'session', sessionId }, maxMessages },
  })
}

/** Read one direct subagent child through its durable parent address. */
export function pageSubagentSession(parentSessionId: string, childSessionId: string, maxMessages: number): Promise<PageResponse> {
  return rpc('session/page', {
    request: { address: { kind: 'subagent', parentSessionId, childSessionId, mode: 'unknown' }, maxMessages },
  })
}

export interface ModelSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface ModelCatalogModel {
  id: string
  name: string
  description?: string
}

export interface ModelProviderGroup {
  id: string
  name: string
  models: ModelCatalogModel[]
}

export interface ModelCatalogFailure {
  id: string
  name: string
  message: string
}

export interface ModelCatalog {
  default: ModelSelection
  routableProviders: string[]
  groups: ModelProviderGroup[]
  failures: ModelCatalogFailure[]
}

export function modelCatalog(): Promise<ModelCatalog> {
  return rpc('session/modelCatalog', {})
}

export interface AgentPresetRow {
  id: string
  isDefault: boolean
  name?: string
  description?: string
  order?: number
  broken?: string
}

export function listAgentPresets(): Promise<{ presets: AgentPresetRow[] }> {
  return rpc('agentPresets/list', {})
}

export interface AgentPresetDocument {
  agentPreset: string
  content: string
  name?: string
  description?: string
}

export function readAgentPreset(agentPreset: string): Promise<AgentPresetDocument> {
  return rpc('agentPresets/read', { agentPreset })
}

export interface SettingsNamespaceView {
  ns: string
  autoGenerate: boolean
  value: Record<string, unknown>
  base?: Record<string, unknown>
  user?: Record<string, unknown>
  applies: 'live'
  revision: number
}

export interface SettingsDescribeValue {
  writable: boolean
  hasDocument: boolean
  namespaces: SettingsNamespaceView[]
}

export function describeSettings(): Promise<SettingsDescribeValue> {
  return rpc('settings/describe', {})
}

export function updateSettings(ns: string, patch: Record<string, unknown>, expectedRevision: number): Promise<SettingsNamespaceView> {
  return rpc('settings/update', { ns, patch, expectedRevision })
}
