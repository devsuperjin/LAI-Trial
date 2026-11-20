import { expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { validateJsonSchemaValue } from '@deepseek-ai/dsh-tools'
import { Config, apply, createTools, type Credential } from '../src/index.ts'
const credential = (): Credential => ({ description: 'Read-only CI research', service: 'https://ci.example', username: 'fixture-user', token: 'fixture-token-not-real', password: 'fixture-password-not-real', enabled: true, allowedPresets: ['iqe-triage'] })
const execution = (preset?: string): ToolRunContext => ({ signal: new AbortController().signal, ...(preset ? { agent: { session: { header: { agentPreset: preset } } } } : {}) }) as ToolRunContext
it('lists authorized metadata without secret values and retrieves only authorized credentials', async () => {
  const tools = createTools(() => ({ ci: credential() })), list = tools[0]!, get = tools[1]!
  const listed = await list.execute({}, execution('iqe-triage'))
  expect(listed).toEqual({ items: [{ id: 'ci', description: 'Read-only CI research', service: 'https://ci.example', kind: 'generic', canUpdate: false }] })
  expect(JSON.stringify(listed)).not.toContain('fixture-')
  const value = await get.execute({ id: 'ci' }, execution('iqe-triage'))
  expect(value).toMatchObject({ found: true, token: 'fixture-token-not-real', password: 'fixture-password-not-real' })
  expect(validateJsonSchemaValue(get.output.schema, value, 'value')).toEqual([])
  for (const caller of [execution(), execution('iqe-reporting')]) {
    expect(await list.execute({}, caller)).toEqual({ items: [] })
    expect(await get.execute({ id: 'ci' }, caller)).toMatchObject({ found: false })
  }
  expect(await get.execute({ id: '__proto__' }, execution('iqe-triage'))).toMatchObject({ found: false })
})
it('honors live revocation, disabled entries, explicit wildcard grants and cancellation', async () => {
  const entry = credential(), get = createTools(() => ({ ci: entry }))[1]!
  entry.allowedPresets = []
  expect(await get.execute({ id: 'ci' }, execution('iqe-triage'))).toMatchObject({ found: false })
  entry.allowedPresets = ['*']
  expect(await get.execute({ id: 'ci' }, execution('iqe-reporting'))).toMatchObject({ found: true })
  entry.enabled = false
  expect(await get.execute({ id: 'ci' }, execution('iqe-triage'))).toMatchObject({ found: false })
  const exec = execution('iqe-triage'), controller = new AbortController(); controller.abort()
  await expect(get.execute({ id: 'ci' }, { ...exec, signal: controller.signal })).rejects.toThrow()
})
it('marks secret config fields for DSH redaction and owns standard tool registrations', () => {
  const entry = Config.dict!.entries!.inner!
  for (const key of ['username', 'token', 'password']) expect(entry.dict![key]!.meta.role).toBe('secret')
  const remove = vi.fn(), register = vi.fn(() => remove), cleanups: (() => void)[] = []
  const ctx = { tools: { register }, effect: (factory: () => () => void) => cleanups.push(factory()), inject: vi.fn() } as unknown as Context
  apply(ctx, { entries: { get: () => ({}) } } as never)
  expect(register.mock.calls.map(([tool]) => tool.name)).toEqual(['credentials_list', 'credentials_get', 'credentials_update'])
  cleanups.forEach(cleanup => cleanup()); expect(remove).toHaveBeenCalledTimes(3)
})
