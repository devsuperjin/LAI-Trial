import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { key, type Thread, type Trigger } from '../src/core/index.ts'
import { HealthBoard } from '../src/infra/health.ts'
import { JenkinsClient, JenkinsConfigSchema, type JenkinsBuild, type JenkinsConfig } from '../src/infra/jenkins.ts'
import { KV } from '../src/kv.ts'
import { SettingsSchema, settingsPolicy } from '../src/policy.ts'
import { SourceRegistry } from '../src/sources/registry.ts'
import { apply, buildThread, failureTrigger, jenkinsKind, logTail, pollFailure, pollRound, watch } from '../src/sources/jenkins.ts'
import { sourceContextOf, type SourceContextDeps } from '../src/app/source-context.ts'
import { Store } from '../src/app/store.ts'
import type { Commands } from '../src/infra/commands.ts'
import { testDeployment } from './fixtures/deployment.ts'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  vi.unstubAllGlobals(); vi.useRealTimers()
})

/** The fake Jenkins answers with `handler`; the requests it received are returned in order. */
function jenkins(handler: (request: { url: URL; accept: string; authorization: string }) => Response | Promise<Response>) {
  const requests: { url: URL; accept: string; authorization: string }[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const request = { url: new URL(String(input)), accept: headers.get('accept') ?? '', authorization: headers.get('authorization') ?? '' }
    requests.push(request)
    return handler(request)
  }))
  return requests
}

/** A Source host over a real Store, registry, and health board, with a receive that deduplicates by Trigger ID. */
function makeHost(options: { configured?: boolean; config?: Record<string, unknown> | false; ready?: Promise<void> } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'jenkins-'))
  const store = new Store(join(directory, 'db.sqlite'))
  const jenkins = options.config === false ? { enabled: false, config: {} } : { enabled: true, config: options.config ?? {} }
  store.saveSettings(SettingsSchema.parse({ sources: { jenkins } }))
  const board = new HealthBoard()
  const sources = new SourceRegistry(() => store.settings(), board)
  sources.register(jenkinsKind)
  const received: Trigger[] = []
  const stored = new Set<string>()
  const deps: SourceContextDeps = { store, outbox: { send: () => {} }, engine: { bindThread: () => {}, threadClosed: () => {} } as never,
    commands: {} as Commands, sources, deployment: testDeployment(), ready: options.ready ?? Promise.resolve(),
    configured: () => options.configured ?? true,
    receive: trigger => {
      received.push(trigger)
      if (stored.has(trigger.id)) return 'duplicate'
      stored.add(trigger.id)
      return 'stored'
    } }
  const ctx = sourceContextOf(deps, jenkinsKind)
  cleanups.push(() => { store.close(); rmSync(directory, { recursive: true, force: true }) })
  return { store, sources, board, ctx, received }
}

const job = 'failure-unit-test'
const urlOf = (name: string, number: number): string => `http://127.0.0.1:8080/job/${name.split('/').map(segment => encodeURIComponent(segment)).join('/job/')}/${number}/`
/** A Jenkins job listing answer; folder classes descend into their children. */
const jobList = (...jobs: { name: string; _class?: string }[]) =>
  Response.json({ jobs: jobs.map(entry => ({ _class: 'org.jenkinsci.plugins.workflow.job.WorkflowJob', ...entry })) })
/** A failed build as Jenkins' builds tree reports it, with branch, commit and stage in its description. */
const raw = (number: number, at: string, overrides: Record<string, unknown> = {}) => ({
  number, result: 'FAILURE', timestamp: Date.parse(at), description: `branch=main commit=c0ffee${number} stage=Test`, building: false,
  actions: [{ causes: [{ shortDescription: 'Started by user anonymous' }] }], ...overrides,
})
/** A failed build as the Source normalizes it. */
const build = (number: number, at = new Date().toISOString(), overrides: Partial<JenkinsBuild> = {}): JenkinsBuild => ({
  job, number, branch: 'main', commit: `c0ffee${number}`, stage: 'Test', at, status: 'FAILURE',
  url: urlOf(job, number), logUrl: `${urlOf(job, number)}consoleText`, rerunCount: 0, ...overrides,
})
const emptyThread = (number = 1): Thread => ({ key: buildThread(job, number), ref: { source: 'jenkins', id: `build:${job}#${number}` }, createdAt: '',
  subscriptions: [], correlated: [], pending: [], meta: {} })
