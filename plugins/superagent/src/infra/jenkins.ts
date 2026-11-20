/**
 * HTTP client for Jenkins' own remote API, used by the Jenkins Source.
 * The Source reads Jenkins directly; `user` and `token` stay empty on instances that allow anonymous read.
 */
import { z } from 'zod'

export const JenkinsConfigSchema = z.object({
  url: z.string().url().default('http://127.0.0.1:8080'),
  /** Basic-auth credentials; both empty reads Jenkins anonymously. */
  user: z.string().trim().max(200).default(''),
  token: z.string().max(4000).default(''),
  /** Full job names to scan (`team/service`); empty scans every job Jenkins exposes. */
  jobs: z.array(z.object({ id: z.string().trim().min(1).max(500) }).strict()).max(200).default([]),
  pollSeconds: z.number().int().min(5).max(3600).default(15),
  /** Builds read per job; the failure scan is bounded to this recent history. */
  scanBuilds: z.number().int().min(1).max(1000).default(200),
  /** Failures received in one poll; the rest wait for the next round. */
  maxFailures: z.number().int().min(1).max(100).default(20),
  failuresBeforeError: z.number().int().min(1).max(20).default(3),
  /** Characters of the failed build's console text appended to its Trigger; 0 keeps only the log URL. */
  logTailChars: z.number().int().min(0).max(20000).default(4000),
}).strict()
export type JenkinsConfig = z.infer<typeof JenkinsConfigSchema>

/** One failed build as Jenkins reports it, normalized for the Source. */
export interface JenkinsBuild {
  job: string; number: number; branch: string; commit: string; stage: string; at: string; status: string
  url: string; logUrl: string; rerunCount: number
}

const JobListSchema = z.looseObject({ jobs: z.array(z.looseObject({ name: z.string(), _class: z.string().default('') })).default([]) })
const CauseSchema = z.looseObject({ shortDescription: z.string().default('') })
const ActionSchema = z.looseObject({
  causes: z.array(CauseSchema).default([]),
  parameters: z.array(z.looseObject({ name: z.string(), value: z.unknown() })).default([]),
  lastBuiltRevision: z.looseObject({ SHA1: z.string().optional(), branch: z.array(z.looseObject({ name: z.string() })).optional() }).optional(),
})
const RawBuildSchema = z.looseObject({
  number: z.number().int().positive(),
  result: z.string().nullish(),
  timestamp: z.number().int().nonnegative().default(0),
  description: z.string().nullish(),
  building: z.boolean().default(false),
  actions: z.array(ActionSchema).default([]),
})
export type RawBuild = z.infer<typeof RawBuildSchema>
const BuildListSchema = z.looseObject({ builds: z.array(RawBuildSchema).default([]) })
const BUILD_TREE = 'number,result,timestamp,description,building,actions[causes[shortDescription],parameters[name,value],lastBuiltRevision[SHA1,branch[name]]]'
const ERROR_CHARS = 600
const TIMEOUT_MS = 20_000

/** A non-success HTTP answer from Jenkins; `status` is the HTTP status. */
export class JenkinsError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'JenkinsError' }
}

/** The URL path of a job, including its folder segments. */
export const jobPath = (job: string): string => job.split('/').filter(Boolean).map(segment => `/job/${encodeURIComponent(segment)}`).join('')

/** The number of the build a replay build re-runs, or `null` for an ordinary build. */
export function replayOf(build: RawBuild): number | null {
  for (const action of build.actions) {
    for (const cause of action.causes) {
      const match = /^Replayed #(\d+)$/.exec(cause.shortDescription)
      if (match) return Number(match[1])
    }
  }
  return null
}

/** Reads the `key=value` tokens of a build description, which may carry branch, commit and stage. */
export function descriptionFields(description: string): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const token of description.split(/\s+/)) {
    const separator = token.indexOf('=')
    if (separator <= 0) continue
    try { fields[token.slice(0, separator)] = decodeURIComponent(token.slice(separator + 1)) } catch { fields[token.slice(0, separator)] = token.slice(separator + 1) }
  }
  return fields
}

