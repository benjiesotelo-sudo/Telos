import { test, expect } from '@playwright/test'
import { gotoCard } from './fixtures/helpers'

// This file starts with the DRAW-GESTURE + GUARD coverage (Unit 4). Unit 11 appends the full
// run -> simple-slopes-figure journey once U5/U6's statistics land -- do not duplicate that here.
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

  // Draw SN -> TA (Draw tool is default): click source oval then target oval.
  // ADJACENT nodes on purpose: the default layout is left-to-right, so an SN->TI path's midpoint
  // would sit exactly under TA's oval (nodes render above the midpoint handle and intercept the click).
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-node-id]').nth(1).click()
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)

  // Self-moderation guard: click SN (the path's own source) then its own path midpoint.
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.getByRole('alert')).toContainText(/cannot moderate its own path/i)

  // Valid gesture: click TI (not in the path) then the SN->TA midpoint.
  await page.locator('[data-node-id]').nth(2).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.locator('.sem-mod-arrow')).toHaveCount(1)

  // Duplicate guard: same moderator, same path again.
  await page.locator('[data-node-id]').nth(2).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.getByRole('alert')).toContainText(/already moderates/i)
})
