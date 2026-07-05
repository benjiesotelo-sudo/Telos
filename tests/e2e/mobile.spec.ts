import { test, expect } from '@playwright/test'

test('mobile journey: upload → configure → pick → tap-to-assign → run gate enabled', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  // the Use column is reachable (table scrolls, not the page)
  await expect(page.getByLabel('use score')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()
  await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByRole('heading', { name: 'Drag columns into roles' })).toBeVisible()
  // tap-to-assign: tap the chip, tap the slot
  await page.locator('.chip', { hasText: 'score' }).first().tap()
  await expect(page.locator('.chip.armed')).toHaveCount(1)
  await page.locator('[data-role="outcome"]').tap()
  await expect(page.locator('[data-role="outcome"] .chip.assigned', { hasText: 'score' })).toBeVisible()
  await page.locator('.chip', { hasText: 'group' }).first().tap()
  await page.locator('[data-role="group"]').tap()
  await expect(page.locator('[data-role="group"] .chip.assigned', { hasText: 'group' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run analysis' })).toBeEnabled()
  // compact rail: one line, no visible sub-dots (they're display:none under 560px, not absent from the
  // DOM - toHaveCount(0) on .subdot would fail since Playwright counts hidden nodes too), fraction visible
  await expect(page.locator('.subdot').first()).not.toBeVisible()
  await expect(page.locator('.thread-frac')).toBeVisible()
  await page.screenshot({ path: 'test-results/mobile-config.png' })
})
