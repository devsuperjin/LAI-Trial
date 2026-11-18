import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['plugins/*/tests/*.spec.ts', 'tests/**/*.spec.ts', 'app/*/tests/*.spec.tsx'], exclude: ['.reference/**', 'node_modules/**', 'plugins/superagent/tests/**'], testTimeout: 15000, hookTimeout: 15000 } })
