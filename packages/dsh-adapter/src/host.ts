/** DSH 0.2.2 host compatibility; never activates a cold session just to read it. */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId, SessionEvent } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-persistence'

export async function sessionEvents(ctx: Context, id: SessionId): Promise<SessionEvent[]> {
  const live = ctx.agents.get(id)
  if (live) return [...live.session.snapshotEvents()]
  await ctx.sessionPersistence.flush()
  await using handle = await ctx.sessionPersistence.open(id, 'read')
  const events: SessionEvent[] = []
  for (let offset = 0; ; ) {
    const page = await handle.read(offset, 512)
    events.push(...page.events)
    if (page.events.length < 512) return events
    offset += page.events.length
  }
}
