import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const target = process.env.LAI_WEB_TARGET ?? 'http://127.0.0.1:3080'

// The gateway fences browser requests by Origin: any attached Origin must
// equal the Host authority, and the auth cookie is SameSite=Strict. Proxying
// /api keeps the console same-origin; the extra origin header rewrites what
// the gateway sees so its fence passes, and changeOrigin rewrites Host.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/lai-api': { target, changeOrigin: true, headers: { origin: target } },
      '/api': {
        target,
        changeOrigin: true,
        ws: true,
        headers: { origin: target },
      },
      '/dsh-auth': {
        target,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dsh-auth/, '/'),
        headers: { origin: target },
      },
      '/dsh': { target, changeOrigin: true, headers: { origin: target } },
    },
  },
})