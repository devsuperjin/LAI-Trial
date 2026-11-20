import { expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply } from '../src/index.js'

it('registers standard DSH tools without depending on LAI, with owned cleanup', () => {
  const dispose = vi.fn()
  const register = vi.fn(() => dispose)
  const cleanups: Array<() => void> = []
  const ctx = {
    tools: { register },
    effect: (factory: () => () => void) => cleanups.push(factory()),
    inject: vi.fn(),
  } as unknown as Context
  apply(ctx, { credentials: { get: () => ({}) } } as never)
  expect(register).toHaveBeenCalledTimes(18)
  expect(register.mock.calls.some(([tool]) => tool.name === 'feishu_send_message')).toBe(true)
  cleanups.forEach(dispose => dispose())
  expect(dispose).toHaveBeenCalledTimes(18)
})
