import { test, expect, type Page } from '@playwright/test'
import { gotoCard } from './fixtures/helpers'

// T8 (R9, board-clearing slice - owner evidence): with 6 constructs the old default layout drew one
// long overlapping row; constructs 4+ landed OUTSIDE the viewBox until Fit was clicked, and the
// exported figure inherited the mess. Un-dragged constructs now take diamond slots (exogenous left,
// mediators center, terminal right) and the viewBox auto-Fits on every content change - so a
// 6-construct model must be fully visible with NO Fit click. Geometry idiom from
// path-canvas-layout.spec.ts (no analysis run - fast, no WebR).
test('R9: 6-construct latent model auto-lays out and needs NO Fit click (all ovals inside the svg)', async ({ page }) => {
  await gotoCard(page, 'cb-sem', 'scale.csv')   // x1..x9 - enough columns for 6 one-item constructs

  const card = (n: number) =>
    page.locator('.card').filter({ has: page.getByLabel(`Construct ${n} name`) })
  for (let n = 1; n <= 6; n++) {
    await page.getByRole('button', { name: '+ Add construct' }).click()
    await page.getByLabel(`Construct ${n} name`).fill(`C${n}`)
    await card(n).getByRole('checkbox', { name: `x${n}` }).check()
  }
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(6)

  // Draw the diamond: C1/C2 -> C3 (mediator) -> C4/C5 (terminals); C6 stays isolated (exogenous).
  // Construct ids are 1-based in creation order, so data-node-id = n.
  const oval = (id: number) => page.locator(`ellipse[data-node-id="${id}"]`)
  for (const [from, to] of [[1, 3], [2, 3], [3, 4], [3, 5]]) {
    await oval(from).click()
    await oval(to).click()
  }
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(4)

  // NO Fit click anywhere above: every construct oval must sit FULLY inside the svg box.
  const box = async (p: Page, selector: string) => {
    const b = await p.locator(selector).boundingBox()
    expect(b, `${selector} must be visible`).not.toBeNull()
    return b!
  }
  const svg = await box(page, 'svg[id^="figure-path-diagram"]')
  for (let id = 1; id <= 6; id++) {
    const r = (await oval(id).boundingBox())!
    expect(r.x, `oval ${id} left inside svg`).toBeGreaterThan(svg.x)
    expect(r.x + r.width, `oval ${id} right inside svg`).toBeLessThan(svg.x + svg.width)
    expect(r.y, `oval ${id} top inside svg`).toBeGreaterThan(svg.y)
    expect(r.y + r.height, `oval ${id} bottom inside svg`).toBeLessThan(svg.y + svg.height)
  }
})

// Drives the AMOS canvas end-to-end: define constructs in the form, draw a path,
// drag-move a node, delete a path, zoom, run, see estimate overlay + figure.
// NOTE: a renderToStaticMarkup unit test cannot exercise pointer drag — that is why
// the drag/move/zoom assertions live here, mirroring association.spec.ts's mouse idiom.

// UNSKIP at the Unit-10 slice gate — needs Unit 4 (cb-sem routing) + Unit 6 (runCbSem)
test('CB-SEM canvas: draw → move → delete → run → estimates + figure', async ({ page }) => {
  await gotoCard(page, 'cb-sem', 'sem.csv')   // fixture with q1..q6 (two 3-item constructs)

  // 1. define two constructs in the construct-slots form (below the canvas).
  // Each construct card renders its OWN copy of every item checkbox, so scope the
  // checkbox lookup to the card carrying that construct's name field (otherwise q4..q6
  // match in both cards → strict-mode violation).
  const card = (n: number) =>
    page.locator('.card').filter({ has: page.getByLabel(`Construct ${n} name`) })
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 1 name').fill('Engagement')
  for (const q of ['q1', 'q2', 'q3']) await card(1).getByRole('checkbox', { name: q }).check()
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 2 name').fill('Loyalty')
  for (const q of ['q4', 'q5', 'q6']) await card(2).getByRole('checkbox', { name: q }).check()

  // 2. two ovals appear on the canvas
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(2)

  // 3. DRAW a path: Draw tool is default → click source oval then target oval
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-node-id]').nth(1).click()
  // a directed line with the shared arrowhead marker now exists
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)

  // 4. MOVE: switch to Move, drag the second node by ~80px; its x changes.
  // exact:true — substring "move" also matches the "Remove construct N" buttons.
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  const node = page.locator('[data-node-id]').nth(1)
  const a = await node.boundingBox()
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2)
  await page.mouse.down()
  await page.mouse.move(a!.x + a!.width / 2 + 80, a!.y + a!.height / 2 + 40, { steps: 12 })
  await page.mouse.up()
  const b = await node.boundingBox()
  expect(b!.x).toBeGreaterThan(a!.x + 20)

  // 5. DELETE the path: switch to Delete, click the mid-path handle
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(0)

  // re-draw before running
  await page.getByRole('button', { name: 'Draw path', exact: true }).click()
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-node-id]').nth(1).click()

  // 6. ZOOM does not crash and keeps the diagram present
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(2)

  // 6b. select the EFA pipeline stage (T1b, R1 board-clearing slice) so the run below also proves
  // the Tables E1/E2 preamble renders end-to-end (runner EFA stage -> builder -> card).
  await page.getByRole('checkbox', { name: 'Exploratory factor analysis (EFA)' }).check()

  // 7. RUN → results screen → annotated path diagram with a standardized β label
  await page.getByRole('button', { name: /run/i }).click()
  await expect(page.locator('svg[id^="figure-path-diagram-"]')).toBeVisible({ timeout: 240_000 })

  // 7b. the EFA stage's Tables E1/E2 render (DOM ids = table-<registry table id>; the registry
  // declares no domId override for these, matching its own bundleFiles pins).
  await expect(page.locator('#table-efa-suitability')).toBeVisible()
  await expect(page.locator('#table-efa-loadings')).toBeVisible()
  // The fitted structural path is annotated with its standardized β at the diagram midpoint.
  // Target the β-label text node specifically (the svg holds ~16 text nodes — item labels,
  // loadings, construct/R² — so a bare `svg text` locator would be non-strict).
  // APA estimate annotations are leading-zero-stripped (Task 29): rendered β reads "β = .45"/"β = -.01".
  await expect(page.locator('svg[id^="figure-path-diagram-"] text.sem-path-label')).toContainText(/β\s*=\s*-?\.\d{2}/)
})
