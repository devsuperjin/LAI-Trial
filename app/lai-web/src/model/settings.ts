import { parse } from 'yaml'
import type { AgentPresetDocument, AgentPresetRow, ModelSelection, SessionListEntry } from '../api/gateway.ts'
import { record } from './dag.ts'
import { stageHue, STAGES } from './tree.ts'
export interface AgentModelInfo { presetId: string; role: string; stage: number | null; hue: string; toolName: string | null; configured: ModelSelection | null; observed: ModelSelection | null; inherits: boolean }
export const selectionKey = (model: ModelSelection): string => `${model.provider}/${model.model}`
export const effectiveModel = (agent: AgentModelInfo, fallback: ModelSelection): ModelSelection => agent.configured ?? agent.observed ?? fallback
export function buildAgentModels(presets: AgentPresetRow[], doc: AgentPresetDocument | null, entries: SessionListEntry[]): AgentModelInfo[] {
  const parsed: unknown = doc ? parse(doc.content, { maxAliasCount: 50 }) : []
  const rows: unknown[] = Array.isArray(parsed) ? parsed : []
  return presets.map((preset, i) => {
    const stage = STAGES.findIndex(s => preset.id.includes(s))
    const config = rows.map(record).map(row => record(row.config)).find(c => c.agentPreset === preset.id)
    const configured = config && typeof config.provider === 'string' && typeof config.model === 'string' ? { provider: config.provider, model: config.model } : null
    const observed = entries.filter(e => e.projections?.values.agentPreset === preset.id).sort((a, b) => b.updatedAt - a.updatedAt)[0]?.projections?.values.modelSelection?.lastUsed ?? null
    return { presetId: preset.id, role: preset.name ?? preset.id, stage: stage < 0 ? null : stage + 1, hue: stageHue(stage < 0 ? i : stage), toolName: STAGES[stage] ?? null, configured, observed, inherits: stage >= 0 && configured === null }
  })
}
