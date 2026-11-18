/** LAI application composition over DSH's authenticated static frontend server. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { auditStartupEntries } from '@deepseek-ai/dsh-app-boot'
import * as FrontendStatic from '@deepseek-ai/dsh-host-frontend-static'
import { launchedThroughSsh, launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-web-app'
import type {} from '@deepseek-ai/dsh-workspace'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import open from 'open'
import { mountDebugUi } from './debug-ui.ts'

export const name = 'lai-web'
export const inject = ['webServer', 'connection', 'workspaceRegistry']

/** Built frontend location and the ordinary DSH Web launch options. */
export interface Config {
  /** Absolute index.html path of the built LAI frontend. */
  distIndex: string
  /** Open the authenticated URL after application startup. */
  openBrowser: boolean
  /** Canonical URL advertised by a reverse-proxy deployment, when supplied. */
  publicUrl?: string
}

export const Config: z<Config> = z.object({
  distIndex: z.string().required(),
  openBrowser: z.boolean().default(true),
  publicUrl: z.string(),
})

/**
 * Mount DSH's static file owner beside its existing API services.
 * @param ctx - DSH host with the Web server and browser authentication mounted.
 * @param config - Frontend location and launch preferences.
 */
export function apply(ctx: Context, config: Config): void {
  let publicUrl: string | undefined
  if (config.publicUrl != null) {
    const url = new URL(config.publicUrl)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('LAI Web public URL must be an HTTP(S) root without credentials, a query or a fragment.')
    }
    if (!url.pathname.endsWith('/')) url.pathname += '/'
    publicUrl = url.href
  }
  const advertisedUrl = (): string => publicUrl ?? ctx.webServer.getOrigin()
  ctx.provide('webApp', { getAdvertisedUrl: advertisedUrl })
  ctx.plugin(FrontendStatic, { distIndex: config.distIndex })
  mountDebugUi(ctx, config.distIndex)
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: '/lai-api/runs/archives', handler: (req, res) => {
    const rejection = ctx.connection.requestRejection(req)
    if (rejection !== undefined) { res.writeHead(rejection); res.end(); return }
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
    res.end(JSON.stringify({ archivedSessionIds: ctx.workspaceRegistry.archivedSessionIds }))
  } }), 'LAI archived session discovery')

  let active = true
  ctx.effect(() => () => { active = false }, 'LAI Web readiness lifetime')
  // Readiness waits for sibling APIs and the static frontend to finish mounting.
  const ready = ctx.get('loader')?.await() ?? Promise.resolve()
  void ready.then(async () => {
    if (!active) return
    await auditStartupEntries(ctx.root, 'LAI Web', () => {})
    if (!active) return
    const url = ctx.connection.authenticatedUrl(advertisedUrl())
    console.log(`LAI Web: ${url}`)
    if (config.openBrowser && !launchedThroughSsh(launchEnvironmentOf(ctx))) {
      try { await open(url) } catch {
        if (active) console.error('LAI Web could not open the browser. Open the URL printed above.')
      }
    }
  }).catch(error => {
    if (active) ctx.logger.error('LAI Web startup failed: %s', error instanceof Error ? error.message : String(error))
  })
}
