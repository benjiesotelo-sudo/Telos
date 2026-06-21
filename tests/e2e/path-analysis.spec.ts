import { test, expect } from '@playwright/test'

// Path-analysis end-to-end: the canvas→runner bridge. Path mode derives its nodes from the USED
// columns (drawn as RECTANGLES, not ovals — no measurement model), so there is no construct-slots
// form to fill: goto the card → the canvas already shows a rectangle per used column → draw a chain
// of paths (x1 → x4 → x7, an indirect/mediation triple) → Run → lavaan::sem fits the observed
// variables and a Structural paths table appears. The assertion that matters: the run PRODUCES A
// RESULT (no per-test error card), proving the bridge wires UI → state → runner.
//
// gotoCard builds /<cardId>/i for the pick-test checkbox; the path-analysis label is "Path analysis",
// so we inline the flow here with a name-matching regex instead of using the shared helper.

test('path-analysis: column nodes → draw chain → run → structural-paths result', async ({ page }) => {
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

  // 1. Path mode renders one observed-column RECTANGLE per used column (NOT latent ovals).
  await expect(page.locator('rect.sem-node-rect[data-node-id]')).toHaveCount(4)
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(0)

  // 2. Draw is the default tool. The canvas node id = index into the used-columns list (x1..x4),
  //    so data-node-id 0 = x1, 1 = x2, 2 = x3, 3 = x4. Draw a chain x1 → x2 → x3 (indirect effect)
  //    PLUS an edge x2 → x4: node index 3 must be clickable (regression: it used to be off-canvas).
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

  // 3. RUN — real lavaan::sem on observed variables (cold WebR boot + bootstrap → generous timeout).
  await page.getByRole('button', { name: 'Run analysis' }).click()

  // 4. A RESULT, not an error card: the Structural paths table renders. (Bridge proven.)
  //    The mediation chain triggers a 5k-resample bootstrap, so allow a generous wait on a cold run.
  await expect(page.locator('#table-path-analysis-structural-paths')).toBeVisible({ timeout: 600_000 })
  await expect(page.locator('#table-path-analysis-structural-paths').getByRole('row')).not.toHaveCount(0)
  // No per-test failure card (the bridge resolved path ids → column names → a valid lavaan model).
  await expect(page.getByText(/This test failed:/)).toHaveCount(0)
})
