import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { loadEnvFile } from 'node:process'
import { prepareProfile, root } from './prepare-profile.mjs'

try { loadEnvFile(resolve(root, '.env')) } catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const { home } = await prepareProfile()
const args = process.argv.slice(2)
// Delegate application launch to the installed, version-pinned DSH CLI.
const child = spawn(process.execPath, [resolve(root, 'node_modules/@deepseek-ai/dsh/lib/bin.js'), '--profile', 'lai', ...args], {
  cwd: root, env: { ...process.env, DSH_HOME: home, LAI_WEB_DIST_INDEX: resolve(root, 'app/lai-web/dist/index.html'), LAI_PIPELINE_WORKSPACE: process.env.LAI_PIPELINE_WORKSPACE ?? resolve(home, 'pipeline/workspace'), LAI_PIPELINE_STATE_DIR: resolve(home, 'pipeline') }, stdio: 'inherit',
})
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', error => { console.error(error); process.exitCode = 1 })
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0) })
