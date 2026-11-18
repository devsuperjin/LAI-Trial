/** Wire-boundary validation for one queue task envelope. */

import type { MqTask } from './types.ts'

/** Require one non-empty string field from an untyped record. */
function requiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`mq task ${field} must be a non-empty string`)
  }
  return value
}

/** Accept one optional non-empty string field. */
function optionalString(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`mq task ${field} must be a non-empty string when present`)
  }
  return value
}

/**
 * Validate one decoded queue payload into an immutable task. Queue payloads
 * cross a wire boundary, so every field is checked here rather than trusted.
 * @param raw - the decoded JSON value claimed from a backend.
 * @returns the validated task.
 * @throws TypeError when the payload is not an object or a field is invalid.
 */
export function parseMqTask(raw: unknown): MqTask {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError('mq task must be a JSON object')
  }
  const record = raw as Record<string, unknown>
  const timeoutMs = record['timeoutMs']
  if (timeoutMs !== undefined && (typeof timeoutMs !== 'number' || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0)) {
    throw new TypeError('mq task timeoutMs must be a positive safe integer when present')
  }
  return Object.freeze({
    id: requiredString(record, 'id'),
    prompt: requiredString(record, 'prompt'),
    ...optionalField(record, 'workspacePath'),
    ...optionalField(record, 'title'),
    ...optionalField(record, 'provider'),
    ...optionalField(record, 'model'),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  })
}

/** Spread one optional string field only when present. */
function optionalField(record: Record<string, unknown>, field: string): Record<string, string> {
  const value = optionalString(record, field)
  return value === undefined ? {} : { [field]: value }
}
