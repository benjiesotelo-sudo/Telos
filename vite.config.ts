import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }
export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
  optimizeDeps: { exclude: ['webr'] },
  // include keeps vitest away from tests/e2e (Playwright specs crash vitest collection);
  // hookTimeout covers Engine.init's ggplot2 download in beforeAll (~30 s observed, slower on bad networks).
  test: { environment: 'node', testTimeout: 120_000, hookTimeout: 300_000, include: ['src/**/*.test.ts'] },
})
