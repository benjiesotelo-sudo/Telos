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

// ── Journey: six association tests with custom-props gate ─────────────────────

test('Journey: association — Pearson, Spearman, Kendall, χ² independence, χ² GoF (custom props gate), Fisher', async ({ page }) => {
  // ── 1. Upload & Terms guide ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/association.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // ── 2. Configure data: set satisfaction and motivation to ordinal ──
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByLabel('level of satisfaction').selectOption('ordinal')
  await page.getByLabel('level of motivation').selectOption('ordinal')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── 3. Pick tests (catalog order) ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  for (const name of ['Pearson', 'Spearman', "Kendall's tau", 'Chi-square independence', 'Chi-square goodness-of-fit', "Fisher's exact"])
    await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── 4. Configure: Pearson — hours_studied → variableA, exam_score → variableB ──
  await expect(page.locator('.eyebrow').first()).toContainText('Pearson')
  await dragChip(page, 'hours_studied', 'variableA')
  await expect(page.locator('[data-role="variableA"]')).toContainText('hours_studied')
  await dragChip(page, 'exam_score', 'variableB')
  await expect(page.locator('[data-role="variableB"]')).toContainText('exam_score')

  // ── Configure: Spearman — satisfaction → variableA, motivation → variableB ──
  await configureStep(page, /Spearman/, [
    ['satisfaction', 'variableA'],
    ['motivation', 'variableB'],
  ])

  // ── Configure: Kendall's tau — satisfaction → variableA, motivation → variableB ──
  await configureStep(page, /Kendall/, [
    ['satisfaction', 'variableA'],
    ['motivation', 'variableB'],
  ])

  // ── Configure: Chi-square independence — method → rowVar, passed → colVar (continuity stays on) ──
  await configureStep(page, /Chi-square independence/, [
    ['method', 'rowVar'],
    ['passed', 'colVar'],
  ])

  // ── Configure: Chi-square goodness-of-fit — method → variable; custom-props gate check ──
  await configureStep(page, /Chi-square goodness-of-fit/, [
    ['method', 'variable'],
  ])

  // Switch expected proportions to custom
  await page.getByLabel('expected proportions').selectOption('custom')

  // Gate check: set ALL THREE to 0.5 (sum = 1.5) → Run disabled + hint
  await page.getByLabel('proportion: discussion').fill('0.5')
  await page.getByLabel('proportion: lecture').fill('0.5')
  await page.getByLabel('proportion: seminar').fill('0.5')
  await expect(page.getByRole('button', { name: 'Run analysis' })).toBeDisabled()
  await expect(page.getByText('custom proportions must sum to 1 to enable Run')).toBeVisible()

  // Fix to 0.5 / 0.3 / 0.2 → GoF gate clears (Next button enabled, confirming the sum gate passed)
  await page.getByLabel('proportion: lecture').fill('0.3')
  await page.getByLabel('proportion: seminar').fill('0.2')
  await expect(page.getByRole('button', { name: /^Next:/ })).toBeEnabled()

  // ── Configure: Fisher's exact — passed → rowVar, gender → colVar ──
  await configureStep(page, /Fisher/, [
    ['passed', 'rowVar'],
    ['gender', 'colVar'],
  ])

  // ── 5. Run; wait for Download enabled ──
  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 360_000 })

  // ── 6. Assert results ──

  // Pearson: r=0.70, t=6.07, df=38, p<.001, CI [0.50, 0.83]
  const pearsonTable = page.locator('#table-pearson-correlation')
  await expect(pearsonTable).toContainText('0.70')
  await expect(pearsonTable).toContainText('6.07')
  await expect(pearsonTable).toContainText('38')
  await expect(pearsonTable).toContainText('<.001')
  await expect(page.getByText('hours_studied and exam_score were correlated, r(38)=.70, p < .001, 95% CI [0.50, 0.83].')).toBeVisible()

  // Spearman (tied ordinal pair): rho=0.85, S=1632.68, p<.001
  const spearmanTable = page.locator('#table-spearman-correlation')
  await expect(spearmanTable).toContainText('0.85')
  await expect(spearmanTable).toContainText('1632.68')
  await expect(spearmanTable).toContainText('<.001')

  // Kendall (tied ordinal pair): tau=0.75, z=5.71, p<.001
  const kendallTable = page.locator('#table-kendalls-tau-correlation')
  await expect(kendallTable).toContainText('0.75')
  await expect(kendallTable).toContainText('5.71')
  await expect(kendallTable).toContainText('<.001')

  // Chi-square independence (3×2 method × passed): chisq=4.90, p=.086, V=0.35
  const indChisqTable = page.locator('#table-chi-square-independence-chi-square')
  await expect(indChisqTable).toContainText('4.90')
  await expect(indChisqTable).toContainText('.086')
  await expect(indChisqTable).toContainText('0.35')
  // Contingency table: expected counts present, Total row visible
  const indContingency = page.locator('#table-chi-square-independence-contingency')
  await expect(indContingency).toContainText('[')
  await expect(indContingency).toContainText('Total')

  // GoF (custom proportions 0.5/0.3/0.2): chisq=2.01, p=.366, w=0.22 — custom not equal-split
  const gofChisqTable = page.locator('#table-gof-chi-square')
  await expect(gofChisqTable).toContainText('2.01')
  await expect(gofChisqTable).toContainText('.366')
  await expect(gofChisqTable).toContainText('0.22')
  // Observed vs expected table: discussion expected = 20.00 (0.5 × 40)
  const gofObsExpTable = page.locator('#table-observed-expected')
  await expect(gofObsExpTable).toContainText('20.00')

  // Fisher (2×2 passed × gender): p=.056, OR=4.16, CI [0.97, 20.18]
  await expect(page.locator('#table-fishers-exact-contingency')).toBeVisible()
  const fisherExactTable = page.locator('#table-fisher')
  await expect(fisherExactTable).toContainText('.056')
  await expect(fisherExactTable).toContainText('4.16')
  await expect(fisherExactTable).toContainText('[0.97, 20.18]')
  await expect(page.getByText(/A Fisher's exact test.*gave p = \.056.*OR=4\.16.*95% CI \[0\.97, 20\.18\]/)).toBeVisible()

  // ── 7. Download & unzip — assert exact 13-file path set ──
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-results.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()

  // 01_pearson: 2 files
  expect(entries).toContain('01_pearson/table_correlation.png')
  expect(entries).toContain('01_pearson/figure_scatter.png')

  // 02_spearman: 2 files
  expect(entries).toContain('02_spearman/table_correlation.png')
  expect(entries).toContain('02_spearman/figure_scatter.png')

  // 03_kendalls-tau: 2 files
  expect(entries).toContain('03_kendalls-tau/table_correlation.png')
  expect(entries).toContain('03_kendalls-tau/figure_scatter.png')

  // 04_chi-square-independence: 3 files
  expect(entries).toContain('04_chi-square-independence/table_contingency.png')
  expect(entries).toContain('04_chi-square-independence/table_chi-square.png')
  expect(entries).toContain('04_chi-square-independence/figure_bar.png')

  // 05_chi-square-goodness-of-fit: 3 files
  expect(entries).toContain('05_chi-square-goodness-of-fit/table_observed-expected.png')
  expect(entries).toContain('05_chi-square-goodness-of-fit/table_chi-square.png')
  expect(entries).toContain('05_chi-square-goodness-of-fit/figure_bar.png')

  // 06_fishers-exact: 3 files
  expect(entries).toContain('06_fishers-exact/table_contingency.png')
  expect(entries).toContain('06_fishers-exact/table_fisher.png')
  expect(entries).toContain('06_fishers-exact/figure_bar.png')
})
