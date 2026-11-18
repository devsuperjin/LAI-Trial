/** Same-origin application pipeline API over DSH's browser authentication. */
import type { PipelineRun, PipelineSnapshot } from '@lai/lai-pipeline/types'
export type { PipelineRun, PipelineSnapshot, Role, WorkerInfo, SourceInfo } from '@lai/lai-pipeline/types'

async function request<T>(path = '', body?: Record<string, string>): Promise<T> {
  const response = await fetch(`/lai-api/pipeline${path}`, {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    const value: unknown = await response.json().catch(() => undefined)
    throw new Error(typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string' ? value.error : `Pipeline request failed (${response.status}).`)
  }
  return response.json() as Promise<T>
}
/** Read live worker state and durable pipeline history. */
export function pipelineSnapshot(): Promise<PipelineSnapshot> { return request() }
/** Submit one clearly labeled simulated input to real resident agents. */
export function simulatePipeline(sourceId: string, caseId: string): Promise<PipelineRun> { return request('/simulate', { sourceId, caseId }) }
/** Cancel and drain the currently executing pipeline run. */
export function cancelPipeline(runId: string): Promise<{ cancelled: boolean }> { return request('/cancel', { runId }) }
