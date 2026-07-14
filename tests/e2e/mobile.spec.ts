import { test, expect } from '@playwright/test'

// R14 (owner-reported C1): the fixed .theme-select sat on top of the compact journey rail at phone
// widths (its box covered the rail's thread fraction). Geometry assertions in the style of
// path-canvas-layout.spec.ts. Runs in the mobile AND tablet projects: at phone widths the two
// bounding boxes must be fully disjoint (the select floats bottom-right there); at tablet width the
// select stays top-right and its box may touch the rail's empty top padding, so assert against the
// rail's visible content (the track and the stages row) instead.
test('theme-select never overlaps the journey rail', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  const box = async (selector: string) => {
    const b = await page.locator(selector).boundingBox()
    expect(b, `${selector} must be visible`).not.toBeNull()
    return b!
  }
  const disjoint = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x >= b.x + b.width || a.x + a.width <= b.x || a.y >= b.y + b.height || a.y + a.height <= b.y
  const sel = await box('.theme-select')
  if (page.viewportSize()!.width <= 560) {
    expect(disjoint(sel, await box('.rail')), 'theme-select box must not intersect the rail box').toBe(true)
  } else {
    expect(disjoint(sel, await box('.rail-track')), 'theme-select must clear the rail track').toBe(true)
    expect(disjoint(sel, await box('.rail .stages')), 'theme-select must clear the rail stages').toBe(true)
  }
})

test('touch journey: upload → configure → pick → tap-to-assign → run gate enabled', async ({ page }) => {
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
  // compact rail: one line, no visible sub-dots under 560px (they're display:none, not absent from the
  // DOM - toHaveCount(0) on .subdot would fail since Playwright counts hidden nodes too), fraction visible
  const { width } = page.viewportSize()!
  if (width <= 560) {
    await expect(page.locator('.subdot').first()).not.toBeVisible()
  } else {
    // subdots ARE visible at wider widths (like 834px tablet)
    await expect(page.locator('.subdot').first()).toBeVisible()
  }
  if (width <= 560) {
    await expect(page.locator('.thread-frac')).toBeVisible()
  }
  // Minor: mobile + tablet projects both run this file - a shared filename would let one project's
  // screenshot clobber the other's when run together.
  await page.screenshot({ path: `test-results/${test.info().project.name}-config.png` })
})