/** `cursorAt` for the assertions below, kept local to name its overlap. */
const cursorAtOf = (at: string): string => new Date(Date.parse(at) - 5000).toISOString()

describe('jenkins remote API client', () => {
  it('fills the polling defaults and rejects unknown settings', () => {
    expect(JenkinsConfigSchema.parse({})).toEqual({
      url: 'http://127.0.0.1:8080', user: '', token: '', jobs: [], pollSeconds: 15, scanBuilds: 200, maxFailures: 20,
      failuresBeforeError: 3, logTailChars: 4000,
    })
    expect(() => JenkinsConfigSchema.parse({ pollSeconds: 1 })).toThrow()
    expect(() => JenkinsConfigSchema.parse({ unknown: true })).toThrow()
    expect(() => JenkinsConfigSchema.parse({ jobs: [{ other: 'x' }] })).toThrow()
  })
  it('discovers jobs through folders, selects new finished failures, and reads metadata and logs', async () => {
    const now = Date.now()
    const recent = new Date(now - 60_000).toISOString()
    const older = new Date(now - 2 * 3600_000).toISOString()
    const before = new Date(now - 5 * 3600_000).toISOString()
    const since = new Date(now - 4 * 3600_000).toISOString()
    const builds = [
      raw(1, older),
      raw(2, recent, { result: 'SUCCESS' }),
      raw(3, recent, { building: true }),
      raw(4, recent, { actions: [{ causes: [{ shortDescription: 'Replayed #1' }] }] }),
      raw(5, before),
    ]
    const service = raw(2, recent, { description: null, actions: [{ parameters: [
      { name: 'GIT_BRANCH', value: 'release' }, { name: 'GIT_COMMIT', value: 'abc123' }] }] })
    const requests = jenkins(request => {
      if (request.url.pathname === '/api/json') {
        return jobList({ name: 'team', _class: 'com.cloudbees.hudson.plugins.folder.Folder' }, { name: job })
      }
      if (request.url.pathname === '/job/team/api/json') return jobList({ name: 'service' })
      if (request.url.pathname === '/job/team/job/service/api/json') return Response.json({ builds: [service] })
      if (request.url.pathname === `/job/${job}/api/json`) return Response.json({ builds })
      if (request.url.pathname === '/job/team/job/service/2/consoleText') {
        return new Response('start\n[Pipeline] { (Integration tests)\nboom', { status: 200 })
      }
      if (request.url.pathname === `/job/${job}/1/consoleText`) return new Response('line one\nline two', { status: 200 })
      return new Response('no such build', { status: 404 })
    })
    const config = JenkinsConfigSchema.parse({ url: 'http://jenkins.example' })
    const client = new JenkinsClient(config)
    expect(await client.failures(since, config)).toEqual([
      { job, number: 1, branch: 'main', commit: 'c0ffee1', stage: 'Test', at: older, status: 'FAILURE',
        url: 'http://jenkins.example/job/failure-unit-test/1/', logUrl: 'http://jenkins.example/job/failure-unit-test/1/consoleText', rerunCount: 1 },
      { job: 'team/service', number: 2, branch: 'release', commit: 'abc123', stage: 'Integration tests', at: recent, status: 'FAILURE',
        url: 'http://jenkins.example/job/team/job/service/2/', logUrl: 'http://jenkins.example/job/team/job/service/2/consoleText', rerunCount: 0 },
    ])
    // The folder job's stage came from its console; the other build's description needed no log read.
    expect(requests.some(request => request.url.pathname === `/job/${job}/1/consoleText`)).toBe(false)
    // A cap keeps the oldest failures for this round.
    expect(await client.failures(since, { ...config, maxFailures: 1 })).toHaveLength(1)
    expect(await client.log(job, 1)).toBe('line one\nline two')
    expect(requests.at(-1)!.accept).toBe('text/plain')
    expect(requests.at(-1)!.url.pathname).toBe(`/job/${job}/1/consoleText`)
  })
  it('authenticates with a user and API token, and names Jenkins errors', async () => {
    const requests = jenkins(() => Response.json({ jobs: [] }))
    const client = new JenkinsClient(JenkinsConfigSchema.parse({ user: 'ci', token: 'secret' }))
    expect(await client.jobs()).toEqual([])
    expect(requests[0]!.authorization).toBe(`Basic ${Buffer.from('ci:secret').toString('base64')}`)

    const unauthorized = jenkins(() => Response.json({ error: 'unauthorized' }, { status: 401 }))
    await expect(new JenkinsClient(JenkinsConfigSchema.parse({})).jobs())
      .rejects.toMatchObject({ name: 'JenkinsError', message: 'unauthorized', status: 401 })
    expect(unauthorized).toHaveLength(1)

    jenkins(request => request.url.pathname === '/api/json' ? jobList({ name: job }) : Response.json({ builds: [] }))
    await expect(new JenkinsClient(JenkinsConfigSchema.parse({})).failures(new Date().toISOString(), { jobs: [{ id: 'missing' }], maxFailures: 20 }))
      .rejects.toMatchObject({ name: 'JenkinsError', message: 'Jenkins job not found: missing' })
  })
})

