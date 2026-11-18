import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, access } from 'node:fs/promises'
import { parseDocument } from 'yaml'
import { describe, expect, it } from 'vitest'
const exec = promisify(execFile)
const dump = async (extra: string[] = []) => {
  const result = await exec(process.execPath, ['scripts/run-dsh.mjs', '--dump-config', ...extra], {
    env: { ...process.env, LAI_WORKSPACE: '/tmp/lai-contract-workspace', LAI_PROVIDER: 'mock', LAI_MODEL: 'fixture' }, maxBuffer: 8 * 1024 * 1024,
  })
  const document = parseDocument(result.stdout, { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: (value: string) => value }] })
  expect(document.errors).toEqual([])
  return document.toJS() as { id: string; name?: string; disabled?: boolean; config?: Record<string, unknown> }[]
}

describe('out-of-tree Profile composition through the published CLI', () => {
  it('disables the account settings rows and keeps queue consumers opt-in', async () => {
    const rows = await dump()
    expect(rows.find(r => r.id === 'ui-settings-account')?.disabled).toBe(true)
    expect(rows.find(r => r.id === 'account-controller')?.disabled).toBe(true)
    expect(rows.find(r => r.id === 'web-runtime')?.disabled).toBe(true)
    expect(rows.find(r => r.id === 'lai-web-runtime')?.name).toBe('@lai/dsh-web-app')
    expect(rows.find(r => r.id === 'lai-web-runtime')?.config?.distIndex).toMatch(/app\/lai-web\/dist\/index\.html$/)
    for (const id of ['runtime', 'redis', 'mqtt', 'rabbitmq']) expect(rows.find(r => r.id === `agent-mq-${id}`)?.disabled).toBe(true)
  })
  it.each(['redis', 'mqtt', 'rabbitmq', 'iqe'])('composes the %s overlay without duplicate runtime rows', async (backend) => {
    const rows = await dump(['--patch', `config/development/${backend}.yml`])
    expect(rows.filter(r => r.id === 'agent-mq-runtime')).toHaveLength(1)
    expect(rows.find(r => r.id === 'agent-mq-runtime')?.disabled).toBe(false)
    const enabled = ['redis', 'mqtt', 'rabbitmq'].filter(b => rows.find(r => r.id === `agent-mq-${b}`)?.disabled === false)
    expect(enabled).toEqual([backend === 'iqe' ? 'mqtt' : backend])
    if (backend === 'iqe') {
      expect(rows.find(r => r.id === 'agent-mq-runtime')?.config?.agentPreset).toBe('iqe-orchestrator')
      expect(rows.filter(r => r.id.startsWith('preset-iqe-'))).toHaveLength(7)
    }
  })
  it('accounts for every source diff file and resolves every migrated target', async () => {
    const inventory = JSON.parse(await readFile('docs/migration-inventory.json', 'utf8'))
    expect(inventory.files).toHaveLength(159)
    expect(new Set(inventory.files.map((f: { source: string }) => f.source)).size).toBe(159)
    for (const file of inventory.files) if (file.target) await access(file.target)
    for (const file of inventory.reconstructed) await access(file)
  })
})
