import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'

// ── Helpers (copied from anova.spec.ts — module-local, byte-untouched) ─────────

async function dragChip(page: Page, chip: string, roleId: string) {
  const src = page.locator('.chip', { hasText: chip }).first()
  const dst = page.locator(`[data-role="${roleId}"]`)
  const a = (await src.boundingBox())!, b = (await dst.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

async function configureStep(page: Page, stepName: RegExp, drags: [string, string][]) {
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: stepName }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(stepName, { timeout: 1000 })
  }).toPass()
  for (const [chip, role] of drags) {
    await dragChip(page, chip, role)
    // For multi-chip roles the slot has multiple .chip.assigned — check that at least one contains the chip text
    await expect(page.locator(`[data-role="${role}"]`)).toContainText(chip)
  }
}

async function runAnalysis(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Run analysis' }).click()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 1000 })
  }).toPass()
}

// ── Journey: four regression tests ───────────────────────────────────────────

test('Journey: regression — simple, multiple (β em-dash→fill), logistic (event flip inverts OR, AUC invariant), Poisson→NB (theta)', async ({ page }) => {
  // ── 1. Upload & Terms guide ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/regression.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // ── 2. Configure data: defaults are fine (numerics ratio, strings nominal; complaints auto-tags count) ──
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── 3. Pick tests (catalog order) ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  for (const name of ['Simple linear regression', 'Multiple linear regression', 'Logistic regression', 'Poisson / negative binomial'])
    await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── 4. Configure: Simple linear — post_score → outcome, pre_score → predictor ──
  await expect(page.locator('.eyebrow').first()).toContainText('Simple linear regression')
  await dragChip(page, 'post_score', 'outcome')
  await expect(page.locator('[data-role="outcome"]')).toContainText('post_score')
  await dragChip(page, 'pre_score', 'predictor')
  await expect(page.locator('[data-role="predictor"]')).toContainText('pre_score')

  // ── Configure: Multiple linear — standardize stays drawn-OFF ──
  await configureStep(page, /Multiple linear regression/, [
    ['post_score', 'outcome'],
    ['pre_score', 'predictors'],
    ['age', 'predictors'],
    ['group', 'predictors'],
    ['method', 'predictors'],
  ])

  // ── Configure: Logistic — event-category pill is the disabled — placeholder until the outcome drops, then defaults to the SECOND level ──
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: /Logistic regression/ }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(/Logistic regression/, { timeout: 1000 })
  }).toPass()
  await expect(page.getByLabel('event category')).toBeDisabled() // placeholder state (recorded decision 5)
  await dragChip(page, 'passed', 'outcome')
  await expect(page.locator('[data-role="outcome"]')).toContainText('passed')
  await expect(page.getByLabel('event category')).toBeEnabled()
  await expect(page.getByLabel('event category')).toHaveValue('yes') // second level alphabetically (B2)
  await dragChip(page, 'pre_score', 'predictors')
  await expect(page.locator('[data-role="predictors"]')).toContainText('pre_score')
  await dragChip(page, 'age', 'predictors')
  await expect(page.locator('[data-role="predictors"]')).toContainText('age')
  await dragChip(page, 'group', 'predictors')
  await expect(page.locator('[data-role="predictors"]')).toContainText('group')

  // ── Configure: Poisson / NB — count outcome + optional Exposure slot; model stays drawn Poisson ──
  await configureStep(page, /Poisson \/ negative binomial/, [
    ['complaints', 'outcome'],
    ['age', 'predictors'],
    ['group', 'predictors'],
    ['months_observed', 'exposure'],
  ])

  // ── 5. Run 1 (drawn defaults); wait for Download enabled ──
  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 360_000 })

  // ── 6. Run-1 assertions (spike numbers, house 2dp) ──

  // Simple linear: coef table now carries the GOF footer (Model fit merged in) — R²=0.66, F=73.57, RMSE=5.46
  // (the old separate sigma=5.61 + F-p row are gone); coefficients B=0.64, β=0.81 (always filled — no standardize pill)
  const slCoef = page.locator('#table-simple-linear-coefficients')
  await expect(slCoef).toContainText('0.66')   // GOF R²
  await expect(slCoef).toContainText('73.57')  // GOF F
  await expect(slCoef).toContainText('5.46')   // GOF RMSE (replaces the old sigma=5.61 model-fit cell)
  await expect(slCoef).toContainText('0.64')
  await expect(slCoef).toContainText('0.81')
  await expect(page.getByText('A simple linear regression gave B=0.64, t(38)=8.58, p < .001, R²=.66.')).toBeVisible()

  // Multiple linear: standardize OFF → β cells are em-dash (asserted FIRST, before the flip); VIF filled (GVIF convention)
  const mlCoef = page.locator('#table-multiple-linear-coefficients')
  await expect(mlCoef).toContainText('—')        // the masked β cells (R1 off-state)
  await expect(mlCoef).toContainText('1.25')     // VIF pre_score AND (GVIF^(1/(2·Df)))² for method
  await expect(mlCoef).toContainText('1.41')     // VIF age
  await expect(mlCoef).toContainText('5.35')     // B group: b
  await expect(mlCoef).toContainText('group: b') // dummy-row naming (convention 1)
  await expect(mlCoef).toContainText('−2.05')    // B method: online — U+2212 minus
  await expect(mlCoef).toContainText('20.42')     // GOF F now lives in the coef table footer (Model fit merged in)
  await expect(page.getByText('The model explained R²=.75 of the variance, F(5,34)=20.42, p < .001; predictor pre_score gave B=0.61, p < .001.')).toBeVisible()

  // Logistic (event yes): coef table now carries the glm GOF footer (Model fit merged in) — Nagelkerke=0.28,
  // omnibus χ²="9.54 (p .023)", AIC=53.91, Log.Lik=−22.95 (the old −2LL=45.91 row is gone). OR group: b = 3.46
  // [0.87, 15.44]; classification 65.0%; AUC in APA.
  const lgCoef = page.locator('#table-logistic-coefficients')
  await expect(lgCoef).toContainText('53.91')  // GOF AIC
  await expect(lgCoef).toContainText('0.28')   // GOF Nagelkerke R²
  await expect(lgCoef).toContainText('9.54')   // GOF omnibus χ²
  await expect(lgCoef).toContainText('.023')   // omnibus p (inline in the χ² cell)
  await expect(lgCoef).toContainText('3.46')
  await expect(lgCoef).toContainText('[0.87, 15.44]')
  const lgClass = page.locator('#table-classification')
  await expect(lgClass).toContainText('no')      // real level names as headers (convention 7)
  await expect(lgClass).toContainText('yes')
  await expect(lgClass).toContainText('65.0%')
  await expect(page.getByText('Predictor pre_score was associated with the outcome, OR=1.08, 95% CI [1.01, 1.18], p = .035 (AUC=.76).')).toBeVisible()

  // Poisson (offset model): coef table now carries the glm GOF footer (Model fit merged in) — AIC=202.37,
  // deviance=67.57, df=37, dispersion ratio=1.69; IRR age = 1.01
  const poCoef = page.locator('#table-poisson-nb-coefficients')
  await expect(poCoef).toContainText('202.37')  // GOF AIC
  await expect(poCoef).toContainText('67.57')   // GOF Residual deviance
  await expect(poCoef).toContainText('37')      // GOF df
  await expect(poCoef).toContainText('1.69')    // GOF Dispersion ratio
  await expect(page.getByText('Predictor age was associated with the count, IRR=1.01, 95% CI [1.00, 1.02], p = .007.')).toBeVisible()

  // ── 7. Flip all three config switches (each edit stales ALL runs — journey-B rule), then re-run once ──
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: /Multiple linear regression/ }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(/Multiple linear regression/, { timeout: 1000 })
  }).toPass()
  await page.getByLabel(/standardize/).check()
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: /Logistic regression/ }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(/Logistic regression/, { timeout: 1000 })
  }).toPass()
  await page.getByLabel('event category').selectOption('no')
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: /Poisson \/ negative binomial/ }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(/Poisson \/ negative binomial/, { timeout: 1000 })
  }).toPass()
  await page.getByLabel('model').selectOption('negative binomial')
  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 360_000 })

  // ── 8. Run-2 assertions ──

  // Multiple linear: standardize ON → β fills (R1)
  await expect(page.locator('#table-multiple-linear-coefficients')).toContainText('0.78')   // β pre_score
  await expect(page.locator('#table-multiple-linear-coefficients')).toContainText('−0.22')  // β method: online

  // Logistic (event no): OR group: b INVERTS to 0.29 [0.06, 1.15]; GOF footer AND AUC INVARIANT (spike surprise 4 — NOT 1−AUC)
  await expect(page.locator('#table-logistic-coefficients')).toContainText('0.29')
  await expect(page.locator('#table-logistic-coefficients')).toContainText('[0.06, 1.15]')
  await expect(page.locator('#table-logistic-coefficients')).toContainText('9.54')  // omnibus χ² GOF row invariant under the event flip
  await expect(page.getByText('Predictor pre_score was associated with the outcome, OR=0.92, 95% CI [0.85, 0.99], p = .035 (AUC=.76).')).toBeVisible()

  // Negative binomial (offset): theta replaces the dispersion ratio in the SAME GOF cell (convention 10) — now in the coef footer
  const nbCoef = page.locator('#table-poisson-nb-coefficients')
  await expect(nbCoef).toContainText('200.10')  // GOF AIC
  await expect(nbCoef).toContainText('45.81')   // GOF Residual deviance
  await expect(nbCoef).toContainText('9.00')    // GOF Dispersion = theta

  // ── 9. Download & unzip — assert the exact 11-file path set (NN = selection order; card-faithful names).
  // The per-test "Model fit" table is GONE (merged into each coef table's GOF footer), so table_model-fit.png
  // no longer exists for any test: 15 − 4 = 11.
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-results.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()

  // 01_simple-linear-regression: 3 files (coef table + two figures from one drawn figbox)
  expect(entries).toContain('01_simple-linear-regression/table_coefficients.png')
  expect(entries).toContain('01_simple-linear-regression/figure_fit.png')
  expect(entries).toContain('01_simple-linear-regression/figure_residuals.png')

  // 02_multiple-linear-regression: 3 files (#11 — coef table + residual diagnostics + coefficient plot)
  expect(entries).toContain('02_multiple-linear-regression/table_coefficients.png')
  expect(entries).toContain('02_multiple-linear-regression/figure_residuals.png')
  expect(entries).toContain('02_multiple-linear-regression/figure_coefficient-plot.png')

  // 03_logistic-regression: 3 files (coef table + classification table + ROC figure)
  expect(entries).toContain('03_logistic-regression/table_coefficients.png')
  expect(entries).toContain('03_logistic-regression/table_classification.png')
  expect(entries).toContain('03_logistic-regression/figure_roc.png')

  // 04_poisson-negative-binomial: 2 files (coef table + residuals figure)
  expect(entries).toContain('04_poisson-negative-binomial/table_coefficients.png')
  expect(entries).toContain('04_poisson-negative-binomial/figure_residuals.png')
  expect(entries.filter((e) => /^0[1-4]_/.test(e)).length).toBe(11)
})
