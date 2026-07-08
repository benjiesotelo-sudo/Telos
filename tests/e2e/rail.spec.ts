import { test, expect, type Page } from '@playwright/test'

// Owner-reported bug (2026-07-08): the rail thread painted past the current stage's node, and the
// overshoot depended on how many tests were selected (1 test → fill read as past Pick tests toward
// Configure; many tests → fill pulled back toward Data). Invariant pinned here: the thread ends ON
// the current stage's node regardless of selection count, and Configure sub-progress only moves it
// between the Configure and Results nodes. (Model side is pinned in src/state/stages.test.ts; this
// covers the Stepper's stage-space → measured-node-centers pixel mapping.)

const railGeometry = async (page: Page) => {
  const fill = await page.locator('.rail-fill').boundingBox()
  const centers: number[] = []
  for (const n of await page.locator('.stage .node').all()) {
    const b = (await n.boundingBox())!
    centers.push(b.x + b.width / 2)
  }
  return { fillEnd: fill!.x + fill!.width, centers }
}

test('rail thread ends on the current stage node - selection count never skews it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()

  // 1 selected: thread sits ON the Pick tests node (index 2)
  await page.getByRole('checkbox', { name: 'Summary statistics' }).check()
  await page.waitForTimeout(450) // let the 320ms fill transition settle
  const one = await railGeometry(page)
  expect(Math.abs(one.fillEnd - one.centers[2])).toBeLessThan(2)

  // 6 selected: the sub-dot band widens Configure and shifts the nodes - the thread must follow the node
  for (const name of ['Frequencies & cross-tabs', 'Distribution & normality', 'One-sample t-test', 'Independent t-test', 'Nested ANOVA']) {
    await page.getByRole('checkbox', { name }).check()
  }
  await page.waitForTimeout(450)
  const six = await railGeometry(page)
  expect(Math.abs(six.fillEnd - six.centers[2])).toBeLessThan(2)

  // Configure, test 1 of 6: thread sits ON the Configure node (index 3) - it never lags behind
  // Pick tests (the reported carry-over artifact) and never runs ahead toward Results
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByRole('heading', { name: /Summary statistics|Drag columns/ })).toBeVisible()
  await page.waitForTimeout(450)
  const cfg = await railGeometry(page)
  expect(Math.abs(cfg.fillEnd - cfg.centers[3])).toBeLessThan(2)
})
