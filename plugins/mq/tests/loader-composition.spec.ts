import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { LoadResult, ModuleJob, ModuleLoaderV2, ResolveResult } from '@deepseek-ai/cordis-plugin-loader'
import { afterEach, describe, expect, it } from 'vitest'
import MqRuntime, { MemoryQueueBackend } from '../src/index.ts'

/** A fully typed loader-internals stub whose import serves test fixture modules. */
function stubModuleLoader(modules: ReadonlyMap<string, unknown>): ModuleLoaderV2 {
  const loadCache: ModuleLoaderV2['loadCache'] = Object.assign(new Map<string, Record<string, ModuleJob>>(), {
    get(_url: string, _type?: string): ModuleJob | undefined {
      return undefined
    },
    set(this: ModuleLoaderV2['loadCache'], _url: string, _type?: string, _job?: ModuleJob) {
      return this
    },
  })
  return {
    version: 'v2',
    loadCache,
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
    register(): void {},
    async getOrCreateModuleJob(): Promise<ModuleJob> { throw new Error('unexpected ModuleJob request') },
    resolveSync(): ResolveResult { throw new Error('unexpected resolve request') },
    async load(): Promise<LoadResult> { throw new Error('unexpected load request') },
  }
}

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('real Loader composition', () => {
  it('loads the Service export, dispatches a produced task, and publishes its result', { timeout: 60_000 }, async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-mq-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      '- name: fixture-dependencies',
      "- name: '@lai/dsh-mq'",
      '  config:',
      '    workspacePath: /tmp/mq-loader-fixture',
      '    provider: mock',
      '    model: fixture',
      '- name: fixture-producer',
      '',
    ].join('\n'))

    const backend = new MemoryQueueBackend()
    const dependencies = {
      name: 'fixture-dependencies',
      apply(ctx: Context) {
        for (const service of ['agents', 'sessions', 'workspaceRegistry']) {
          ctx.provide(service as never, {} as never)
        }
      },
    }
    const producer = {
      name: 'fixture-producer',
      inject: ['mqRuntime'],
      apply(ctx: Context) {
        ctx.effect(() => ctx.mqRuntime.registerBackend(backend), 'fixture backend')
        backend.produce({ id: 'loader-task', prompt: 'run' })
      },
    }

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['fixture-dependencies', dependencies],
      ['@lai/dsh-mq', MqRuntime],
      ['fixture-producer', producer],
    ])
    context.loader.internal = stubModuleLoader(modules)
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()
    expect([...context.loader.entries()].filter(entry => entry.fiber === undefined && !entry.disabled)).toEqual([])
    // The stub registry cannot create agents, so the task settles as a failure
    // result; publication itself proves the dispatch path ran end to end.
    const deadline = Date.now() + 10_000
    while (backend.results.length === 0 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    expect(backend.results).toHaveLength(1)
    expect(backend.results[0]!.taskId).toBe('loader-task')
    expect(backend.results[0]!.ok).toBe(false)
  })
})