describe('jenkins source', () => {
  it('maps a failure into one senderless Trigger with a stable ID and the end of its log', () => {
    const failure = build(7, '2026-11-19T10:07:00.000Z', { rerunCount: 2 })
    const trigger = failureTrigger(failure, '…the last line')
    expect(trigger).toEqual({
      id: key('jenkins-failure', failure.job, '7'), source: 'jenkins',
      threads: [{ source: 'jenkins', id: `build:${failure.job}#7` }], actor: { source: 'jenkins', id: '' }, human: false,
      at: failure.at, text: expect.stringContaining(`Jenkins CI failure: ${failure.job} #7`), url: failure.url,
      meta: { jenkins: true, event: 'ci_failure', job: failure.job, number: 7, branch: 'main', commit: failure.commit, stage: 'Test',
        url: failure.url, logUrl: failure.logUrl, rerunCount: 2 },
    })
    expect(trigger.text).toContain('Recent build log:\n…the last line')
    // A repeated poll and the cursor's overlap produce the same ID, so the Engine keeps the Trigger once.
    expect(failureTrigger({ ...failure, at: '2026-11-20T00:00:00.000Z' }).id).toBe(trigger.id)
    expect(failureTrigger(failure).text).not.toContain('Recent build log')
    expect(buildThread(failure.job, 7)).toBe(`jenkins:build:${failure.job}#7`)
    expect(logTail('0123456789', 4)).toBe('…6789')
    expect(logTail('0123', 4)).toBe('0123')
    expect(logTail('0123456789', 0)).toBe('0123456789')
  })
  it('settles CI failures as its failures row, for its own metadata only', () => {
    const config = JenkinsConfigSchema.parse({})
    expect(jenkinsKind.scope!({ meta: { jenkins: true, event: 'ci_failure' } }, config)).toEqual({ listened: true, observed: true, row: 'failures' })
    expect(jenkinsKind.scope!({ meta: { jenkins: false, event: 'ci_failure' } }, config)).toEqual({ listened: false, reason: 'not_a_ci_failure' })
    expect(jenkinsKind.scope!({ meta: { jenkins: true, event: 'ci_success' } }, config)).toEqual({ listened: false, reason: 'not_a_ci_failure' })
  })
  it('admits a failure as an inferred candidate under the default Policy, which Eval observes', () => {
    const host = makeHost()
    const settings = host.store.settings()
    expect(settings.eval.mode).toBe('observe')
    expect(settingsPolicy(settings, host.sources).gate(failureTrigger(build(3)), emptyThread(3), []))
      .toMatchObject({ admissible: true, strength: 'inferred',
        basis: { via: 'admission', row: 'failures', cell: 'unlistedUnaddressed', observation: { mode: 'observe' } } })
    // A Policy that names only other Sources ignores failures until its row admits them.
    const strict = SettingsSchema.parse({ policy: { sources: {} }, sources: { jenkins: { enabled: true } } })
    const registry = new SourceRegistry(() => strict)
    registry.register(jenkinsKind)
    expect(settingsPolicy(strict, registry).gate(failureTrigger(build(3)), emptyThread(3), []))
      .toEqual({ admissible: false, reason: 'admission_ignored' })
  })
})

