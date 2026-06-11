import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e', timeout: 300_000, // two analysis runs + first-visit WebR assets + the ggplot2 download from the WebR repo (network)
  webServer: { command: 'npm run build && npm run preview -- --port 4173', url: 'http://localhost:4173', timeout: 180_000, reuseExistingServer: false },
  use: { baseURL: 'http://localhost:4173' },
})
