import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
const root = resolve(import.meta.dirname, '..')
const read = path => readFile(resolve(root, path), 'utf8')
const baseline = JSON.parse(await read('config/dsh-baseline.json'))
const manifest = JSON.parse(await read('package.json'))
assert.equal(manifest.dependencies['@deepseek-ai/dsh'], baseline.version)
assert.deepEqual(baseline.corePatches, [])
const packages = []
for (const group of ['app', 'plugins', 'packages', 'bundles']) {
  for (const dir of await readdir(resolve(root, group), { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    const path = `${group}/${dir.name}`
    const pkg = JSON.parse(await read(`${path}/package.json`))
    assert.match(pkg.name, /^@lai\//, `${path} must use the application scope`)
    for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const [name, version] of Object.entries(pkg[section] ?? {})) {
        if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(version, baseline.version, `${pkg.name}: unpinned ${name}`)
        if (name.startsWith('@lai/')) assert.equal(version, 'workspace:*')
      }
    }
    for (const file of await readdir(resolve(root, `${path}/src`), { recursive: true })) {
      if (!/\.(ts|tsx)$/.test(file)) continue
      const text = await read(`${path}/src/${file}`)
      assert.doesNotMatch(text, /(?:from\s*|import\s*)['"][^'"]*(?:\.reference|vendor\/|deepseek-ai\/dsh[^'"]*\/(?:src|lib)\/)/, `${path}/${file}: private DSH import`)
      assert.doesNotMatch(text, /@deepseek-ai\/dsh-(?:mq(?:-redis|-mqtt|-rabbitmq)?|prompt-sections|agent-mq-bundle)(?:['"/])/, `${path}/${file}: stale custom scope`)
    }
    packages.push(pkg.name)
  }
}
console.log(`Architecture verified: ${packages.length} application packages; DSH ${baseline.version}; no core patches.`)