describe('jenkins polling', () => {
  it('receives each failure once with a bounded log tail and advances the cursor over the newest one', async () => {
    const now = Date.now()
    const firstAt = new Date(now - 10 * 60_000).toISOString()
    const secondAt = new Date(now - 5 * 60_000).toISOString()
    const thirdAt = new Date(now - 60_000).toISOString()
    const first = raw(1, firstAt)
    const second = raw(2, secondAt)
    const third = raw(3, thirdAt)
    const old = raw(9, new Date(now - 25 * 3600_000).toISOString())
    let builds = [old, first, second]
    const requests = jenkins(request => {
      if (request.url.pathname === '/api/json') return jobList({ name: job })
      if (request.url.pathname === `/job/${job}/api/json`) return Response.json({ builds })
      if (request.url.pathname === `/job/${job}/1/consoleText`) return new Response('0123456789', { status: 200 })
      return new Response('gone', { status: 404 })
    })
    const host = makeHost({ config: { logTailChars: 4 } })
    const config = host.ctx.config<JenkinsConfig>('jenkins')!
    for (const failure of [first, second, third]) {
      host.store.threads.save({ key: buildThread(job, failure.number), ref: { source: 'jenkins', id: `build:${job}#${failure.number}` }, createdAt: '',
        subscriptions: [], correlated: [], pending: [], meta: {} })
    }
    expect(await pollRound(host.ctx, config)).toBe(2)
    // The 25-hour-old failure is outside the initial lookback and never received.
    expect(host.received.map(trigger => trigger.meta.number)).toEqual([1, 2])
    expect(host.received[0]!.text).toContain('Recent build log:\n…6789')
    // A failed log read still receives the failure, with its log URL and no tail.
    expect(host.received[1]!.text).toContain(`${urlOf(job, 2)}consoleText`)
    expect(host.received[1]!.text).not.toContain('Recent build log')
    expect(host.store.get(KV.jenkins.since)).toBe(cursorAtOf(secondAt))
    expect(host.store.threads.get(buildThread(job, 1))!.meta).toMatchObject({ job, number: 1, label: `${job} #1`, url: urlOf(job, 1),
      facts: { stage: { value: 'Test', problem: true }, branch: { value: 'main @ c0ffee1' }, reruns: { value: '0' } } })
    // The next round rereads the cursor's overlap; the received failure is a duplicate and only the new one counts.
    builds = [old, second, third]
    expect(await pollRound(host.ctx, config)).toBe(1)
    expect(requests.filter(request => request.url.pathname === `/job/${job}/api/json`)).toHaveLength(2)
    expect(host.received.map(trigger => trigger.meta.number)).toEqual([1, 2, 2, 3])
    expect(host.store.get(KV.jenkins.since)).toBe(cursorAtOf(thirdAt))
  })
  it('keeps the initial lookback when Jenkins reports no failures', async () => {
    jenkins(request => request.url.pathname === '/api/json' ? jobList({ name: job }) : Response.json({ builds: [] }))
    const host = makeHost()
    expect(await pollRound(host.ctx, JenkinsConfigSchema.parse({}))).toBe(0)
    expect(host.store.get(KV.jenkins.since)).toBeUndefined()
  })
  it('reports polling errors only once the configured number of polls fail in a row', async () => {
    expect(pollFailure(1, 3, new Error('ECONNREFUSED'))).toBeUndefined()
    expect(pollFailure(3, 3, new Error('ECONNREFUSED'))).toMatchObject({ state: 'error', code: 'pollFailures',
      values: { count: '3', error: 'Error: ECONNREFUSED' }, detail: '3 consecutive failed polls; last: Error: ECONNREFUSED' })
  })
})

