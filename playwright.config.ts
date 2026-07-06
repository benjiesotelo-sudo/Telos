import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e', timeout: 600_000, // two analysis runs + first-visit WebR assets + the ggplot2 download from the WebR repo (network); SEM cards add the lavaan/semTools download + a cold-boot CFA/bootstrap, so per-assertion waits (up to 480s) can exceed the old 300s global on a cold isolated run

  webServer: { command: 'npm run build && npm run preview -- --port 4173', url: 'http://localhost:4173', timeout: 180_000, reuseExistingServer: false },
  use: { baseURL: 'http://localhost:4173' },
  expect: { toHaveScreenshot: { maxDiffPixels: 200 } },
  projects: [
    { name: 'desktop', testIgnore: ['**/mobile.spec.ts', '**/responsive.spec.ts', '**/visual.spec.ts'] },
    { name: 'tablet', testMatch: '**/mobile.spec.ts', use: { viewport: { width: 834, height: 1112 }, isMobile: true, hasTouch: true } },
    { name: 'mobile', testMatch: '**/mobile.spec.ts', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'responsive', testMatch: '**/responsive.spec.ts', use: { hasTouch: true } },
    { name: 'visual', testMatch: '**/visual.spec.ts', use: { contextOptions: { reducedMotion: 'reduce' } } },
  ],
})
