import { mkdir, readFile, writeFile, symlink, lstat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const home = resolve(root, '.runtime/dsh')
export const profile = resolve(home, 'profiles/lai')

/** Initialize only this application's isolated profile; preserve its existing patch. */
export async function prepareProfile() {
  await mkdir(profile, { recursive: true })
  const manifest = JSON.parse(await readFile(resolve(root, 'config/profile.json'), 'utf8'))
  await writeFile(resolve(profile, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  for (const [path, target] of [
    [resolve(profile, 'node_modules'), resolve(root, 'node_modules')],
    [resolve(profile, 'cordis.patch.yml'), resolve(root, 'config/cordis.patch.yml')],
  ]) {
    try { await lstat(path) } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await symlink(target, path, process.platform === 'win32' && path.endsWith('node_modules') ? 'junction' : undefined)
    }
  }
  return { home, profile }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await prepareProfile()
  console.log(`Prepared isolated LAI profile: ${profile}`)
}
