import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'
import { placeColumns } from './fixtures/helpers'

// Path-mode WLSMV journey (Amendment B, spec 2026-07-11-path-mode-wlsmv-design.md): drives the real
// app through the P2 shelf paradigm to prove WLSMV is genuinely wired on the path-analysis card, not
// display-only. Reuses the exact model shape already native-R-pinned as PATH_WLSMV_STRUCT (h1Pins.ts /
// runCbSem.test.ts): `b1 ~ a1 + cont1; b2 ~ b1`, ordered = c("b1","b2"), a1 stays numeric/exogenous.
//
// This model (not the bare 3-node `b1 ~ a1 + cont1` saturated regression) is deliberate: a single-
// outcome regression is ALWAYS saturated (df=0), and buildCbSem.ts only emits the "Estimation" and
// "Ordinal predictors" labelled notes on a NON-saturated path-mode card (saturated cards show only the
// Saturation note). Adding the b2 <- b1 edge makes the model non-saturated (df=2) so those notes
// actually render - while still being "fast, no bootstrap": WLSMV always uses delta-method CIs for
// indirect effects (never bootstrap - that's an ML-only feature, confirmed by runCbSem.test.ts's
// `result.ciMethod === 'delta'` assertion on this exact model).

test('path-analysis WLSMV: shelf placement → ordinal-endogenous gate → run → ordinal disclosures → export', async ({ page }) => {
  test.setTimeout(600_000) // cold WebR boot + lavaan/semTools download; no bootstrap (WLSMV = delta-method CIs)

  // ── 1. Upload + mark a1..a3, b1..b3 ordinal (Configure data); cont1/cont2 stay scale-level ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/likert5-missing.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  for (const c of ['a1', 'a2', 'a3', 'b1', 'b2', 'b3']) {
    await page.getByLabel(`level of ${c}`).selectOption('ordinal')
  }
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── 2. Pick test: Path analysis ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await page.getByRole('checkbox', { name: /path analysis/i }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── 3. P2 shelf model: canvas opens BLANK, all 8 used columns wait as shelf chips ──
  await expect(page.locator('rect.sem-node-rect[data-node-id]')).toHaveCount(0)
  await expect(page.locator('button.chip')).toHaveCount(8)

  // ── 4. Place b1, a1, cont1, b2 from the shelf (order fixes node ids: 0=b1, 1=a1, 2=cont1, 3=b2) ──
  await placeColumns(page, ['b1', 'a1', 'cont1', 'b2'])
  await expect(page.locator('rect.sem-node-rect[data-node-id]')).toHaveCount(4)
  await expect(page.locator('button.chip')).toHaveCount(4) // a2, a3, b3, cont2 remain on the shelf

  // ── 5. WLSMV is NOT yet selectable: a1/b1/b2 are placed and ordinal, but none is endogenous yet
  // (no path has been drawn) - Amendment B's dynamic gate. ──
  const estimatorSelect = page.getByLabel('estimator')
  await expect(estimatorSelect.locator('option[value="WLSMV"]')).toHaveAttribute('disabled', '')
  // role="note" is nameFrom:author (ARIA) - locate by role, assert content separately (same pattern
  // as sem-estimator-mlr.spec.ts). Scoped to the Estimation fieldset (the only role="note" live here).
  const estimationFieldset = page.locator('fieldset').filter({ has: page.locator('legend', { hasText: 'Estimation' }) })
  await expect(estimationFieldset.getByRole('note')).toContainText(
    'WLSMV applies ordered-threshold modeling to ordinal outcome variables; draw a path into an ordinal variable to enable it.',
  )

  // ── 6. Draw b1 <- a1 (id 1 -> id 0): a path now points INTO the ordinal b1 -> WLSMV becomes selectable ──
  const rect = (id: number) => page.locator(`rect.sem-node-rect[data-node-id="${id}"]`)
  await rect(1).click() // a1 (source)
  await rect(0).click() // b1 (target)
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)
  await expect(estimatorSelect.locator('option[value="WLSMV"]')).not.toHaveAttribute('disabled')

  // ── 7. Complete the PATH_WLSMV_STRUCT model: b1 <- cont1, b2 <- b1 ──
  await rect(2).click() // cont1 (source)
  await rect(0).click() // b1 (target)
  await rect(0).click() // b1 (source)
  await rect(3).click() // b2 (target)
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(3)

  // ── 8. Select WLSMV, then run (fast - no bootstrap under WLSMV) ──
  await estimatorSelect.selectOption('WLSMV')
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('#table-path-analysis-structural-paths')).toBeVisible({ timeout: 300_000 })
  await expect(page.getByText(/This test failed:/)).toHaveCount(0)

  // ── 9. Ordinal disclosures: b1 (and b2) are declared ordered; a1 stays exogenous/numeric ──
  const estimationNote = page.locator('p', { hasText: 'Estimation:' })
  await expect(estimationNote).toBeVisible()
  await expect(estimationNote).toContainText('Treated as ordinal: b1')
  const ordinalPredictorsNote = page.locator('p', { hasText: 'Ordinal predictors:' })
  await expect(ordinalPredictorsNote).toBeVisible()
  await expect(ordinalPredictorsNote).toContainText('a1')

  // ── 10. Export: analysis.R carries the real WLSMV fit call with the sanitized ordered= tokens ──
  await page.getByRole('checkbox', { name: 'R script (.R)' }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-export.zip')
  const zip = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
  expect(Object.keys(zip)).toContain('analysis.R')
  const analysisR = new TextDecoder().decode(zip['analysis.R'])
  expect(analysisR).toContain('estimator = "WLSMV"')
  expect(analysisR).toContain('ordered = c("b1", "b2")')
})
