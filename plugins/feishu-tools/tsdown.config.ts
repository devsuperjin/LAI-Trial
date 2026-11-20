import { defineConfig } from 'tsdown'
export default defineConfig({ entry: { client: 'src/client/index.tsx' }, outDir: 'lib', format: 'cjs', platform: 'browser', dts: false, clean: false,
  deps: { alwaysBundle: [/^@lai\/dsh-adapter(?:\/|$)/], neverBundle: ['react', 'react/jsx-runtime', /^@deepseek-ai\//] },
  outputOptions: { entryFileNames: 'web-client.js', banner: 'window.__ModuleLoader__.load({ id: "@lai/feishu-tools", factory: (require) => {', footer: 'return module.exports; } });', intro: 'var module = { exports: {} }; var exports = module.exports;' } })
