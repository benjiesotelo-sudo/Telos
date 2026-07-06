import { test, expect, type Page } from '@playwright/test'

const WIDTHS = [320, 390, 560, 680, 834, 1024, 1280]

// The five deterministic screens (no WebR). Returns after test-config is reached with one assignment.
async function walkToConfig(
  page: Page,
  assertNoOverflow: (label: string) => Promise<void>,
  fixture = 'tests/e2e/fixtures/study.csv',
  chipText = 'score',
) {
  await page.goto('/')
  await assertNoOverflow('welcome')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', fixture)
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await assertNoOverflow('guide')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await assertNoOverflow('configure-data')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await assertNoOverflow('pick-tests')
  await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByRole('heading', { name: 'Drag columns into roles' })).toBeVisible()
  // tap-to-assign works at every width and is layout-independent (drags need stable geometry)
  await page.locator('.chip', { hasText: chipText }).first().tap()
  await page.locator('[data-role="outcome"]').tap()
  await expect(page.locator('[data-role="outcome"] .chip.assigned', { hasText: chipText })).toBeVisible()
  await assertNoOverflow('test-config')
}

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px on any screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const assertNoOverflow = async (label: string) => {
      await page.waitForTimeout(120) // let wraps settle
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(over, `${label} overflows horizontally by ${over}px at ${width}px`).toBeLessThanOrEqual(0)
    }
    await walkToConfig(page, assertNoOverflow)
  })
}

// R1 hazard: a long unbroken column-name token gives a .chip a large min-content width that the
// non-wrapping DragSlots row can't shrink below at narrow widths, even though .pool itself wraps chips.
test('no horizontal overflow at 320px with long column names', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 })
  const assertNoOverflow = async (label: string) => {
    await page.waitForTimeout(120) // let wraps settle
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(over, `${label} overflows horizontally by ${over}px at 320px (long names)`).toBeLessThanOrEqual(0)
  }
  await walkToConfig(
    page,
    assertNoOverflow,
    'tests/e2e/fixtures/long-names.csv',
    'customer_satisfaction_composite_score_quarter_3',
  )
})
