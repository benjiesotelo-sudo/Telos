import { defineConfig } from 'vitest/config'
export default defineConfig({
  optimizeDeps: { exclude: ['webr'] },
  test: {
    environment: 'node',
    testTimeout: 1_200_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    include: ['docs/superpowers/reviews/2026-06-20-sem-b-spike-data/boot-0b.webr.test.ts'],
  },
})
