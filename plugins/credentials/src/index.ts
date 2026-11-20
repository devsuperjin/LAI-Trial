import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-settings'

export const name = 'lai-credentials'
export const inject = ['tools']
export interface Credential {
  kind?: 'generic' | 'api' | 'ssh'
  endpoint?: string
  host?: string
  port?: number
  description: string
  service: string
  username: string
  token: string
  password: string
  allowUpdates?: boolean
  enabled: boolean
  allowedPresets: string[]
}
export interface Config { entries: Volatile<Record<string, Credential>> }
const Entry = z.object({
  kind: z.union([z.const('generic'), z.const('api'), z.const('ssh')]).default('generic'),
  endpoint: z.string().default(''), host: z.string().default(''), port: z.number().min(0).max(65535).step(1).default(0),
  description: z.string().default(''), service: z.string().default(''), username: z.string().role('secret').default(''),
  token: z.string().role('secret').default(''), password: z.string().role('secret').default(''),
  allowUpdates: z.boolean().default(false), enabled: z.boolean().default(true), allowedPresets: z.array(z.string().min(1)).default([]),
})
export const Config: z<{ entries?: Record<string, Partial<Credential>> }, Config> = z.object({ entries: z.dict(Entry).default({}).volatile() })
const text = (value: unknown) => [{ type: 'text' as const, text: JSON.stringify(value) }]
type CredentialView = Omit<Credential, 'allowedPresets'> & { allowedPresets: readonly string[] }
const permitted = (entry: CredentialView, exec: ToolRunContext) => {
  if (!exec.agent || !entry.enabled) return false
  const preset = exec.agent.session.header.agentPreset ?? 'default'
  return entry.allowedPresets.includes(preset) || entry.allowedPresets.includes('*')
}
const connectionSchema = { canUpdate: { type: 'boolean' }, kind: { type: 'string' }, endpoint: { type: 'string' }, host: { type: 'string' }, port: { type: 'number' } } as const
const connectionOf = (entry: CredentialView) => ({ canUpdate: entry.allowUpdates === true, kind: entry.kind ?? 'generic', ...(entry.endpoint ? { endpoint: entry.endpoint } : {}), ...(entry.host ? { host: entry.host } : {}), ...(entry.port ? { port: entry.port } : {}) })
export type CredentialPatch = Partial<Pick<Credential, 'username' | 'token' | 'password'>>
export function createTools(entries: () => Readonly<Record<string, CredentialView>>, update?: (id: string, patch: CredentialPatch, exec: ToolRunContext) => Promise<void>) {
  return [
    defineTool({
      name: 'credentials_list',
      description: 'List credentials authorized for this agent preset. Returns names, descriptions, service labels and connection information only; never secret values. Access does not authorize sending messages or changing external systems.',
      parameters: {},
      output: { schema: { type: 'object', additionalProperties: false, properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { ...connectionSchema, id: { type: 'string' }, description: { type: 'string' }, service: { type: 'string' } } } } } }, render: (_args, value) => text(value) },
      async execute(_args, exec) {
        exec.signal.throwIfAborted()
        return { items: Object.entries(entries()).filter(([, entry]) => permitted(entry, exec)).map(([id, entry]) => ({ id, description: entry.description, service: entry.service, ...connectionOf(entry) })) }
      },
    }),
    defineTool({
      name: 'credentials_get',
      description: 'Read an explicitly authorized credential by name for the user-requested research task. Returns plaintext to the model and its Run history. Never publish credentials or send them to unrelated domains; authorization to read is not authorization for external writes.',
      parameters: { id: { type: 'string', required: true, description: 'Credential name from credentials_list' } },
      output: { schema: { type: 'object', additionalProperties: false, properties: { ...connectionSchema, found: { type: 'boolean' }, id: { type: 'string' }, description: { type: 'string' }, service: { type: 'string' }, username: { type: 'string' }, token: { type: 'string' }, password: { type: 'string' }, reason: { type: 'string' } } }, render: (_args, value) => text(value) },
      presentCall() { return { card: 'generic' as const, title: 'Read authorized credential', kind: 'read' as const } },
      async execute(args, exec) {
        exec.signal.throwIfAborted()
        const all = entries()
        const entry = Object.hasOwn(all, args.id) ? all[args.id] : undefined
        if (!entry || !permitted(entry, exec)) return { found: false, reason: 'Credential unavailable or not authorized for this agent preset.' }
        if (!entry.token && !entry.password && !entry.username && !entry.endpoint && !entry.host && !entry.service && !entry.description) return { found: false, reason: 'Credential has no configured values.' }
        return { found: true, id: args.id, service: entry.service, description: entry.description, ...connectionOf(entry), ...(entry.username ? { username: entry.username } : {}), ...(entry.token ? { token: entry.token } : {}), ...(entry.password ? { password: entry.password } : {}) }
      },
    }),
    defineTool({
      name: 'credentials_update',
      description: 'Persist replacement username, token or password for an existing credential after separately authorized upstream rotation. Requires explicit update permission for this credential and caller preset. This updates the local credential store only, not the remote service. Cannot create credentials, change grants or enable itself. Replacement values may appear in tool-call history; the result never echoes secrets.',
      parameters: { id: { type: 'string', required: true, description: 'Existing credential ID' }, username: { type: 'string', description: 'Replacement username; omit to preserve' }, token: { type: 'string', description: 'Replacement token; omit to preserve' }, password: { type: 'string', description: 'Replacement password; omit to preserve' } },
      output: { schema: { type: 'object', additionalProperties: false, properties: { updated: { type: 'boolean' }, id: { type: 'string' }, fields: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } } }, render: (_args, value) => text(value) },
      presentCall() { return { card: 'generic' as const, title: 'Update authorized credential', kind: 'edit' as const } },
      async execute(args, exec) {
        exec.signal.throwIfAborted()
        const all = entries(), entry = Object.hasOwn(all, args.id) ? all[args.id] : undefined
        if (!entry || !permitted(entry, exec) || !entry.allowUpdates || !update) return { updated: false, reason: 'Credential updates are not authorized or unavailable.' }
        const patch: CredentialPatch = {}
        for (const field of ['username', 'token', 'password'] as const) if (typeof args[field] === 'string') {
          if (args[field].length > 16384) return { updated: false, reason: 'Replacement value is too long.' }
          patch[field] = args[field]
        }
        if (!Object.keys(patch).length) return { updated: false, reason: 'Supply at least one replacement field.' }
        try { await update(args.id, patch, exec) }
        catch { return { updated: false, reason: 'Update was not confirmed. Re-read the entry or ask the operator to resolve a settings conflict before retrying.' } }
        return { updated: true, id: args.id, fields: Object.keys(patch) }
      },
    }),
  ]
}
export function apply(ctx: Context, config: Config) {
  for (const tool of createTools(() => config.entries.get(), async (id, patch, exec) => {
    exec.signal.throwIfAborted()
    const settings = ctx.get('settings')
    const section = settings?.describe().find(section => section.ns === 'lai-credentials')
    const all = config.entries.get(), entry = Object.hasOwn(all, id) ? all[id] : undefined
    if (!settings || !section || !entry || !permitted(entry, exec) || !entry.allowUpdates) throw new Error('Credential update unavailable')
    await settings.mutate('lai-credentials', Object.entries(patch).map(([field, value]) => ({ op: 'set' as const, path: ['entries', id, field], value })), section.revision)
  })) ctx.effect(() => ctx.tools.register(tool), `Credentials tool: ${tool.name}`)
  registerCredentialManagement(ctx, config)
  ctx.inject(['settings'], child => { child.effect(() => child.settings.configure({ auto: true }, ctx.fiber)) })
}

