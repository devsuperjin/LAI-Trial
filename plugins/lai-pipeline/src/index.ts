/** Public source-registration service and authenticated UI API for event-driven IQE execution. */
import { Context, Service } from '@deepseek-ai/cordis'
import type { Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { isAbsolute } from 'node:path'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-subagent'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-permission-presets'
import type {} from '@deepseek-ai/dsh-session-title'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@lai/lai-agents'
import { DshPipelineDriver } from './driver.ts'
import { PipelineEngine } from './engine.ts'
import { FilePipelineStore } from './store.ts'
import { PipelineError } from './types.ts'
import type { PipelineSnapshot, SourceHandle, SourceRegistration } from './types.ts'
export type * from './types.ts'

export interface Config {
  workspacePath: string
  stateDirectory: string
  stageTimeoutMs: number
  historyLimit: number
  contextChars: number
  maxOutputTokens: number
  permissionPreset: string
  models: Volatile<Record<string, { provider: string; model: string }>>
}

declare module '@deepseek-ai/cordis' { interface Context { laiPipeline: LaiPipeline } }

export default class LaiPipeline extends Service {
  static inject = ['laiAgents', 'subagents', 'agents', 'sessions', 'agentPresets', 'agentDefaultModel', 'permissionPresets', 'sessionTitle', 'workspaceRegistry', 'systemPrompt', 'webServer', 'connection']
  static Config: z<Config> = z.object({
    workspacePath: z.string().required(), stateDirectory: z.string().required(),
    stageTimeoutMs: z.number().step(1).min(1000).max(2147483647).default(300000),
    historyLimit: z.number().step(1).min(1).max(500).default(50),
    contextChars: z.number().step(1).min(1000).max(256000).default(8000),
    maxOutputTokens: z.number().step(1).min(256).max(65536).default(4096),
    permissionPreset: z.string().default('workspace-write'),
    models: z.dict(z.object({ provider: z.string().min(1).required(), model: z.string().min(1).required() })).default({}).volatile(),
  }) as z<Config>
  private readonly engine: PipelineEngine
  private readonly driver: DshPipelineDriver
  constructor(ctx: Context, readonly config: Config) {
    super(ctx, 'laiPipeline')
    if (!isAbsolute(config.workspacePath) || !isAbsolute(config.stateDirectory)) throw new Error('Pipeline workspacePath and stateDirectory must be absolute paths.')
    this.driver = new DshPipelineDriver(ctx, config)
    this.engine = new PipelineEngine(this.driver, new FilePipelineStore(config.stateDirectory, config.workspacePath), config.workspacePath, config.historyLimit)
    ctx.inject(['settings'], child => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
  }
  protected async [Service.init](): Promise<void> {
    await this.ctx.effect(async () => {
      try { await this.engine.initialize() } catch (error) { await this.driver.dispose(); throw error }
      return () => this.engine.dispose()
    }, 'LAI pipeline orchestrator')
    this.ctx.effect(() => this.ctx.webServer.register({
      kind: 'prefix', path: '/lai-api/pipeline',
      handler: async (req, res) => {
        const rejection = this.ctx.connection.requestRejection(req)
        if (rejection !== undefined) { res.writeHead(rejection); res.end(); return }
        const send = (status: number, value: unknown): void => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)) }
        const path = new URL(req.url ?? '/', 'http://localhost').pathname
        try {
          if (req.method === 'GET' && path === '/lai-api/pipeline') { send(200, this.snapshot()); return }
          if (req.method !== 'POST') { send(405, { error: 'Use GET for status or POST for pipeline actions.' }); return }
          let size = 0
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            size += bytes.length
            if (size > 16384) { send(413, { error: 'Pipeline action body exceeds 16 KiB.' }); return }
            chunks.push(bytes)
          }
          const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PipelineError('INVALID_EVENT', 'The action body must be an object.')
          if (path === '/lai-api/pipeline/simulate' && 'sourceId' in body && typeof body.sourceId === 'string' && 'caseId' in body && typeof body.caseId === 'string') {
            send(202, await this.engine.simulate(body.sourceId, body.caseId)); return
          }
          if (path === '/lai-api/pipeline/cancel' && 'runId' in body && typeof body.runId === 'string') { await this.engine.cancel(body.runId); send(200, { cancelled: true }); return }
          send(400, { error: 'Unknown pipeline action or missing action fields.' })
        } catch (error) {
          const status = error instanceof PipelineError ? error.code === 'BUSY' ? 409 : error.code === 'NOT_READY' || error.code === 'PERSISTENCE' ? 503 : 400 : error instanceof SyntaxError ? 400 : 500
          send(status, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'authenticated pipeline UI API')
  }
  /** Return current worker, source and run state. */
  snapshot(): PipelineSnapshot { return this.engine.snapshot() }
  /** Register a source; accepted executions remain owned by the pipeline after source disposal. */
  registerSource(source: SourceRegistration): SourceHandle { return this.engine.registerSource(source) }
}
