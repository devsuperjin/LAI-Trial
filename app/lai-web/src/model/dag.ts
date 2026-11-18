import type { WireEvent } from '../api/gateway.ts'
export const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const textOf = (value: unknown): string => typeof value === 'string' ? value : Array.isArray(value) ? value.map(part => typeof record(part).text === 'string' ? record(part).text : '').join('') : ''
export function deriveDag(events: WireEvent[]) {
  const task = events.find(event => event.type === 'user/message' && record(event.data.source).kind === 'mq')
  const end = events.findLast(event => event.type === 'turn/end')
  return {
    taskLabel: String(record(task?.data.source).taskId ?? 'MQ task'),
    turnEnd: end === undefined ? undefined : String(record(end.data.reason).kind ?? end.data.reason),
    toolCounts: { total: events.filter(event => event.type === 'tool/call').length, errors: events.filter(event => event.type === 'tool/result' && record(event.data.message).isError === true).length },
  }
}