describe('jenkins watch loop', () => {
  it('waits for setup, pauses while the Source is off, and reports ready after a round', async () => {
    const pending = makeHost({ configured: false })
    await watch(pending.ctx, new AbortController().signal)
    expect(pending.board.all.jenkins).toEqual(expect.objectContaining({ state: 'paused', code: 'setupPending' }))

    const off = makeHost({ config: false })
    const offController = new AbortController()
    const offRun = watch(off.ctx, offController.signal)
    await vi.waitFor(() => expect(off.board.all.jenkins).toMatchObject({ state: 'paused', code: 'sourceOff' }))
    offController.abort(); await offRun

    const failure = raw(4, new Date().toISOString())
    jenkins(request => {
      if (request.url.pathname === '/api/json') return jobList({ name: job })
      if (request.url.pathname === `/job/${job}/api/json`) return Response.json({ builds: [failure] })
      return new Response('log', { status: 200 })
    })
    const ready = makeHost({ config: { pollSeconds: 5 } })
    const readyController = new AbortController()
    const readyRun = watch(ready.ctx, readyController.signal)
    await vi.waitFor(() => expect(ready.board.all.jenkins).toMatchObject({ state: 'ready', detail: '1 new build failure; next poll ≥ 5s' }))
    expect(ready.received).toHaveLength(1)
    readyController.abort(); await readyRun
  })
  it('counts only consecutive failed rounds towards an error', async () => {
    vi.useFakeTimers()
    const host = makeHost({ config: { failuresBeforeError: 2, pollSeconds: 5, logTailChars: 0 } })
    const fetchMock = vi.fn(async () => { throw new Error('ECONNREFUSED') })
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const running = watch(host.ctx, controller.signal)
    const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve() }
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // One failed poll is only retried; it does not replace the registered starting state with an error.
    expect(host.board.all.jenkins).toMatchObject({ state: 'starting' })
    await vi.advanceTimersByTimeAsync(5000)
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(host.board.all.jenkins).toMatchObject({ state: 'error', code: 'pollFailures', values: { count: '2' } })
    controller.abort(); await running
  })
  it('registers its kind as a plugin and turns a failure that escapes the loop into its health', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'jenkins-plugin-'))
    const store = new Store(join(directory, 'db.sqlite'))
    const board = new HealthBoard()
    const sources = new SourceRegistry(() => store.settings(), board)
    const deps: SourceContextDeps = { store, outbox: { send: () => {} }, engine: { bindThread: () => {}, threadClosed: () => {} } as never,
      commands: {} as Commands, sources, deployment: testDeployment(), ready: Promise.reject(new Error('lock held')),
      configured: () => false, receive: () => 'filtered' }
    const host = { sources, context: (kind: { kind: string; health: readonly string[] }) => sourceContextOf(deps, kind) }
    const disposers: (() => unknown)[] = []
    apply({ orchestrator: host, effect: (effect: () => () => unknown) => { disposers.push(effect()) } } as never)
    await vi.waitFor(() => expect(sources.kind('jenkins')).toBe(jenkinsKind))
    await vi.waitFor(() => expect(board.all.jenkins).toMatchObject({ state: 'error', detail: expect.stringContaining('lock held') }))
    for (const dispose of disposers) await dispose()
    expect(sources.kind('jenkins')).toBeUndefined()
    expect(board.all.jenkins).toBeUndefined()
    store.close(); rmSync(directory, { recursive: true, force: true })
  })
})