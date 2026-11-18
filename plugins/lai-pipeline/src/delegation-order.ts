import type { Role } from './types.ts'

export const DELEGATION_TOOLS = ['triage', 'reproduce', 'ticket', 'review', 'reporter'] as const
export const toolForRole = (role: Role): string => role === 'report' ? 'reporter' : role

/** Admission is synchronous so batched model calls cannot overlap stages. */
export class DelegationOrder {
  private expected: string | undefined
  private admitted = false
  begin(role: Role): void {
    this.expected = role === 'monitor' ? undefined : toolForRole(role)
    this.admitted = false
  }
  end(): void { this.expected = undefined; this.admitted = false }
  claim(name: string): string | undefined {
    if (!(DELEGATION_TOOLS as readonly string[]).includes(name)) return undefined
    if (name !== this.expected) return `Pipeline order: only ${this.expected ?? 'orchestrator observation'} is allowed now. Wait for the current stage to complete.`
    if (this.admitted) return `The ${name} subagent has already been started for this stage. Wait for its result.`
    this.admitted = true
    return undefined
  }
}
