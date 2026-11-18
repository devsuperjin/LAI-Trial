import { expect, it } from 'vitest'
import { DelegationOrder, toolForRole } from '../src/delegation-order.ts'

it('denies future and duplicate delegation calls before dispatch', () => {
  const order = new DelegationOrder()
  order.begin('monitor')
  expect(order.claim('triage')).toBeDefined()
  order.begin('triage')
  expect(order.claim('reproduce')).toBeDefined()
  expect(order.claim('triage')).toBeUndefined()
  expect(order.claim('triage')).toBeDefined()
  expect(order.claim('ticket')).toBeDefined()
  order.end()
  expect(order.claim('reproduce')).toBeDefined()
  order.begin('reproduce')
  expect(order.claim('reproduce')).toBeUndefined()
  order.begin('report')
  expect(toolForRole('report')).toBe('reporter')
  expect(order.claim('reporter')).toBeUndefined()
})
