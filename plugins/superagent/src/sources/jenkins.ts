/** Jenkins Source: polls failed builds on Jenkins' remote API and receives each one once. */
import type { Context } from '@deepseek-ai/cordis'
import { z } from 'zod'
import { key, type Trigger } from '../core/index.ts'
import { JenkinsClient, JenkinsConfigSchema, type JenkinsBuild, type JenkinsConfig } from '../infra/jenkins.ts'
import { KV } from '../kv.ts'
import { health, sourceContext, type Health, type SourceContext } from './host.ts'
import type { Localized, SourceKind } from './kind.ts'
import { cursorAt, pause } from './poll.ts'

export const SOURCE = 'jenkins'
/** A build's Thread key, shared by every trigger about that build. */
export const buildThread = (job: string, number: number): string => `${SOURCE}:build:${job}#${number}`
/** The first poll looks back far enough to pick up failures that happened before the Source started. */
const LOOKBACK_MS = 24 * 3600_000
/** Jenkins failures have no person or bot sender; only a senderless system event may carry an empty actor id. */
const SYSTEM_ACTOR = { source: SOURCE, id: '' }

export const jenkinsKind: SourceKind<JenkinsConfig> = {
  kind: SOURCE,
  title: { zh: 'Jenkins CI', en: 'Jenkins CI' },
  description: { zh: '通过 Jenkins 远程 API 轮询失败的构建，把每次失败作为一个候选事件交给评估；可附带控制台日志的末尾。',
    en: 'Polls failed builds through the Jenkins remote API and receives each failure once as a candidate event for Eval, optionally with the end of its console log.' },
  schema: JenkinsConfigSchema,
  health: ['jenkins'],
  fields: [
    { key: 'url', type: 'text', pattern: 'https?://.+', label: { zh: 'Jenkins 地址', en: 'Jenkins URL' },
      hint: { zh: 'Jenkins 根地址，例如 http://127.0.0.1:8080；插件直接读取 Jenkins 远程 API。修改后在下一次轮询生效。',
        en: 'The Jenkins root URL, such as http://127.0.0.1:8080; the plugin reads the Jenkins remote API directly. A change applies on the next poll.' } },
    { key: 'user', type: 'text', label: { zh: '用户名（可选）', en: 'User (optional)' },
      hint: { zh: 'Jenkins 允许匿名读取时留空；需要认证时填写用户名。',
        en: 'Leave empty when Jenkins allows anonymous read; otherwise fill in the user name.' } },
    { key: 'token', type: 'text', label: { zh: 'API Token（可选）', en: 'API token (optional)' },
      hint: { zh: '与用户名配套的 API Token（不是登录密码），随设置保存在本地。',
        en: 'The API token that goes with the user (not the login password), stored locally with the settings.' } },
    { key: 'jobs', type: 'rows', advanced: true, label: { zh: '只扫描这些任务', en: 'Only these jobs' },
      hint: { zh: 'Jenkins 中的完整任务名，例如 team/service；留空则扫描 Jenkins 暴露的全部任务。',
        en: 'Full Jenkins job names such as team/service; leave empty to scan every job Jenkins exposes.' },
      columns: [{ key: 'id', type: 'text', label: { zh: '任务名', en: 'Job name' } }] },
    { key: 'pollSeconds', type: 'number', advanced: true, min: 5, max: 3600, label: { zh: '轮询间隔 / 秒', en: 'Polling interval / seconds' },
      hint: { zh: '两次读取失败构建之间的等待时间。', en: 'How long to wait between reads of failed builds.' } },
    { key: 'scanBuilds', type: 'number', advanced: true, min: 1, max: 1000, label: { zh: '每个任务读取的构建数', en: 'Builds read per job' },
      hint: { zh: '每个任务只检查最近的这么多次构建，用来限制一次轮询的读取量。',
        en: 'Only this many recent builds of each job are checked, bounding the reads of one poll.' } },
    { key: 'maxFailures', type: 'number', advanced: true, min: 1, max: 100, label: { zh: '每轮最多接收的失败数', en: 'Failures received per poll' },
      hint: { zh: '超出的失败留到下一轮接收，不会丢失。', en: 'Failures beyond this wait for the next round instead of being lost.' } },
    { key: 'failuresBeforeError', type: 'number', advanced: true, min: 1, max: 20, label: { zh: '连续失败几次后报告异常', en: 'Failed polls before reporting an error' },
      hint: { zh: '单次网络中断会在下一次轮询时自动重试，不必报告。', en: 'A single network interruption is retried on the next poll and need not be reported.' } },
    { key: 'logTailChars', type: 'number', advanced: true, min: 0, max: 20000, label: { zh: '附带的日志字符数', en: 'Log characters attached' },
      hint: { zh: '每次失败时读取该构建的控制台日志，把末尾这么多字符放进事件；0 只保留日志链接。复跑（Replay）次数会单独统计。',
        en: 'Reads the failed build\'s console log and includes this many characters from its end in the event; 0 keeps only the log link. Native replays are counted separately.' } },
  ],
  // The Source sees the whole failure list, so every failure is received and observed.
  scope: ({ meta }) => meta.jenkins === true && meta.event === 'ci_failure'
    ? { listened: true, observed: true, row: 'failures' }
    : { listened: false, reason: 'not_a_ci_failure' },
  policy: {
    schema: z.object({ allowed: z.array(z.object({ id: z.string().trim().min(1).max(200) }).strict()).default([]) }).strict(),
    fields: [{ key: 'allowed', type: 'rows', label: { zh: '能发起工作的 Jenkins 账号', en: 'Jenkins accounts that may originate work' },
      hint: { zh: 'Jenkins 失败事件没有发送人，始终按接收表的“未列出的发送人、未点名智能体”一列处理；这里通常留空。',
        en: 'CI failures have no sender and always use the admission table\'s unlisted, unaddressed cell; this list is normally empty.' },
      columns: [{ key: 'id', type: 'text', label: { zh: '账号', en: 'Account' }, pattern: '[A-Za-z0-9_.\\-]+' }] }],
    explicit: { zh: '名单里的账号在 Jenkins 事件中点名智能体（本来源不产生这类事件）。', en: 'An account on the list mentions the agent in a Jenkins event (this Source produces none).' },
    rows: () => [{ id: 'failures', label: { zh: '失败的构建', en: 'Failed builds' }, note: { zh: '自动接收', en: 'Received automatically' },
      cells: { listedUnaddressed: false, unlistedAddressed: false, unlistedUnaddressed: true } }],
  },
  environment: {
    variables: [
      { key: 'DSH_SUPERAGENT_JENKINS_URL', description: { zh: '这个来源读取的 Jenkins 地址', en: 'The Jenkins URL this Source reads' } },
      { key: 'DSH_SUPERAGENT_JENKINS_JOB', description: { zh: '事件的完整任务名', en: 'The full job name of the event' } },
      { key: 'DSH_SUPERAGENT_JENKINS_BUILD', description: { zh: '事件的构建号', en: 'The build number of the event' } },
    ],
    values: ({ config, trigger }) => ({
      DSH_SUPERAGENT_JENKINS_URL: config.url,
      DSH_SUPERAGENT_JENKINS_JOB: trigger?.source === SOURCE && typeof trigger.meta.job === 'string' ? trigger.meta.job : '',
      DSH_SUPERAGENT_JENKINS_BUILD: trigger?.source === SOURCE && trigger.meta.number !== undefined ? String(trigger.meta.number) : '',
    }),
  },
  facts: (): Record<string, Localized | string> => ({}),
}

