import { readFileSync } from 'node:fs'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-skill'

/** Mount this entry in an agent preset to keep the Skill in that preset scope. */
export const name = 'lai-credentials-skill'
export const inject = ['skills']
export function apply(ctx: Context) {
  ctx.effect(() => ctx.skills.register({
    name: 'credentials-access', source: 'bundled',
    description: 'Find authorized credentials, API endpoints and server IPs for authenticated research, and persist authorized credential rotations. Load before using credentials tools.',
    content: readFileSync(new URL('../skills/credentials-access/SKILL.md', import.meta.url), 'utf8').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''),
  }), 'Preset-scoped credentials access Skill')
}
