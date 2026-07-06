import { test, expect, type Page } from '@playwright/test'

// Spec R3: 5 deterministic screens x 3 viewports x 2 themes = 30 committed baselines.
// Results screens excluded (WebR figure rendering is not pixel-deterministic).
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'phone', width: 390, height: 844 },
]
const THEMES = ['light', 'dark'] as const

async function setTheme(page: Page, theme: string) {
  await page.locator('.theme-select').selectOption(theme)
  await page.waitForTimeout(150)
}

for (const vp of VIEWPORTS) for (const theme of THEMES) {
  test(`baselines: ${vp.name} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    // Belt-and-braces, deliberate: playwright.config.ts sets reducedMotion at the context level for
    // this project, and this per-page emulateMedia call reasserts it - either alone should suffice,
    // but keeping both guards against either layer silently regressing.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const snap = (label: string) =>
      expect(page).toHaveScreenshot(`${label}-${vp.name}-${theme}.png`, { fullPage: true })

    await page.goto('/')
    await setTheme(page, theme)
    await snap('welcome')
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
    await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
    await snap('guide')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
    await snap('configure-data')
    await page.getByRole('button', { name: 'Confirm & pick test' }).click()
    await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
    await snap('pick-tests')
    await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
    await page.getByRole('button', { name: 'Confirm selection' }).click()
    await expect(page.getByRole('heading', { name: 'Drag columns into roles' })).toBeVisible()
    await page.locator('.chip', { hasText: 'score' }).first().click()
    await page.locator('[data-role="outcome"]').click()
    await expect(page.locator('[data-role="outcome"] .chip.assigned', { hasText: 'score' })).toBeVisible()
    await snap('test-config')
  })
}