/** The newest `chars` characters of a log, marked when part of it was dropped. */
export const logTail = (text: string, chars: number): string => chars > 0 && text.length > chars ? `…${text.slice(-chars)}` : text

/** Builds the Trigger for one failed build; its ID is stable, so repeated polls and cursor overlap never receive it twice. */
export function failureTrigger(build: JenkinsBuild, tail?: string): Trigger {
  const text = [
    `Jenkins CI failure: ${build.job} #${build.number}`,
    `Branch: ${build.branch}; commit: ${build.commit}`,
    `Failed stage: ${build.stage}`,
    `Failed at: ${build.at}`,
    `Reruns: ${build.rerunCount}`,
    `Build: ${build.url}`,
    `Log: ${build.logUrl}`,
    '',
    'The pipeline failed.',
    ...tail ? ['', 'Recent build log:', tail] : [],
  ].join('\n')
  return {
    id: key('jenkins-failure', build.job, String(build.number)),
    source: SOURCE,
    threads: [{ source: SOURCE, id: `build:${build.job}#${build.number}` }],
    actor: { ...SYSTEM_ACTOR },
    human: false,
    at: build.at,
    text,
    url: build.url,
    meta: { jenkins: true, event: 'ci_failure', job: build.job, number: build.number, branch: build.branch, commit: build.commit,
      stage: build.stage, url: build.url, logUrl: build.logUrl, rerunCount: build.rerunCount },
  }
}

