/** Mount the installed DSH frontend on the same authenticated host for debugging. */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'
import sirv from 'sirv'

/**
 * Serve the official frontend without a second API server or a separate DSH home.
 * @param ctx - Host whose browser cookie and API are shared by both frontends.
 * @param laiIndex - Built LAI index; its assets take priority over official asset fallbacks.
 */
export function mountDebugUi(ctx: Context, laiIndex: string): void {
  const require = createRequire(import.meta.url)
  const officialRoot = join(dirname(require.resolve('@deepseek-ai/dsh-web-frontend/package.json')), 'dist')
  const official = sirv(officialRoot, { dev: true })
  const lai = sirv(dirname(laiIndex), { dev: true })
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/dsh',
    async handler(req, res) {
      const origin = ctx.webServer.getOrigin()
      const url = new URL(req.url ?? '/', origin)
      if (url.pathname === '/dsh') {
        url.pathname = '/dsh/'
        res.writeHead(302, { location: url.pathname + url.search })
        res.end()
        return
      }
      if (url.pathname === '/dsh/' || url.pathname === '/dsh/index.html') {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { allow: 'GET, HEAD' }); res.end(); return
        }
        const headers = new Headers()
        for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
        if (!ctx.connection.authorizeIndex(new Request(url, { headers }), res)) return
        const original = await readFile(join(officialRoot, 'index.html'), 'utf8')
        // Keep the gateway's document base at the host root; module assets live under /dsh/.
        const html = ctx.webServer.renderIndex(original.replace(/(["'])\.\//g, '$1/dsh/'), ctx.connection.browserPeer)
          .replace(/<head(?:\s[^>]*)?>/i, head => `${head}<base href="/">`)
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(req.method === 'HEAD' ? undefined : html)
        return
      }
      req.url = url.pathname.slice('/dsh'.length) + url.search
      official(req, res, () => { res.statusCode = 404; res.end() })
    },
  }), 'DSH debugging frontend')
  // Some official worker URLs resolve from the document base instead of the module URL.
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: '/assets',
    handler(req, res) {
      lai(req, res, () => official(req, res, () => { res.statusCode = 404; res.end() }))
    },
  }), 'shared frontend assets')
}
