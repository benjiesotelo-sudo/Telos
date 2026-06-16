import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'

// ── Helpers (copied from econometrics-timeseries.spec.ts — module-local) ──────
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

// ── Panel journey: Fixed effects + Hausman + DiD on panel.csv ─────────────────
// panel.csv: firm, year, roa, leverage, rd_spend, size, treated, post (12 firms × 8 yrs).
test('Panel journey: Fixed effects, Hausman, Difference-in-differences', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/panel.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Configure data: integer `year` → ordinal (so the Time role accepts it); binary treated/post → nominal
  // (DiD treatment/period are 2-category). `firm` (repeated string) auto-detects nominal — no flip.
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByLabel('level of year').selectOption('ordinal')
  await page.getByLabel('level of treated').selectOption('nominal')
  await page.getByLabel('level of post').selectOption('nominal')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  for (const name of ['Fixed effects', 'Hausman test', 'Difference-in-differences (DiD)'])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  const panelRoles: [string, string][] = [['firm', 'entity'], ['year', 'time'], ['roa', 'outcome'],
    ['leverage', 'regressors'], ['rd_spend', 'regressors'], ['size', 'regressors']]
  await configureStep(page, /Fixed effects/, panelRoles)
  await configureStep(page, /Hausman test/, panelRoles)
  await configureStep(page, /Difference-in-differences/, [['roa', 'outcome'], ['treated', 'treatment'],
    ['post', 'period'], ['firm', 'entity'], ['year', 'time']])

  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 480_000 })

  // Report-only APA sentences render (no verdict language)
  await expect(page.getByText(/In a fixed-effects model, predictor/)).toBeVisible()
  await expect(page.getByText(/A Hausman test comparing the fixed- and random-effects estimates/)).toBeVisible()
  await expect(page.getByText(/The DiD estimate was/)).toBeVisible()
  // Hausman APA carries NO "favoured" verdict
  await expect(page.getByText(/favoured fixed effects/)).toHaveCount(0)

  // Download & unzip: card-faithful filenames per NN_<id>/ folder
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()
  // FE "Model fit" table is GONE — merged into the coef table's GOF footer (no table_model-fit.png).
  expect(entries).toContain('01_fixed-effects/table_coefficients.png')
  expect(entries).toContain('01_fixed-effects/figure_coefficients.png')
  // Hausman is now ONE side-by-side FE|RE coef table (the separate FE-vs-RE table is gone — no table_fe-vs-re.png).
  expect(entries).toContain('02_hausman-test/table_hausman.png')
  expect(entries).toContain('02_hausman-test/figure_coefficients.png')
  expect(entries).toContain('03_did/table_did.png')
  expect(entries).toContain('03_did/figure_parallel-trends.png')
})
