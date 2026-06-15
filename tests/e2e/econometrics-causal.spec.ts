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

// ── Causal journey: IV/2SLS + RDD + PSM on causal.csv ─────────────────────────
// causal.csv: id, wage, educ, educ_iv, score, running_var, health, enroll, exper, age, ability.
test('Causal journey: IV / 2SLS, Regression discontinuity, Propensity score matching', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/causal.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // Configure data: binary `enroll` → nominal (PSM treatment is 2-category). `id` (unique consecutive int)
  // auto-detects id-tagged + Unused — fine, no causal test uses it. Other columns auto-numeric (fine).
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByLabel('level of enroll').selectOption('nominal')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  for (const name of ['Instrumental variables (IV / 2SLS)', 'Regression discontinuity (RDD)', 'Propensity score matching'])
    await page.getByRole('checkbox', { name, exact: true }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await configureStep(page, /Instrumental variables/, [['wage', 'outcome'], ['educ', 'endogenous'],
    ['educ_iv', 'instruments'], ['exper', 'controls']])
  await configureStep(page, /Regression discontinuity/, [['score', 'outcome'], ['running_var', 'running']])
  await configureStep(page, /Propensity score matching/, [['health', 'outcome'], ['enroll', 'treatment'],
    ['exper', 'covariates'], ['age', 'covariates'], ['ability', 'covariates']])

  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 480_000 })

  // Report-only APA sentences (softened / neutralised — no causal "had an effect", no "all SMDs < .1")
  await expect(page.getByText(/The 2SLS estimate for/)).toBeVisible()
  await expect(page.getByText(/At the cutoff, the treatment effect was/)).toBeVisible()
  await expect(page.getByText(/After propensity-score matching, the ATT was/)).toBeVisible()
  await expect(page.getByText(/had an effect of/)).toHaveCount(0)
  await expect(page.getByText(/all SMDs/)).toHaveCount(0)

  // Download & unzip — catalog order among picked is rdd, iv-2sls, psm
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()
  // Zip folders are numbered in selection (checkbox-check) order: IV, RDD, PSM.
  expect(entries).toContain('01_iv-2sls/table_first-stage.png')
  expect(entries).toContain('01_iv-2sls/table_2sls.png')
  expect(entries).toContain('01_iv-2sls/figure_coefficients.png')
  expect(entries).toContain('02_rdd/table_rd-estimate.png')
  expect(entries).toContain('02_rdd/figure_rd-plot.png')
  expect(entries).toContain('03_propensity-score-matching/table_balance.png')
  expect(entries).toContain('03_propensity-score-matching/table_att.png')
  expect(entries).toContain('03_propensity-score-matching/figure_love-plot.png')
})
