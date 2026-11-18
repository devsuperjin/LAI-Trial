import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Include from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import type { LoadResult, ModuleJob, ModuleLoaderV2, ResolveResult } from '@deepseek-ai/cordis-plugin-loader'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { afterEach, describe, expect, it } from 'vitest'
import * as PromptSections from '../src/index.ts'

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
  it('applies YAML-configured sections to the live prompt assembly', { timeout: 60_000 }, async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-prompt-sections-loader-'))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      '- name: fixture-system-prompt',
      "- name: '@lai/dsh-prompt-sections'",
      '  config:',
      '    sections:',
      '      - name: deployment-rule',
      '        order: 10',
      '        text: LOADER INJECTED RULE',
      '    contexts: []',
      '',
    ].join('\n'))

    const systemPromptRow = {
      name: 'fixture-system-prompt',
      async apply(ctx: Context) {
        await ctx.plugin(SystemPrompt, {})
      },
    }

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['fixture-system-prompt', systemPromptRow],
      ['@lai/dsh-prompt-sections', PromptSections],
    ])
    context.loader.internal = stubModuleLoader(modules)
    await context.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await context.loader.await()
    expect([...context.loader.entries()].filter(entry => entry.fiber === undefined && !entry.disabled)).toEqual([])
    expect(renderPrompt(await context.systemPrompt.assemble())).toContain('LOADER INJECTED RULE')
  })
})
