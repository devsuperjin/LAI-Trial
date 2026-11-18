/** Synthetic CI and commit events delivered through the same interface as future connectors. */
import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@lai/lai-pipeline'
import type { PipelineInput } from '@lai/lai-pipeline/types'

export const name = 'pipeline-simulator'
export const inject = ['laiPipeline']
export const Config = z.object({})

/** Create local-only, clearly labeled evidence; never contact an external CI service. */
export function simulation(caseId: string): PipelineInput {
  const ci = caseId === 'ci-failure'
  if (!ci && caseId !== 'commit') throw new Error('Unknown simulated input.')
  return {
    id: randomUUID(), type: ci ? 'ci.failure' : 'code.commit',
    title: '[Simulation] 1 + 1 returns 3',
    summary: 'Minimal local simulation: add(1, 1) returns 3 instead of 2 because return a + b + 1 contains an extra +1. The orchestrator confirms the failure, then delegates to five specialists. Each gives a short English answer. Run the supplied reproduction script once. No extra investigation or remote tickets.',
    repository: 'simulation/tiny-add', commit: 'simulated-extra-plus-one',
    evidence: [
      { name: 'failure.log', content: 'SIMULATION: assert add(1, 1) == 2; actual: 3; FAIL\n' },
      { name: 'change.diff', content: '- return a + b\n+ return a + b + 1\n' },
      { name: 'reproduce.py', content: 'def add(a, b):\n    return a + b + 1\nactual = add(1, 1)\nprint(f"SIMULATION: actual={actual}, expected=2")\nassert actual == 2\n' },
    ],
  }
}

/** Mount one event-source adapter; another CI plugin can implement the same submit interface. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.laiPipeline.registerSource({
    id: 'simulator', name: 'Simulated CI / GitHub inputs', simulated: true,
    description: 'Local fixtures exercise one orchestrator and five real subagents. No live CI or GitHub connection is configured.',
    cases: [
      { id: 'ci-failure', title: 'Simulate CI failure', description: '1 + 1 returns 3; a tiny local fixture.' },
      { id: 'commit', title: 'Simulate commit', description: 'A one-line extra +1 change.' },
    ], simulate: simulation,
  }).dispose, 'pipeline simulator source')
}
