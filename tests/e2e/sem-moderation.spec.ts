import { test, expect } from '@playwright/test'
import { gotoCard } from './fixtures/helpers'

// This file starts with the DRAW-GESTURE + GUARD coverage (Unit 4). Unit 11 appends the full
// run -> moderation-figure journey once U5/U6's statistics land -- do not duplicate that here.
// R4 (board-clearing slice): the moderation figure is the two-line interaction chart (the whisker
// simple-slopes plot was replaced by owner ruling).
test('CB-SEM canvas: moderation gesture draws a dashed clay edge; guards block invalid attempts', async ({ page }) => {
  await gotoCard(page, 'cb-sem', 'sem-moderation.csv')   // fixture with sn1..4/ta1..4/ti1..3 (SN/TA/TI)

  // Define three constructs in the construct-slots form (below the canvas): SN, TA, TI.
  const card = (n: number) =>
    page.locator('.card').filter({ has: page.getByLabel(`Construct ${n} name`) })
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 1 name').fill('SN')
  for (const q of ['sn1', 'sn2', 'sn3', 'sn4']) await card(1).getByRole('checkbox', { name: q }).check()
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 2 name').fill('TA')
  for (const q of ['ta1', 'ta2', 'ta3', 'ta4']) await card(2).getByRole('checkbox', { name: q }).check()
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 3 name').fill('TI')
  for (const q of ['ti1', 'ti2', 'ti3']) await card(3).getByRole('checkbox', { name: q }).check()

  // three ovals appear on the canvas
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(3)

  // Draw SN -> TI (Draw tool is default): click source oval then target oval.
  // NON-adjacent on purpose: the default left-to-right layout puts SN->TI's midpoint exactly under
  // TA's oval (cx=398 for both). This is the case the midpoint-handles-paint-above-nodes fix targets
  // (SemCanvas.tsx renders the active handle circles after the nodes layer) - it must be clickable.
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-node-id]').nth(2).click()
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)

  // Self-moderation guard: click SN (the path's own source) then its own path midpoint.
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.getByRole('alert')).toContainText(/cannot moderate its own path/i)

  // Valid gesture: click TA (not in the path, and whose oval sits on top of the SN->TI midpoint)
  // then the SN->TI midpoint.
  await page.locator('[data-node-id]').nth(1).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.locator('.sem-mod-arrow')).toHaveCount(1)

  // Duplicate guard: same moderator, same path again.
  await page.locator('[data-node-id]').nth(1).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.getByRole('alert')).toContainText(/already moderates/i)
})

// Full run journey (Unit 11): the gesture above proves the draw side; this proves the canvas->runner
// bridge end to end at the 1,000-resample "quick draft" preset (Global Constraints: e2e/doc-harness
// moderation runs use 1,000 - spike-calibrated at WebR ~34s of wall time for the bootstrap itself, on
// top of cold WebR boot + package install/init, hence the generous overall budget below).
test('CB-SEM moderation: draw edge → run at 1,000 preset → interaction row + slopes figure', async ({ page }) => {
  test.setTimeout(600_000)
  await gotoCard(page, 'cb-sem', 'sem-moderation.csv')

  const card = (n: number) =>
    page.locator('.card').filter({ has: page.getByLabel(`Construct ${n} name`) })
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 1 name').fill('SN')
  for (const q of ['sn1', 'sn2', 'sn3', 'sn4']) await card(1).getByRole('checkbox', { name: q }).check()
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 2 name').fill('TA')
  for (const q of ['ta1', 'ta2', 'ta3', 'ta4']) await card(2).getByRole('checkbox', { name: q }).check()
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 3 name').fill('TI')
  for (const q of ['ti1', 'ti2', 'ti3']) await card(3).getByRole('checkbox', { name: q }).check()

  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(3)

  // SN -> TI base structural path (non-adjacent on purpose, same idiom as the gesture spec above:
  // TA's oval sits over the SN->TI midpoint), then TA moderates it.
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-node-id]').nth(2).click()
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)
  await page.locator('[data-node-id]').nth(1).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.locator('.sem-mod-arrow')).toHaveCount(1)

  // Bootstrap preset — the wrapping <label class="pill"> gives each radio its accessible name ("1k").
  await page.getByRole('radio', { name: '1k' }).check()

  await page.getByRole('button', { name: 'Run analysis' }).click()

  await expect(page.locator('svg[id^="figure-path-diagram-"]')).toBeVisible({ timeout: 300_000 })
  await expect(page.getByText(/This test failed:/)).toHaveCount(0)

  // Moderation lands as an H-numbered interaction row in the Structural paths table (Table 5), with a
  // Result verdict derived from the run's own percentile 95% CI. Native-R spike on this exact fixture
  // (sn1-4/ta1-4/ti1-3, matched indProd): TI ~ SNTA interaction B=0.258, SE=0.066, p<.001, 95% CI
  // [0.132, 0.406] - excludes zero by a wide margin, so this run's row must read "Supported" (not just
  // any dash of "Not supported" — the two verdicts differ by more than a "Not " prefix: capital
  // "Supported" only appears verbatim in the affirmative verdict).
  const structural = page.locator('#table-cb-sem-structural-paths')
  await expect(structural).toContainText('×')       // interaction path label ("SN → TI × TA")
  await expect(structural).toContainText(/H\d/)      // H-numbered hypothesis row
  await expect(structural).toContainText('Supported')

  // Conditional-effects table (-1SD / mean / +1SD simple slopes, same fitted quantities as the figure)
  // + the two-line interaction chart itself (R4 - replaces the whisker figure).
  await expect(page.locator('#table-cb-sem-conditional-effects')).toBeVisible()
  await expect(page.getByRole('img', { name: /interaction plot/i })).toBeVisible()
})
