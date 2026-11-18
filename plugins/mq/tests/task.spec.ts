import { describe, expect, it } from 'vitest'
import { parseMqTask } from '../src/task.ts'

describe('parseMqTask', () => {
  it('accepts a complete envelope and freezes it', () => {
    const task = parseMqTask({
      id: 't1',
      prompt: 'do work',
      workspacePath: '/tmp/ws',
      title: 'My task',
      provider: 'mock',
      model: 'm1',
      timeoutMs: 1000,
    })
    expect(task).toEqual({
      id: 't1',
      prompt: 'do work',
      workspacePath: '/tmp/ws',
      title: 'My task',
      provider: 'mock',
      model: 'm1',
      timeoutMs: 1000,
    })
    expect(Object.isFrozen(task)).toBe(true)
  })

  it('omits absent optional fields', () => {
    expect(parseMqTask({ id: 't1', prompt: 'do work' })).toEqual({ id: 't1', prompt: 'do work' })
  })

  it.each([
    ['non-object', 'nope'],
    ['null', null],
    ['array', []],
    ['missing id', { prompt: 'do work' }],
    ['blank prompt', { id: 't1', prompt: '  ' }],
    ['numeric id', { id: 7, prompt: 'do work' }],
    ['blank optional title', { id: 't1', prompt: 'do work', title: '' }],
    ['zero timeout', { id: 't1', prompt: 'do work', timeoutMs: 0 }],
    ['fractional timeout', { id: 't1', prompt: 'do work', timeoutMs: 1.5 }],
    ['string timeout', { id: 't1', prompt: 'do work', timeoutMs: '1000' }],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseMqTask(raw)).toThrow(TypeError)
  })
})
