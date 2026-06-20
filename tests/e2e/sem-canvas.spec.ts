import { test, expect } from '@playwright/test'
import { gotoCard } from './fixtures/helpers'

// Drives the AMOS canvas end-to-end: define constructs in the form, draw a path,
// drag-move a node, delete a path, zoom, run, see estimate overlay + figure.
// NOTE: a renderToStaticMarkup unit test cannot exercise pointer drag — that is why
// the drag/move/zoom assertions live here, mirroring association.spec.ts's mouse idiom.

// UNSKIP at the Unit-10 slice gate — needs Unit 4 (cb-sem routing) + Unit 6 (runCbSem)
test.skip('CB-SEM canvas: draw → move → delete → run → estimates + figure', async ({ page }) => {
  await gotoCard(page, 'cb-sem', 'sem.csv')   // fixture with q1..q6 (two 3-item constructs)

  // 1. define two constructs in the construct-slots form (below the canvas)
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 1 name').fill('Engagement')
  for (const q of ['q1', 'q2', 'q3']) await page.getByRole('checkbox', { name: q }).check()
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 2 name').fill('Loyalty')
  for (const q of ['q4', 'q5', 'q6']) await page.getByRole('checkbox', { name: q }).check()

  // 2. two ovals appear on the canvas
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(2)

  // 3. DRAW a path: Draw tool is default → click source oval then target oval
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-node-id]').nth(1).click()
  // a directed line with the shared arrowhead marker now exists
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)

  // 4. MOVE: switch to Move, drag the second node by ~80px; its x changes
  await page.getByRole('button', { name: 'Move' }).click()
  const node = page.locator('[data-node-id]').nth(1)
  const a = await node.boundingBox()
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2)
  await page.mouse.down()
  await page.mouse.move(a!.x + a!.width / 2 + 80, a!.y + a!.height / 2 + 40, { steps: 12 })
  await page.mouse.up()
  const b = await node.boundingBox()
  expect(b!.x).toBeGreaterThan(a!.x + 20)

  // 5. DELETE the path: switch to Delete, click the mid-path handle
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(0)

  // re-draw before running
  await page.getByRole('button', { name: 'Draw path' }).click()
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-node-id]').nth(1).click()

  // 6. ZOOM does not crash and keeps the diagram present
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(2)

  // 7. RUN → results screen → annotated path diagram with a standardized β label
  await page.getByRole('button', { name: /run/i }).click()
  await expect(page.locator('svg[id^="figure-path-diagram-"]')).toBeVisible({ timeout: 240_000 })
  await expect(page.locator('svg[id^="figure-path-diagram-"] text')).toContainText(/0\.\d{2}/)
})
