/** User-visible root sessions, including native pipeline parents. */
import type { SessionListEntry } from '../api/gateway.ts'

/** Include started roots from either UI or queue; a root stays live while any descendant runs. */
export function rootRuns(entries: SessionListEntry[]): SessionListEntry[] {
  const byId = new Map(entries.map(entry => [entry.sessionId, entry]))
  const running = new Set<string>()
  for (const entry of entries) {
    if (!entry.running) continue
    let current: SessionListEntry | undefined = entry
    const visited = new Set<string>()
    while (current && !visited.has(current.sessionId)) {
      visited.add(current.sessionId)
      running.add(current.sessionId)
      current = current.parentSessionId ? byId.get(current.parentSessionId) : undefined
    }
  }
  const parents = new Set(entries.map(entry => entry.parentSessionId).filter(Boolean))
  return entries.filter(entry => !entry.parentSessionId && (!entry.blank || parents.has(entry.sessionId) || running.has(entry.sessionId)))
    .map(entry => running.has(entry.sessionId) && !entry.running ? { ...entry, running: true } : entry)
}

/** An archived root also removes its descendants from aggregate run metrics. */
export function withoutArchived(entries: SessionListEntry[], archivedIds: string[]): SessionListEntry[] {
  const archived = new Set(archivedIds)
  const byId = new Map(entries.map(entry => [entry.sessionId, entry]))
  return entries.filter(entry => {
    let current: SessionListEntry | undefined = entry
    const visited = new Set<string>()
    while (current && !visited.has(current.sessionId)) {
      if (archived.has(current.sessionId) || (current.parentSessionId && archived.has(current.parentSessionId))) return false
      visited.add(current.sessionId)
      current = current.parentSessionId ? byId.get(current.parentSessionId) : undefined
    }
    return true
  })
}

/** Prefer the human task title inside a structured Worker input. */
export function readableRunTitle(value: string | null | undefined, fallback = 'Run'): string {
  const text = value?.trim()
  if (!text) return fallback
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const input: unknown = JSON.parse(text)
      if (input && typeof input === 'object' && !Array.isArray(input) && 'title' in input && typeof input.title === 'string' && input.title.trim()) return input.title.trim()
    } catch { /* Structured input without a usable title is not a display title. */ }
    return fallback
  }
  return text
}