/** Human-facing management reads use the existing DSH browser authentication. */
function registerCredentialManagement(ctx: Context, config: Config) {
  ctx.inject(['webServer', 'connection'], web => {
    web.effect(() => web.webServer.register({ kind: 'exact', path: '/lai-api/credentials/status', handler: (req, res) => {
      const rejection = web.connection.requestRejection(req)
      if (rejection !== undefined) { res.writeHead(rejection); res.end(); return }
      if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET' }); res.end(); return }
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end(JSON.stringify(Object.fromEntries(Object.entries(config.entries.get()).map(([id, entry]) => [id, { username: !!entry.username, token: !!entry.token, password: !!entry.password }]))))
    } }), 'Credentials configured-state API')
    web.effect(() => web.webServer.register({ kind: 'exact', path: '/lai-api/credentials/reveal', handler: async (req, res) => {
      const rejection = web.connection.requestRejection(req)
      if (rejection !== undefined) { res.writeHead(rejection); res.end(); return }
      res.setHeader('cache-control', 'no-store')
      res.setHeader('content-type', 'application/json')
      if (req.method !== 'POST' || req.headers['x-lai-credentials'] !== '1') { res.writeHead(403); res.end(JSON.stringify({ error: 'Explicit management request required' })); return }
      try {
        let body = ''
        for await (const chunk of req) { body += chunk.toString(); if (Buffer.byteLength(body) > 4096) { res.writeHead(413); res.end('{}'); return } }
        const input: unknown = JSON.parse(body)
        if (!input || typeof input !== 'object' || !('id' in input) || typeof input.id !== 'string' || !('field' in input) || !['username', 'token', 'password'].includes(String(input.field))) { res.writeHead(400); res.end('{}'); return }
        const entries = config.entries.get()
        const entry = Object.hasOwn(entries, input.id) ? entries[input.id] : undefined
        if (!entry) { res.writeHead(404); res.end('{}'); return }
        const field = input.field as 'username' | 'token' | 'password'
        res.writeHead(200); res.end(JSON.stringify({ value: entry[field] }))
      } catch { if (!res.headersSent) res.writeHead(400); res.end('{}') }
    } }), 'Credentials explicit reveal API')
  })
}
