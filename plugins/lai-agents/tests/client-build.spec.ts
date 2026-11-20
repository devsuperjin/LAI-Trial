import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it } from 'vitest'

it('boots the published client factory using only DSH platform modules', () => {
  const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  let imported = false
  runInNewContext(code, { window: { __ModuleLoader__: { load: (entry: { id: string; factory: (require: (name: string) => object) => unknown }) => {
    expect(entry.id).toBe('@lai/lai-agents')
    const exports = entry.factory(name => {
      if (name === 'react' || name === 'react/jsx-runtime') return {}
      throw new Error(`Module is not registered in DSH's client module table: ${name}`)
    })
    expect(exports).toHaveProperty('apply')
    imported = true
  } } } })
  expect(imported).toBe(true)
})
