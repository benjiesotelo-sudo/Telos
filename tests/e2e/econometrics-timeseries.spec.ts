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
    await expect(page.locator(`[data-role="${role}"]`)).toContainText(chip)
  }
}
async function runAnalysis(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Run analysis' }).click()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 1000 })
  }).toPass()
}

// ── Time-series journey: ARIMA + Stationarity + Granger + VAR on timeseries.csv ──
test('Time-series journey: ARIMA, Stationarity (ADF/KPSS/PP), Granger, VAR', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/timeseries.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Configure data: `month` auto-detects as datetime (Used) — the Time role accepts it, numeric Series roles
  // exclude it. No flips needed (contrast the RM subject_id flip).
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  for (const name of ['ARIMA / SARIMA', 'Stationarity tests (ADF, KPSS)', 'Granger causality', 'VAR'])
    await page.getByRole('checkbox', { name, exact: true }).check() // exact: "VAR" else substring-matches "Variable" checkboxes
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ARIMA: month→Time, sales→Series
  await expect(page.locator('.eyebrow').first()).toContainText('ARIMA / SARIMA')
  await dragChip(page, 'month', 'time')
  await expect(page.locator('[data-role="time"] .chip.assigned')).toContainText('month')
  await dragChip(page, 'sales', 'series')
  await expect(page.locator('[data-role="series"] .chip.assigned')).toContainText('sales')
  await expect(page.getByLabel('order')).toHaveValue('auto-select')

  await configureStep(page, /Stationarity tests/, [['month', 'time'], ['sales', 'series']])
  await configureStep(page, /Granger causality/, [['month', 'time'], ['ad_spend', 'seriesX'], ['sales', 'seriesY']])
  await configureStep(page, /\bVAR\b/, [['month', 'time'], ['sales', 'series'], ['visitors', 'series']]) // step label is "N · VAR" — match VAR as a word, not anchored

  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 480_000 })

  // ── Report-only APA sentences render (no verdict language) ──
  await expect(page.getByText(/An ARIMA\(/)).toBeVisible()
  await expect(page.getByText(/ADF gave/)).toBeVisible()
  await expect(page.getByText(/Granger test X→Y:/)).toBeVisible()
  await expect(page.getByText(/A VAR\(/)).toBeVisible()

  // ── §2.5 econometrics-grade additions render ──
  // Stationarity shows all three tests (ADF, KPSS, Phillips–Perron)
  const results = page.getByRole('main')
  await expect(results).toContainText('ADF')
  await expect(results).toContainText('KPSS')
  await expect(results).toContainText('PP')           // Phillips–Perron row (§2.5)
  await expect(results).toContainText('variance decomposition') // VAR FEVD table (§2.5)

  // ── Download & unzip: card-faithful filenames incl. the §2.5 additions ──
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-results.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()

  // 01_arima-sarima — the old separate "diagnostics" table is GONE (merged into the Model summary coef GOF footer);
  // 2 tables (Model summary + Forecast) + forecast figure + §2.5 residual-diagnostics figure
  expect(entries).toContain('01_arima-sarima/table_model-summary.png')
  expect(entries).toContain('01_arima-sarima/table_forecast.png')
  expect(entries).toContain('01_arima-sarima/figure_forecast.png')
  expect(entries).toContain('01_arima-sarima/figure_residuals.png')      // §2.5
  // 02_stationarity-tests — table + two figures
  expect(entries).toContain('02_stationarity-tests/table_stationarity.png')
  expect(entries).toContain('02_stationarity-tests/figure_series.png')
  expect(entries).toContain('02_stationarity-tests/figure_acf.png')
  // 03_granger-causality
  expect(entries).toContain('03_granger-causality/table_granger.png')
  expect(entries).toContain('03_granger-causality/figure_cross-series.png')
  // 04_var — lag selection + coefficients + §2.5 FEVD + IRF figure
  expect(entries).toContain('04_var/table_lag-selection.png')
  expect(entries).toContain('04_var/table_var-coefficients.png')
  expect(entries).toContain('04_var/table_fevd.png')                     // §2.5
  expect(entries).toContain('04_var/figure_irf.png')
})
