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
    if (!result.ok) {
      const failure = result.error
      const message = typeof failure === 'string' ? failure
        : typeof failure === 'object' && failure !== null && 'message' in failure && typeof failure.message === 'string' ? failure.message
          : 'RPC request failed'
      throw new Error(message)
    }
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

/** A provider's editable location, reported by the running DSH adapter. */
export interface ConfigurableProvider {
  provider: string
  displayName: string
  settingsNs: string
  settingsPath: string[]
  declared?: boolean
  defaultBaseURL?: string
  nativeAuth?: { env: string[]; oauth: boolean }
  error?: string
}

/** Credential metadata; secret values are never returned by this API. */
export interface CredentialInfo {
  configured: boolean
  source?: string
  writable: boolean
}

/** Path edits preserve unedited settings and use the namespace revision as a write fence. */
export type SettingsPathOp =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

/** List installed catalog providers and custom routes, including dormant providers. */
export function listConfigurableProviders(): Promise<ConfigurableProvider[]> {
  return rpc('llm/listConfigurableProviders', {})
}

/** Apply only the edited provider fields; reject stale revisions without overwriting them. */
export function mutateSettings(ns: string, ops: SettingsPathOp[], expectedRevision: number): Promise<SettingsNamespaceView> {
  return rpc('settings/mutate', { ns, ops, expectedRevision })
}

/** Read credential presence and writability without retrieving the key. */
export function describeCredentials(refs: string[]): Promise<Record<string, CredentialInfo>> {
  return rpc('credentials/describe', { refs })
}

/** Store a write-only key through DSH's credential service, separately from provider settings. */
export function setCredential(ref: string, value: string): Promise<void> {
  return rpc('credentials/set', { ref, value })
}