function parameterText(value: unknown): string | undefined {
  const text = value === undefined || value === null ? '' : String(value).trim()
  return text || undefined
}

/** Branch and commit from build parameters or the last built revision. */
function actionMetadata(build: RawBuild): { branch?: string; commit?: string } {
  let branch: string | undefined
  let commit: string | undefined
  for (const action of build.actions) {
    for (const parameter of action.parameters) {
      const name = parameter.name.toUpperCase()
      if (!branch && ['BRANCH_NAME', 'GIT_BRANCH', 'BRANCH'].includes(name)) branch = parameterText(parameter.value)
      if (!commit && ['COMMIT', 'GIT_COMMIT', 'SHA'].includes(name)) commit = parameterText(parameter.value)
    }
    const revision = action.lastBuiltRevision
    if (!commit && revision?.SHA1) commit = revision.SHA1
    if (!branch && revision?.branch?.[0]?.name) branch = revision.branch[0].name.replace(/^refs\/heads\//, '')
  }
  return { ...(branch ? { branch } : {}), ...(commit ? { commit } : {}) }
}

/**
 * Reads one Jenkins instance through its remote API: job discovery, recent builds, and console text.
 * Each client caches its reads for one poll round, so metadata and the log tail share a console read.
 */
export class JenkinsClient {
  private readonly base: string
  private readonly authorization: string | undefined
  private readonly scanBuilds: number
  private listing: Promise<string[]> | undefined
  private readonly buildLists = new Map<string, Promise<RawBuild[]>>()
  private readonly logs = new Map<string, string>()
  private readonly metadata = new Map<string, { branch: string; commit: string; stage: string }>()
  constructor(config: Pick<JenkinsConfig, 'url' | 'user' | 'token' | 'scanBuilds'>, private readonly signal?: AbortSignal) {
    this.base = config.url.replace(/\/+$/, '')
    this.authorization = config.user ? `Basic ${Buffer.from(`${config.user}:${config.token}`).toString('base64')}` : undefined
    this.scanBuilds = config.scanBuilds
  }
  private async request(path: string, init?: RequestInit): Promise<Response> {
    const timeout = AbortSignal.timeout(TIMEOUT_MS)
    const signal = this.signal ? AbortSignal.any([this.signal, timeout]) : timeout
    const headers: Record<string, string> = { accept: 'application/json', ...init?.headers as Record<string, string> | undefined }
    if (this.authorization) headers.authorization = this.authorization
    return fetch(`${this.base}${path}`, { ...init, signal, headers })
  }
  private async failed(response: Response): Promise<JenkinsError> {
    const body = await response.text().catch(() => '')
    let detail = body
    try { detail = String((JSON.parse(body) as { error?: unknown }).error ?? body) } catch { /* Plain text or HTML. */ }
    return new JenkinsError(detail.trim().slice(0, ERROR_CHARS) || `Jenkins answered HTTP ${response.status}`, response.status)
  }
  /** Every leaf job, recursing through folders and multibranch projects. */
  async jobs(): Promise<string[]> {
    this.listing ??= this.discover('', 0).catch(error => { this.listing = undefined; throw error })
    return this.listing
  }
  private async discover(prefix: string, depth: number): Promise<string[]> {
    if (depth > 5) return []
    const response = await this.request(`${jobPath(prefix)}/api/json?tree=${encodeURIComponent('jobs[name,_class]')}`)
    if (!response.ok) {
      if (!prefix) throw await this.failed(response)
      return []
    }
    const data = JobListSchema.parse(await response.json())
    const names: string[] = []
    for (const job of data.jobs) {
      const full = prefix ? `${prefix}/${job.name}` : job.name
      if (/Folder|MultiBranch/.test(job._class)) names.push(...await this.discover(full, depth + 1))
      else names.push(full)
    }
    return names
  }
  private buildsOf(job: string): Promise<RawBuild[]> {
    let builds = this.buildLists.get(job)
    if (!builds) {
      builds = this.readBuilds(job)
      this.buildLists.set(job, builds)
    }
    return builds
  }
  private async readBuilds(job: string): Promise<RawBuild[]> {
    const tree = `builds[${BUILD_TREE}]{0,${this.scanBuilds}}`
    const response = await this.request(`${jobPath(job)}/api/json?tree=${encodeURIComponent(tree)}`)
    if (!response.ok) throw await this.failed(response)
    return BuildListSchema.parse(await response.json()).builds
  }
  /** Failed, finished, non-replay builds at or after `since`, oldest first and capped at `maxFailures`. */
  async failures(since: string, config: Pick<JenkinsConfig, 'jobs' | 'maxFailures'>): Promise<JenkinsBuild[]> {
    const sinceMs = Date.parse(since)
    if (!Number.isFinite(sinceMs)) throw new JenkinsError(`invalid since timestamp: ${since}`)
    const discovered = await this.jobs()
    const wanted = config.jobs.map(job => job.id)
    const missing = wanted.filter(name => !discovered.includes(name))
    if (missing.length) throw new JenkinsError(`Jenkins job not found: ${missing.join(', ')}`)
    const selected = wanted.length ? discovered.filter(name => wanted.includes(name)) : discovered
    const failures: { job: string; build: RawBuild; rerunCount: number }[] = []
    let firstError: unknown
    let failedJobs = 0
    for (const job of selected) {
      try {
        const builds = await this.buildsOf(job)
        for (const build of builds) {
          if (build.building || build.result !== 'FAILURE' || replayOf(build) !== null || build.timestamp <= sinceMs) continue
          failures.push({ job, build, rerunCount: builds.filter(other => other.number !== build.number && replayOf(other) === build.number).length })
        }
      } catch (error) {
        firstError ??= error
        failedJobs += 1
      }
    }
    // One unreadable job should not hide the others; a poll where every job failed reports the first error.
    if (selected.length > 0 && failedJobs === selected.length) throw firstError
    failures.sort((left, right) => left.build.timestamp - right.build.timestamp)
    return Promise.all(failures.slice(0, config.maxFailures)
      .map(({ job, build, rerunCount }) => this.summary(job, build, rerunCount)))
  }
  private async summary(job: string, build: RawBuild, rerunCount: number): Promise<JenkinsBuild> {
    const metadata = await this.metadataFor(job, build)
    const url = `${this.base}${jobPath(job)}/${build.number}/`
    return {
      job, number: build.number, ...metadata, at: new Date(build.timestamp).toISOString(), status: build.result ?? 'FAILURE',
      url, logUrl: `${url}consoleText`, rerunCount,
    }
  }
  private async metadataFor(job: string, build: RawBuild): Promise<{ branch: string; commit: string; stage: string }> {
    const key = `${job}#${build.number}`
    const cached = this.metadata.get(key)
    if (cached) return cached
    const described = descriptionFields(build.description ?? '')
    const fromActions = actionMetadata(build)
    const metadata = {
      branch: described.branch ?? fromActions.branch ?? 'unknown',
      commit: described.commit ?? fromActions.commit ?? 'unknown',
      stage: described.stage ?? await this.stageFromLog(job, build.number),
    }
    this.metadata.set(key, metadata)
    return metadata
  }
  /** The last pipeline stage the build entered; unknown when the console cannot be read or names no stage. */
  private async stageFromLog(job: string, number: number): Promise<string> {
    try {
      const text = await this.log(job, number)
      const stages = [...text.matchAll(/^\[Pipeline\] \{ \((.+?)\)\s*$/gm)]
      return stages.at(-1)?.[1] ?? 'unknown'
    } catch {
      return 'unknown'
    }
  }
  /** The build's console text, including any output it logged itself. */
  async log(job: string, number: number): Promise<string> {
    const key = `${job}#${number}`
    const cached = this.logs.get(key)
    if (cached !== undefined) return cached
    const response = await this.request(`${jobPath(job)}/${number}/consoleText`, { headers: { accept: 'text/plain' } })
    if (!response.ok) throw await this.failed(response)
    const text = await response.text()
    this.logs.set(key, text)
    return text
  }
}