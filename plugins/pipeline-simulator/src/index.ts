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
  const commit = 'simulated-batch-size-change'
  const ci = caseId === 'ci-failure'
  if (!ci && caseId !== 'commit') throw new Error('Unknown simulated input.')
  return {
    id: randomUUID(), type: ci ? 'ci.failure' : 'code.commit',
    title: ci ? '[Simulation] CI latency regression' : '[Simulation] Commit changes batch size',
    summary: '这是本地模拟输入，不是真实 CI。一个虚构提交将默认 batch_size 从 64 改为 256，固定测试夹具中的延迟从 96 ms 变为 148 ms，超过 120 ms 阈值。请按六阶段完成证据检查、根因分析、本地复现、工单草稿、独立复核和报告。不要访问外部服务或创建真实工单。',
    repository: 'simulation/iqe-fixture', commit,
    evidence: [
      { name: 'failure.log', content: 'SIMULATED CI BUILD #42\ncommit: simulated-batch-size-change\nFAIL tests/test_latency.py::test_latency_budget\nassert measured_latency_ms <= 120\nE assert 148 <= 120\nbatch_size=256; prior baseline: batch_size=64, latency=96ms\n' },
      { name: 'change.diff', content: 'SIMULATED COMMIT\n--- a/config.py\n+++ b/config.py\n-DEFAULT_BATCH_SIZE = 64\n+DEFAULT_BATCH_SIZE = 256\n' },
      { name: 'reproduce.py', content: '"""Deterministic synthetic fixture, not a hardware performance measurement."""\nimport sys\nbatch_size = int(sys.argv[1]) if len(sys.argv) > 1 else 256\nlatency_ms = {64: 96, 256: 148}[batch_size]\nprint(f"SIMULATION: batch_size={batch_size}, latency_ms={latency_ms}, limit=120")\nassert latency_ms <= 120, f"simulated latency regression: {latency_ms} > 120"\n' },
    ],
  }
}

/** Mount one event-source adapter; another CI plugin can implement the same submit interface. */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.laiPipeline.registerSource({
    id: 'simulator', name: 'Simulated CI / GitHub inputs', simulated: true,
    description: 'Local fixtures exercise the real six-agent pipeline. No live CI or GitHub connection is configured.',
    cases: [
      { id: 'ci-failure', title: 'Simulate CI failure', description: 'A local failure log and deterministic reproduction fixture.' },
      { id: 'commit', title: 'Simulate commit', description: 'A synthetic commit diff and its validation evidence.' },
    ], simulate: simulation,
  }).dispose, 'pipeline simulator source')
}
