import { mkdir, readFile, writeFile, symlink, lstat, unlink, copyFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDocument, isMap, isSeq } from 'yaml'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const home = resolve(process.env.LAI_DSH_HOME ?? resolve(root, '.runtime/dsh'))
export const profile = resolve(home, 'profiles/lai')
const applicationBundle = '@lai/application-config'

async function optionalFile(path) {
  try { return await readFile(path, 'utf8') } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return undefined
  }
}

/** Remove only the previously copied application rows; preserve provider and user settings. */
async function migratePatch(path) {
  const source = await optionalFile(path)
  if (source === undefined) { await writeFile(path, '[]\n'); return }
  const document = parseDocument(source, { customTags: [{ tag: 'tag:yaml.org,2002:js', resolve: value => value }] })
  if (document.errors.length || !isSeq(document.contents)) throw new Error('LAI profile patch could not be migrated; its original file is unchanged.')
  const copiedRow = row => {
    if (!isMap(row)) return false
    const id = row.get('id')
    if (['ui-settings-account', 'account-controller', 'web-runtime'].includes(id)) {
      return row.get('disabled') === true && row.items.every(item => ['id', 'disabled'].includes(String(item.key)))
    }
    return id === 'lai-web-runtime' && ['@lai/dsh-web-app', '@lai/dsh-web-host'].includes(row.get('name'))
  }
  for (const row of document.contents.items) {
    if (isMap(row) && isSeq(row.get('insert', true))) {
      const entries = row.get('insert', true)
      entries.items = entries.items.filter(item => !copiedRow(item))
    }
  }
  document.contents.items = document.contents.items.filter(row => !copiedRow(row) && !(isMap(row) && isSeq(row.get('insert', true)) && row.get('insert', true).items.length === 0 && row.items.length === 1))
  try { await copyFile(path, resolve(profile, 'cordis.patch.before-app-bundle.yml'), constants.COPYFILE_EXCL) } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
  await writeFile(path, document.toString())
}

/** Initialize application defaults below, and independently preserve writable user configuration. */
export async function prepareProfile() {
  await mkdir(profile, { recursive: true })
  const template = JSON.parse(await readFile(resolve(root, 'config/profile.json'), 'utf8'))
  const oldText = await optionalFile(resolve(profile, 'package.json'))
  const previous = oldText ? JSON.parse(oldText) : {}
  const patch = resolve(profile, 'cordis.patch.yml')
  let linked = false
  try { linked = (await lstat(patch)).isSymbolicLink() } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (linked) { await unlink(patch); await writeFile(patch, '[]\n') }
  else if (!previous.dsh?.profile?.bundles?.includes(applicationBundle)) await migratePatch(patch)
  else if (await optionalFile(patch) === undefined) await writeFile(patch, '[]\n')
  const manifest = {
    ...previous, ...template,
    dependencies: { ...previous.dependencies, ...template.dependencies },
    dsh: { ...previous.dsh, ...template.dsh, profile: {
      ...previous.dsh?.profile, ...template.dsh.profile,
      bundles: [...new Set([...template.dsh.profile.bundles, ...previous.dsh?.profile?.bundles ?? []])],
    } },
  }
  await writeFile(resolve(profile, 'package.json'), JSON.stringify(manifest, null, 2) + '\n')
  const modules = resolve(profile, 'node_modules')
  try { await lstat(modules) } catch (error) {
    if (error.code !== 'ENOENT') throw error
    await symlink(resolve(root, 'node_modules'), modules, process.platform === 'win32' ? 'junction' : undefined)
  }
  return { home, profile }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await prepareProfile()
  console.log(`Prepared isolated LAI profile: ${profile}`)
}
