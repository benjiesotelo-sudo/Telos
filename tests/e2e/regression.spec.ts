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

  // Simple linear: fit R²=0.66, F=73.57, p<.001, SE(sigma)=5.61; coefficients B=0.64, β=0.81 (always filled — no standardize pill)
  const slFit = page.locator('#table-simple-linear-model-fit')
  await expect(slFit).toContainText('0.66')
  await expect(slFit).toContainText('73.57')
  await expect(slFit).toContainText('<.001')
  await expect(slFit).toContainText('5.61')
  const slCoef = page.locator('#table-simple-linear-coefficients')
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
  await expect(page.locator('#table-multiple-linear-model-fit')).toContainText('20.42')
  await expect(page.getByText('The model explained R²=.75 of the variance, F(5,34)=20.42, p < .001; predictor pre_score gave B=0.61, p < .001.')).toBeVisible()

  // Logistic (event yes): fit −2LL=45.91, Nagelkerke=0.28, omnibus 9.54/.023; OR group: b = 3.46 [0.87, 15.44]; classification 65.0%; AUC in APA
  const lgFit = page.locator('#table-logistic-model-fit')
  await expect(lgFit).toContainText('45.91')
  await expect(lgFit).toContainText('53.91')
  await expect(lgFit).toContainText('0.28')
  await expect(lgFit).toContainText('9.54')
  await expect(lgFit).toContainText('.023')
  const lgCoef = page.locator('#table-logistic-coefficients')
  await expect(lgCoef).toContainText('3.46')
  await expect(lgCoef).toContainText('[0.87, 15.44]')
  const lgClass = page.locator('#table-classification')
  await expect(lgClass).toContainText('no')      // real level names as headers (convention 7)
  await expect(lgClass).toContainText('yes')
  await expect(lgClass).toContainText('65.0%')
  await expect(page.getByText('Predictor pre_score was associated with the outcome, OR=1.08, 95% CI [1.01, 1.18], p = .035 (AUC=.76).')).toBeVisible()

  // Poisson (offset model): AIC=202.37, deviance=67.57, df=37, dispersion ratio=1.69; IRR age = 1.01
  const poFit = page.locator('#table-poisson-nb-model-fit')
  await expect(poFit).toContainText('202.37')
  await expect(poFit).toContainText('67.57')
  await expect(poFit).toContainText('37')
  await expect(poFit).toContainText('1.69')
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

  // Logistic (event no): OR group: b INVERTS to 0.29 [0.06, 1.15]; fit row AND AUC INVARIANT (spike surprise 4 — NOT 1−AUC)
  await expect(page.locator('#table-logistic-coefficients')).toContainText('0.29')
  await expect(page.locator('#table-logistic-coefficients')).toContainText('[0.06, 1.15]')
  await expect(page.locator('#table-logistic-model-fit')).toContainText('45.91')
  await expect(page.getByText('Predictor pre_score was associated with the outcome, OR=0.92, 95% CI [0.85, 0.99], p = .035 (AUC=.76).')).toBeVisible()

  // Negative binomial (offset): theta replaces the dispersion ratio in the SAME cell (convention 10)
  const nbFit = page.locator('#table-poisson-nb-model-fit')
  await expect(nbFit).toContainText('200.10')
  await expect(nbFit).toContainText('45.81')
  await expect(nbFit).toContainText('9.00')

  // ── 9. Download & unzip — assert the exact 15-file path set (NN = selection order; card-faithful names) ──
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-results.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()

  // 01_simple-linear-regression: 4 files (two figures from one drawn figbox)
  expect(entries).toContain('01_simple-linear-regression/table_model-fit.png')
  expect(entries).toContain('01_simple-linear-regression/table_coefficients.png')
  expect(entries).toContain('01_simple-linear-regression/figure_fit.png')
  expect(entries).toContain('01_simple-linear-regression/figure_residuals.png')

  // 02_multiple-linear-regression: 4 files (#11 — residual diagnostics + coefficient plot)
  expect(entries).toContain('02_multiple-linear-regression/table_model-fit.png')
  expect(entries).toContain('02_multiple-linear-regression/table_coefficients.png')
  expect(entries).toContain('02_multiple-linear-regression/figure_residuals.png')
  expect(entries).toContain('02_multiple-linear-regression/figure_coefficient-plot.png')

  // 03_logistic-regression: 4 files
  expect(entries).toContain('03_logistic-regression/table_model-fit.png')
  expect(entries).toContain('03_logistic-regression/table_coefficients.png')
  expect(entries).toContain('03_logistic-regression/table_classification.png')
  expect(entries).toContain('03_logistic-regression/figure_roc.png')

  // 04_poisson-negative-binomial: 3 files
  expect(entries).toContain('04_poisson-negative-binomial/table_model-fit.png')
  expect(entries).toContain('04_poisson-negative-binomial/table_coefficients.png')
  expect(entries).toContain('04_poisson-negative-binomial/figure_residuals.png')
  expect(entries.filter((e) => /^0[1-4]_/.test(e)).length).toBe(15)
})
