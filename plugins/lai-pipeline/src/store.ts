/** Atomic application records and shared, inspectable evidence artifacts. */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { PipelineRun, PipelineState, PipelineStore, Role } from './types.ts'

const role = z.enum(['monitor', 'triage', 'reproduce', 'ticket', 'review', 'report'])
export const inputSchema = z.object({
  id: z.string().trim().min(1).max(200),
  type: z.enum(['ci.failure', 'code.commit', 'pull_request.updated']),
  title: z.string().trim().min(1).max(300),
  summary: z.string().min(1).max(32000),
  repository: z.string().max(500).optional(),
  commit: z.string().max(200).optional(),
  evidence: z.array(z.object({ name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/).refine(name => name !== '.' && name !== '..' && !['event.json', 'monitor.md', 'triage.md', 'reproduce.md', 'ticket.md', 'review.md', 'report.md'].includes(name), 'Evidence name is reserved for pipeline output.'), content: z.string().max(256000) })).max(20),
}).strict().superRefine((input, context) => {
  if (new Set(input.evidence.map(item => item.name)).size !== input.evidence.length) context.addIssue({ code: 'custom', message: 'Evidence filenames must be unique.' })
})
const resultSchema = z.object({ text: z.string(), sessionId: z.string(), startSeq: z.number().int().nonnegative(), endSeq: z.number().int().nonnegative() })
const runSchema = z.object({
  id: z.string().uuid(),
  event: inputSchema.safeExtend({ sourceId: z.string(), simulated: z.boolean(), receivedAt: z.number() }),
  status: z.enum(['running', 'completed', 'needs-review', 'failed', 'cancelled', 'interrupted']),
  createdAt: z.number(), endedAt: z.number().optional(),
  stages: z.array(z.object({ role, status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']), startedAt: z.number().optional(), endedAt: z.number().optional(), result: resultSchema.optional(), error: z.string().optional() })).length(6),
  reviewDecision: z.enum(['APPROVE', 'REQUEST_INFO', 'REJECT', 'UNKNOWN']),
  evidencePaths: z.array(z.string()), artifactDirectory: z.string(), error: z.string().optional(),
})
const stateSchema = z.object({ version: z.literal(1), runs: z.array(runSchema) })

export class FilePipelineStore implements PipelineStore {
  readonly statePath: string
  constructor(readonly directory: string, readonly workspace: string) { this.statePath = join(directory, 'state.json') }
  async load(): Promise<PipelineState> {
    try {
      const parsed = stateSchema.parse(JSON.parse(await readFile(this.statePath, 'utf8')))
      // Parsed optional JSON fields are absent on disk, not explicit undefined values.
      return JSON.parse(JSON.stringify(parsed)) as PipelineState
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { version: 1, runs: [] }
      throw new Error('Pipeline history could not be read. The existing file was preserved; repair or restore state.json before restarting.', { cause: error })
    }
  }
  async save(state: PipelineState): Promise<void> {
    await mkdir(this.directory, { recursive: true })
    const temporary = `${this.statePath}.${randomUUID()}.tmp`
    await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
    await rename(temporary, this.statePath)
  }
  async prepare(run: PipelineRun): Promise<string[]> {
    const directory = resolve(this.workspace, 'runs', run.id)
    await mkdir(directory, { recursive: true })
    const paths: string[] = []
    for (const item of run.event.evidence) {
      const path = join(directory, item.name)
      await writeFile(path, item.content, { flag: 'wx' })
      paths.push(path)
    }
    await writeFile(join(directory, 'event.json'), JSON.stringify(run.event, null, 2) + '\n')
    return paths
  }
  async stage(run: PipelineRun, role: Role, text: string): Promise<void> {
    await writeFile(join(run.artifactDirectory, `${role}.md`), text + '\n')
  }
}
