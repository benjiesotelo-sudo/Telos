import { defineConfig } from '@playwright/test'
// Separate config for the documentation-capture spec (tests/docs). NOT part of the gate
// (the gate's playwright.config.ts has testDir 'tests/e2e'). Run explicitly:
//   npx playwright test --config=playwright.docs.config.ts
export default defineConfig({
  testDir: 'tests/docs', timeout: 300_000, retries: 1, workers: 4, fullyParallel: true,
  webServer: { command: 'npm run preview -- --port 4179', url: 'http://localhost:4179', timeout: 180_000, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:4179' },
})
