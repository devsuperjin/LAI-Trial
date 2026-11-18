import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, access, mkdtemp, rm } from 'node:fs/promises'
import { parseDocument } from 'yaml'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
const exec = promisify(execFile)
const isolatedHome = await mkdtemp(join(tmpdir(), 'lai-composition-'))
afterAll(async () => { await rm(isolatedHome, { recursive: true, force: true }) })
const dump = async (extra: string[] = []) => {
  const result = await exec(process.execPath, ['scripts/run-dsh.mjs', '--dump-config', ...extra], {
    env: { ...process.env, LAI_DSH_HOME: isolatedHome, LAI_WORKSPACE: '/tmp/lai-contract-workspace', LAI_PROVIDER: 'mock', LAI_MODEL: 'fixture' }, maxBuffer: 8 * 1024 * 1024,
  })
  const document = parseDocument(result.stdout, { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value: string) => value }] })
  expect(document.errors).toEqual([])
  return document.toJS() as { id: string; name?: string; disabled?: boolean; config?: Record<string, unknown> }[]
}

describe('out-of-tree Profile composition through the published CLI', () => {
  it('composes LAI subagents, pipeline and simulator without a broker', async () => {
    const rows = await dump()
    expect(rows.find(r => r.id === 'ui-settings-account')?.disabled).toBe(true)
    expect(rows.find(r => r.id === 'account-controller')?.disabled).toBe(true)
    expect(rows.find(r => r.id === 'web-runtime')?.disabled).toBe(true)
    expect(rows.find(r => r.id === 'lai-web-runtime')?.name).toBe('@lai/dsh-web-host')
    expect(rows.find(r => r.id === 'lai-web-runtime')?.config?.distIndex).toBe('process.env.LAI_WEB_DIST_INDEX')
    expect(rows.some(r => r.id.startsWith('agent-mq-'))).toBe(false)
    expect(rows.find(r => r.id === 'lai-pipeline')?.name).toBe('@lai/lai-pipeline')
    expect(rows.find(r => r.id === 'pipeline-simulator')?.name).toBe('@lai/pipeline-simulator')
    expect(rows.find(r => r.id === 'lai-agents')?.name).toBe('@lai/lai-agents')
  })
  it('accounts for every source diff file and resolves every migrated target', async () => {
    const inventory = JSON.parse(await readFile('docs/migration-inventory.json', 'utf8'))
    expect(inventory.files).toHaveLength(159)
    expect(new Set(inventory.files.map((f: { source: string }) => f.source)).size).toBe(159)
    for (const file of inventory.files) if (file.target) await access(file.target)
    for (const file of inventory.reconstructed) await access(file)
  })
})

it('migrates copied application defaults without losing provider settings', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises')
  const migrationHome = await mkdtemp(join(tmpdir(), 'lai-profile-migration-'))
  const profile = join(migrationHome, 'profiles/lai')
  try {
    await mkdir(profile, { recursive: true })
    await writeFile(join(profile, 'package.json'), JSON.stringify({ name: 'lai-profile', dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@lai/dsh-agent-mq-bundle'] } } }))
    await writeFile(join(profile, 'cordis.patch.yml'), [
      '- id: web-runtime', '  disabled: true', '- insert:', '    - id: lai-web-runtime', "      name: '@lai/dsh-web-app'",
      '- id: llm-pi-ai', '  config:', '    providers:', '      retained-gateway:', '        displayName: Retained gateway', '        apiKeyEnv: LAI_RETAINED_KEY',
    ].join('\n'))
    const invocation = () => exec(process.execPath, ['scripts/run-dsh.mjs', '--dump-config'], { env: { ...process.env, LAI_DSH_HOME: migrationHome }, maxBuffer: 8 * 1024 * 1024 })
    const result = await invocation()
    expect(result.stderr).not.toContain('name mismatch')
    expect(result.stdout).toContain('@lai/dsh-web-host')
    expect(result.stdout).toContain('@lai/lai-agents')
    const patch = await readFile(join(profile, 'cordis.patch.yml'), 'utf8')
    expect(patch).toContain('retained-gateway')
    expect(patch).toContain('LAI_RETAINED_KEY')
    expect(patch).not.toContain('lai-web-runtime')
    await access(join(profile, 'cordis.patch.before-app-bundle.yml'))
    await invocation()
    expect(await readFile(join(profile, 'cordis.patch.yml'), 'utf8')).toBe(patch)
  } finally { await rm(migrationHome, { recursive: true, force: true }) }
})
