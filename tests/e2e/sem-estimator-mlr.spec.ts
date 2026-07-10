import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'

// H1 wiring (Task 11): drives the estimator/missing dropdowns through the real app, not just unit
// tests on semFitArgs/runCbSem/buildCbSem in isolation. Uses likert5.csv (complete, no NAs) so the
// FIML/listwise distinction doesn't matter for run success - FIML is picked to exercise the UI wiring
// and the export fragment, not to prove missing-data handling (that's Task 0/3's job).
//
// Model: three constructs (no mediation chain, so no bootstrap even under ML - keeps this fast and
// keeps the "no se = bootstrap" export assertion meaningful under MLR, which never bootstraps anyway):
//   A (a1, a2, a3) - ordinal Likert items
//   C (cont1, cont2) - continuous items
//   B (b1, b2, b3) - ordinal Likert items, the outcome construct
// Paths: B <- A, B <- C (direct paths only).

test('CB-SEM: MLR + FIML journey - robust fit labels, Estimation disclosure, guarded UI, export fragment', async ({ page }) => {
  test.setTimeout(600_000) // cold WebR boot + lavaan/semTools download + CFA/structural fit

  // ── 1. Upload ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/likert5.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // ── 2. Configure data: a1..a3 + b1..b3 ordinal (Likert items), cont1/cont2 stay scale-level (ratio,
  // their auto-detected default for continuous floats - no 'scale' level exists in this app; ratio IS
  // the scale-type level for numeric columns here) ──
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  for (const c of ['a1', 'a2', 'a3', 'b1', 'b2', 'b3']) {
    await page.getByLabel(`level of ${c}`).selectOption('ordinal')
  }
  for (const c of ['cont1', 'cont2']) {
    await expect(page.getByLabel(`level of ${c}`)).toHaveValue('ratio') // scale-level, already the auto-detected default
  }
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── 3. Pick test: CB-SEM ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await page.getByRole('checkbox', { name: /cb-sem/i }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── 4. Construct-slots form: A(a1..a3), C(cont1,cont2), B(b1..b3) - order matters, it fixes canvas
  // node index 0=A, 1=C, 2=B for the path-drawing gesture below. ──
  const card = (n: number) => page.locator('.card').filter({ has: page.getByLabel(`Construct ${n} name`) })
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 1 name').fill('A')
  for (const q of ['a1', 'a2', 'a3']) await card(1).getByRole('checkbox', { name: q }).check()
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 2 name').fill('C')
  for (const q of ['cont1', 'cont2']) await card(2).getByRole('checkbox', { name: q }).check()
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 3 name').fill('B')
  for (const q of ['b1', 'b2', 'b3']) await card(3).getByRole('checkbox', { name: q }).check()

  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(3)

  // ── 5. Canvas: draw B <- A (click A then B) and B <- C (click C then B). Draw tool is the default. ──
  await page.locator('[data-node-id]').nth(0).click() // A
  await page.locator('[data-node-id]').nth(2).click() // B
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)
  await page.locator('[data-node-id]').nth(1).click() // C
  await page.locator('[data-node-id]').nth(2).click() // B
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(2)

  // ── 6. Estimation fieldset: pick MLR first (the missing-dropdown guard + bootstrap-disabled state
  // both key off the estimator) ──
  await page.getByLabel('estimator').selectOption('MLR')

  // ── 7. Assert pre-run UI: bootstrap fieldset disabled + its note visible, pairwise disabled under MLR ──
  await expect(page.getByRole('radio', { name: '1k' })).toBeDisabled()
  await expect(page.getByRole('radio', { name: '5k' })).toBeDisabled()
  await expect(page.getByRole('radio', { name: '10k' })).toBeDisabled()
  await expect(page.getByLabel('bootstrap resamples')).toBeDisabled()
  // role="note" is nameFrom:author (ARIA) - plain text content never becomes its accessible name, so
  // getByRole(..., { name }) can never match here; locate by role, assert content separately (same
  // pattern as sem-moderation.spec.ts's getByRole('alert') + toContainText).
  const bootstrapFieldset = page.locator('fieldset').filter({ has: page.locator('legend', { hasText: 'Bootstrap' }) })
  await expect(bootstrapFieldset.getByRole('note')).toContainText(
    'Bootstrap CIs require the ML estimator; MLR/WLSMV report their own robust standard errors and delta-method CIs.',
  )
  // toBeDisabled() doesn't recognize <option disabled> (Playwright's disabled-state check isn't wired
  // for the option tag) - assert the attribute directly instead.
  const missingSelect = page.getByLabel('missing data')
  await expect(missingSelect.locator('option', { hasText: 'Pairwise' })).toHaveAttribute('disabled', '')

  // ── 8. Pick FIML in the missing-data dropdown ──
  await missingSelect.selectOption('fiml')

  // ── 9. Run ──
  // "Results" heading appears immediately on navigation (rendered whether the run is still in flight
  // or done - see ResultsScreen.tsx) - a short wait only confirms navigation happened. The real
  // completion proxy is the fit table becoming visible, which needs the generous cold-WebR-boot +
  // lavaan/semTools-install + CFA/structural-fit timeout (mirrors sem-a.spec.ts's Download-enabled wait).
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 5_000 })

  // ── 10. Assert results ──

  // Fit table: MLR relabels chisq "(scaled)" and cfi/tli/rmsea "(robust)".
  const fitTable = page.locator('#table-fit-indices')
  await expect(fitTable).toBeVisible({ timeout: 480_000 })
  await expect(page.getByText(/This test failed:/)).toHaveCount(0)
  await expect(fitTable).toContainText('(scaled)')
  await expect(fitTable).toContainText('(robust)')

  // Estimation labelled note names the estimator + missing method actually used.
  const estimationNote = page.locator('p', { hasText: 'Estimation:' })
  await expect(estimationNote).toBeVisible()
  await expect(estimationNote).toContainText('MLR')
  await expect(estimationNote).toContainText('FIML')

  // APA template sentence always names the estimator.
  const apaText = page.locator('p', { hasText: 'APA template:' })
  await expect(apaText).toContainText('robust maximum likelihood (MLR)')

  // ── 11. Export: R script - analysis.R carries the exact fitArgs fragment, and (no mediation chain,
  // MLR never bootstraps anyway) never emits a bootstrap fit call. ──
  await page.getByRole('checkbox', { name: 'R script (.R)' }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-export.zip')
  const zip = unzipSync(new Uint8Array(readFileSync((await download.path())!)))
  expect(Object.keys(zip)).toContain('analysis.R')
  const analysisR = new TextDecoder().decode(zip['analysis.R'])
  expect(analysisR).toContain('estimator = "MLR", missing = "ml"')
  expect(analysisR).not.toContain('se = "bootstrap"')
})
