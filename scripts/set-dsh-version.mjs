import { readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const version = process.argv[2]
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version ?? '')) throw new Error('Supply one exact DSH version, e.g. 0.2.2-rc.1')
const manifests = ['package.json']
for (const group of ['app', 'plugins', 'packages', 'bundles']) {
  for (const dir of await readdir(resolve(root, group), { withFileTypes: true })) if (dir.isDirectory()) manifests.push(`${group}/${dir.name}/package.json`)
}
for (const file of manifests) {
  const path = resolve(root, file)
  const pkg = JSON.parse(await readFile(path, 'utf8'))
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const name of Object.keys(pkg[section] ?? {})) if (name === '@deepseek-ai/dsh' || name.startsWith('@deepseek-ai/dsh-')) pkg[section][name] = version
  }
  await writeFile(path, JSON.stringify(pkg, null, 2) + '\n')
}
const path = resolve(root, 'config/dsh-baseline.json')
const baseline = JSON.parse(await readFile(path, 'utf8'))
if (baseline.version !== version) {
  baseline.previousVersion = baseline.version
  baseline.version = version
  // Release publication and source HEAD can differ; review the candidate's source commit separately.
  baseline.upstreamCommit = null
}
await writeFile(path, JSON.stringify(baseline, null, 2) + '\n')
console.log(`Pinned DSH manifests to ${version}; refresh pnpm-lock.yaml and run pnpm check.`)