export const name = 'dsh-superagent-jenkins'
export const inject = ['orchestrator']
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.orchestrator.sources.register(jenkinsKind), 'jenkins: source kind')
  ctx.effect(() => {
    const source = sourceContext(ctx.orchestrator, jenkinsKind)
    const controller = new AbortController()
    // A rejection escaping the loop would terminate the DSH process; report it as Source health instead.
    const running = watch(source, controller.signal)
      .catch((error: unknown) => { source.report('jenkins', { state: 'error', detail: String(error) }) })
    return async () => { controller.abort(); await running }
  })
}

/** Reports an error health once `failures` consecutive polls fail, so a single network interruption stays quiet. */
export function pollFailure(failures: number, threshold: number, error: unknown): Health | undefined {
  return failures >= threshold ? health('error', 'pollFailures', { count: String(failures), error: String(error) }) : undefined
}

/** Polls Jenkins until the Source stops; setup restarts the plugin once it resolves the deployment. */
export async function watch(ctx: SourceContext, signal: AbortSignal): Promise<void> {
  let failures = 0
  await ctx.ready
  if (!ctx.configured()) { ctx.report('jenkins', health('paused', 'setupPending')); return }
  while (!signal.aborted) {
    const config = ctx.config<JenkinsConfig>(SOURCE)
    let count = 0
    let polled = false
    try {
      if (!config) ctx.report('jenkins', health('paused', 'sourceOff'))
      else if (!config.url) ctx.report('jenkins', health('paused', 'jenkinsUrlUnset'))
      else { count = await pollRound(ctx, config, signal); polled = true }
      failures = 0
    } catch (error) {
      if (signal.aborted) return
      failures += 1
      const failed = pollFailure(failures, config?.failuresBeforeError ?? 1, error)
      if (failed) ctx.report('jenkins', failed)
    }
    if (signal.aborted) return
    if (polled && config) {
      ctx.report('jenkins', { state: 'ready', detail: `${count} new build failure${count === 1 ? '' : 's'}; next poll ≥ ${config.pollSeconds}s`,
        at: new Date().toISOString() })
    }
    await pause((config?.pollSeconds ?? 15) * 1000, signal)
  }
}

/** Reads failures since the stored cursor, receives each once with an optional log tail, and advances the cursor over the newest one it saw. */
export async function pollRound(ctx: SourceContext, config: JenkinsConfig, signal?: AbortSignal): Promise<number> {
  const client = new JenkinsClient(config, signal)
  const since = ctx.state.get(KV.jenkins.since) ?? new Date(Date.now() - LOOKBACK_MS).toISOString()
  const failures = await client.failures(since, config)
  let newest = since
  let count = 0
  for (const build of failures) {
    if (signal?.aborted) return count
    // A failed log read does not fail the round: the Trigger still carries the build and its log URL.
    const tail = config.logTailChars > 0
      ? await client.log(build.job, build.number).then(text => logTail(text, config.logTailChars)).catch(() => undefined)
      : undefined
    if (signal?.aborted) return count
    const result = await ctx.receive(failureTrigger(build, tail))
    if (result === 'stored') count += 1
    describeThread(ctx, build)
    if (build.at > newest) newest = build.at
  }
  if (newest !== since) ctx.state.set(KV.jenkins.since, cursorAt(newest))
  return count
}

function describeThread(ctx: SourceContext, build: JenkinsBuild): void {
  ctx.threads.patch(buildThread(build.job, build.number), { job: build.job, number: build.number })
  ctx.threads.describe(buildThread(build.job, build.number), {
    label: `${build.job} #${build.number}`,
    url: build.url,
    facts: {
      build: { label: { zh: '构建', en: 'Build' }, value: `${build.job} #${build.number}`, problem: true },
      branch: { label: { zh: '分支', en: 'Branch' }, value: `${build.branch} @ ${build.commit}` },
      stage: { label: { zh: '失败阶段', en: 'Failed stage' }, value: build.stage, problem: true },
      reruns: { label: { zh: '复跑次数', en: 'Reruns' }, value: String(build.rerunCount) },
      failed: { label: { zh: '失败时间', en: 'Failed at' }, value: build.at },
    },
  })
}