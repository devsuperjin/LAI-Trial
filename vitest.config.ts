import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['plugins/*/tests/*.spec.ts', 'tests/**/*.spec.ts'], exclude: ['.reference/**', 'node_modules/**'], testTimeout: 15000, hookTimeout: 15000 } })
