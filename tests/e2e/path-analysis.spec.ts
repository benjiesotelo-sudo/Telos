import { test, expect } from '@playwright/test'
import { placeColumns } from './fixtures/helpers'

// Path-analysis end-to-end: the canvas→runner bridge. Path mode derives its nodes from the PLACED
// columns (drawn as RECTANGLES, not ovals - no measurement model). Since the P2 shelf model (spec
// Amendment A, 2026-07-11) the canvas opens BLANK - every used-eligible column waits as a chip on
// a shelf below the svg - so the journey now: goto the card → assert the empty-start state (no
// nodes, full shelf) → place the four used columns from the shelf (in x1..x4 order, fixing node ids
// 0..3) → draw a chain of paths (x1 → x4 → x7 through those ids, an indirect/mediation triple) →
// Run → lavaan::sem fits the observed variables and a Structural paths table appears. The assertion
// that matters: the run PRODUCES A RESULT (no per-test error card), proving the bridge wires
// UI → state → runner.
//
// gotoCard builds /<cardId>/i for the pick-test checkbox; the path-analysis label is "Path analysis",
// so we inline the flow here with a name-matching regex instead of using the shared helper.

test('path-analysis: shelf placement → column nodes → draw chain → run → structural-paths result', async ({ page }) => {
  test.setTimeout(900_000) // cold WebR boot + lavaan/semTools download + 5k-resample mediation bootstrap
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/scale.csv') // x1..x9, all numeric → all used
  await page.getByRole('button', { name: 'Continue' }).click()                  // terms guide
  // Configure-data: keep x1..x4 used (FOUR columns). The path-mode canvas now wraps its nodes into a
  // grid sized to the viewBox, so node index 3 (the previously-overflowing region under the old fixed
  // pitch) is inside the viewBox + clickable. We draw a path INTO node 3 to prove the layout fix.
  for (const c of ['x5', 'x6', 'x7', 'x8', 'x9']) await page.getByLabel(`use ${c}`).uncheck()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()
  await page.getByRole('checkbox', { name: /path analysis/i }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // 1. P2 shelf model: the canvas opens BLANK - no nodes, only latent mode draws ovals - and every
  //    used column (x1..x4) waits as an add-chip on the shelf below the svg.
  await expect(page.locator('rect.sem-node-rect[data-node-id]')).toHaveCount(0)
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(0)
  await expect(page.locator('button.chip')).toHaveCount(4)
  for (const c of ['x1', 'x2', 'x3', 'x4']) await expect(page.getByRole('button', { name: `Add ${c} to the canvas` })).toBeVisible()

  // 2. Place the four columns from the shelf, in x1..x4 order, so node ids land 0=x1, 1=x2, 2=x3, 3=x4
  //    (the same ids the rest of this test relies on).
  await placeColumns(page, ['x1', 'x2', 'x3', 'x4'])
  await expect(page.locator('rect.sem-node-rect[data-node-id]')).toHaveCount(4)
  await expect(page.locator('button.chip')).toHaveCount(0)

  // 3. Draw is the default tool. Draw a chain x1 → x2 → x3 (indirect effect) PLUS an edge x2 → x4:
  //    node index 3 must be clickable (regression: it used to be off-canvas).
  const rect = (id: number) => page.locator(`rect.sem-node-rect[data-node-id="${id}"]`)

  // node index 3 must be in-bounds / clickable (the layout-fix assertion)
  await expect(rect(3)).toBeVisible()

  // chain x1 → x2 (path 1)
  await rect(0).click()
  await rect(1).click()
  // chain x2 → x3 (path 2) — produces an indirect effect x1 → x2 → x3
  await rect(1).click()
  await rect(2).click()
  // edge x2 → x4 (path 3) — exercises drawing a path INTO node index 3 (previously off-canvas)
  await rect(1).click()
  await rect(3).click()

  // three directed structural arrows now exist
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(3)

  // 4. RUN - real lavaan::sem on observed variables (cold WebR boot + bootstrap → generous timeout).
  await page.getByRole('button', { name: 'Run analysis' }).click()

  // 5. A RESULT, not an error card: the Structural paths table renders. (Bridge proven.)
  //    The mediation chain triggers a 5k-resample bootstrap, so allow a generous wait on a cold run.
  await expect(page.locator('#table-path-analysis-structural-paths')).toBeVisible({ timeout: 600_000 })
  await expect(page.locator('#table-path-analysis-structural-paths').getByRole('row')).not.toHaveCount(0)
  // No per-test failure card (the bridge resolved path ids → column names → a valid lavaan model).
  await expect(page.getByText(/This test failed:/)).toHaveCount(0)
})
