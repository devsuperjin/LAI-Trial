import { createElement } from 'react'
import { act, create } from 'react-test-renderer'
import { expect, it, vi } from 'vitest'
import { DashboardPage } from '../src/components/DashboardPage.tsx'
vi.mock('../src/api/gateway.ts', () => ({ sessionTurnCount: async () => 0 }))
vi.mock('@lai/dsh-adapter/superagent', () => ({
  superagentState: async () => ({ masterId: 'router', paused: false, load: { running: 0, queued: 0, maxWorkers: 3 }, health: { runtime: { state: 'ready' } }, setup: { accounts: null } }),
  superagentOverview: async () => ({ problems: [], flow: {}, person: [] }),
  superagentTickets: async () => ({ items: [], total: 0 }),
  superagentSources: async () => [
    { id: 'jenkins', title: { en: 'Jenkins CI', zh: 'Jenkins CI' }, installed: true, enabled: true, state: 'paused', health: [{ name: 'jenkins', state: 'paused', code: 'jenkinsUrlUnset', detail: 'Waiting for a Jenkins URL to be configured' }] },
  ],
}))
it('shows a Jenkins-only deployment and its unconfigured paused state', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(createElement(DashboardPage, { entries: [], onOpenRun: vi.fn(), onRouter: vi.fn(), onRuns: vi.fn() })) })
  const json = JSON.stringify(renderer!.toJSON())
  expect(json).toContain('Jenkins CI')
  expect(json).toContain('Waiting for a Jenkins URL to be configured')
  expect(json).not.toContain('No repository configured')
  expect(json).not.toContain('No service issues reported.')
  act(() => { renderer!.unmount() })
})
