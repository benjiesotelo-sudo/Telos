import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { utils, write } from 'xlsx'
import { unzipSync } from 'fflate'

async function dragChip(page: Page, chip: string, roleId: string) {
  const src = page.locator('.chip', { hasText: chip }).first()
  const dst = page.locator(`[data-role="${roleId}"]`)
  const a = (await src.boundingBox())!, b = (await dst.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('full journey: welcome → upload → guide → configure → pick → drag → Welch run → toggle → pooled re-run → level back-edit → stale → re-run → zip export', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Telos' })).toBeVisible()
  await page.getByRole('button', { name: 'Get started' }).click()

  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible() // clean parse auto-advances
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await expect(page.getByText('12 rows · 2 columns · UTF-8')).toBeVisible()
  await expect(page.getByLabel('level of score')).toHaveValue('ratio')   // suggested level pre-filled
  await expect(page.getByLabel('level of group')).toHaveValue('nominal')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await expect(page.getByText('arrives in a later slice').first()).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Pearson' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByRole('heading', { name: 'Drag columns into roles' })).toBeVisible()
  await dragChip(page, 'score', 'outcome')
  await dragChip(page, 'group', 'group')
  await expect(page.locator('[data-role="outcome"] .chip.assigned')).toContainText('score')
  await expect(page.locator('[data-role="group"] .chip.assigned')).toContainText('group')
  await page.getByRole('button', { name: 'Run analysis' }).click()

  // Results — Welch (drawn default: equal variance off)
  const t2 = page.locator('#table-t-test')
  await expect(t2).toBeVisible({ timeout: 240_000 })
  await expect(page.locator('#table-group-statistics')).toContainText('70.33')
  await expect(page.locator('#table-group-statistics')).toContainText('3.78')
  await expect(t2).toContainText('Mdiff')
  await expect(t2).toContainText('−5.98'); await expect(t2).toContainText('9.68')
  await expect(t2).toContainText('<.001'); await expect(t2).toContainText('[−16.49, −7.51]'); await expect(t2).toContainText('−3.45')
  await expect(page.getByText('How to read this test')).toBeVisible()
  await expect(page.getByRole('img', { name: /boxplot/i })).toBeVisible()

  // Back-edit via the stepper: toggle equal variance → re-run → pooled
  await page.getByRole('button', { name: /t-test/ }).click() // stepper step (accessible name includes the dot glyph)
  await page.getByLabel(/equal variance/).check()
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.locator('#table-t-test')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('#table-t-test')).toContainText('10')            // integer pooled df
  await expect(page.locator('#table-t-test')).toContainText('[−16.47, −7.53]')

  // Back-edit a LEVEL (earlier-step edit) → result goes stale → re-run (spec Testing §3)
  await page.getByRole('button', { name: 'Configure data' }).click()
  await page.getByLabel('level of score').selectOption('interval') // still t-test-compatible: config stays valid, run goes stale
  await page.getByRole('button', { name: 'Results' }).click()      // forward nav via the gates (stepper reads canEnter)
  await expect(page.getByText(/Stale — the configuration changed/)).toBeVisible()
  await page.getByRole('button', { name: 'Run analysis again' }).click()
  await expect(page.getByText(/Stale — the configuration changed/)).toHaveCount(0, { timeout: 120_000 })

  // Disabled export formats asserted (spec Testing §3)
  for (const name of [/PDF report/, /LaTeX file/, /R script/])
    await expect(page.getByRole('checkbox', { name })).toBeDisabled()

  // Zip download with foldered paths (spec Testing §3)
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-results.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!))))
  expect(entries.sort()).toEqual([
    '01_independent-t-test/figure_boxplot.png',
    '01_independent-t-test/table_group-statistics.png',
    '01_independent-t-test/table_t-test.png',
  ])
})

test('excel path: multi-sheet workbook → sheet picker → guide', async ({ page }) => {
  const wb = utils.book_new()
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['group', 'score'], ['a', 1], ['a', 2], ['a', 3], ['b', 4], ['b', 5], ['b', 6]]), 'Data')
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['x'], [1]]), 'Notes')
  const file = join(mkdtempSync(join(tmpdir(), 'telos-')), 'two-sheets.xlsx')
  writeFileSync(file, Buffer.from(write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer))

  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', file)
  await expect(page.getByText('two-sheets.xlsx · 2 sheets')).toBeVisible()
  await page.getByRole('button', { name: 'Use this sheet' }).click()
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
})

async function configureStep(page: Page, stepName: RegExp, drags: [string, string][]) {
  // dnd-kit suppresses the first document click after a drag — click until the step screen actually swaps
  await expect(async () => {
    await page.getByRole('button', { name: stepName }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(stepName, { timeout: 1000 })
  }).toPass()
  for (const [chip, role] of drags) {
    await dragChip(page, chip, role)
    await expect(page.locator(`[data-role="${role}"] .chip.assigned`)).toContainText(chip) // the drop commits async (dnd-kit) — anchor before the next click
  }
}

async function runAnalysis(page: Page) {
  await expect(async () => { // same post-drag click suppression guard for the run button
    await page.getByRole('button', { name: 'Run analysis' }).click()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 1000 })
  }).toPass()
}

test('multi-test journey A: five tests, one dataset → combined results + 13-file zip', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  for (const name of ['Summary statistics', 'Frequencies & cross-tabs', 'Distribution & normality', 'Independent t-test', 'Mann-Whitney U'])
    await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // tick order = tree order → steps/result order 01..05
  await dragChip(page, 'score', 'variables')                                   // 01 Summary (Group by left empty — optional)
  await expect(page.locator('[data-role="variables"] .chip.assigned')).toContainText('score')
  await configureStep(page, /Frequencies/, [['group', 'variables']])           // 02 Frequencies (1 variable → frequency table)
  await configureStep(page, /Distribution/, [['score', 'variable']])           // 03 Distribution & normality
  await configureStep(page, /Independent t-test|t-test/, [['score', 'outcome'], ['group', 'group']]) // 04
  await configureStep(page, /Mann-Whitney/, [['score', 'outcome'], ['group', 'group']])              // 05
  await runAnalysis(page)

  // 01 · Summary statistics — psych type-3 values (bare "Table." caption)
  await expect(page.getByText('01 · Summary statistics')).toBeVisible({ timeout: 300_000 })
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 300_000 }) // the 01 · eyebrow shows on the running placeholder too — Download enables only when ALL runs land
  const t01 = page.locator('#table-descriptives')
  await expect(t01).toContainText('76.33'); await expect(t01).toContainText('7.09')
  await expect(t01).toContainText('76.50'); await expect(t01).toContainText('0.11'); await expect(t01).toContainText('−1.49')
  // 02 · Frequencies — alphabetical categories, 1-dp %
  const t02 = page.locator('#table-frequencies')
  await expect(t02).toContainText('control'); await expect(t02).toContainText('50.0')
  // 03 · Distribution & normality — both test rows + both figures
  const t03 = page.locator('#table-normality')
  await expect(t03).toContainText('W 0.96'); await expect(t03).toContainText('.829')
  await expect(t03).toContainText('K–S (Lilliefors)'); await expect(t03).toContainText('D 0.15'); await expect(t03).toContainText('.681')
  await expect(page.getByRole('img', { name: /qq/i })).toBeVisible()
  // 04 · Independent t-test — the locked Welch numbers, unchanged by everything around them
  const t04 = page.locator('#table-t-test')
  await expect(t04).toContainText('−5.98'); await expect(t04).toContainText('9.68'); await expect(t04).toContainText('[−16.49, −7.51]')
  // 05 · Mann-Whitney — rank summary + APA with exact p
  const t05 = page.locator('#table-rank-summary')
  await expect(t05).toContainText('3.50'); await expect(t05).toContainText('21.00')
  await expect(page.locator('#table-mann-whitney')).toContainText('−2.88')
  await expect(page.getByText('A Mann-Whitney U test showed a difference, U=0, Z=−2.88, p=.002, r=−1.00.')).toBeVisible()

  // Combined zip: 13 files across five NN_ folders
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!))))
  expect(entries.sort()).toEqual([
    '01_summary-statistics/figure_histogram_score.png',
    '01_summary-statistics/table_descriptives.png',
    '02_frequencies-crosstabs/figure_bar.png',
    '02_frequencies-crosstabs/table_frequencies.png',
    '03_distribution-normality/figure_histogram_score.png',
    '03_distribution-normality/figure_qq_score.png',
    '03_distribution-normality/table_normality.png',
    '04_independent-t-test/figure_boxplot.png',
    '04_independent-t-test/table_group-statistics.png',
    '04_independent-t-test/table_t-test.png',
    '05_mann-whitney-u/figure_boxplot.png',
    '05_mann-whitney-u/table_mann-whitney.png',
    '05_mann-whitney-u/table_rank-summary.png',
  ])
})

test('multi-variable normality: two variables → per-variable rows, figures, zip names', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/students.csv')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()
  await page.getByRole('checkbox', { name: 'Distribution & normality' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await dragChip(page, 'score', 'variable')
  await expect(page.locator('[data-role="variable"] .chip.assigned')).toContainText('score')
  await dragChip(page, 'anxiety', 'variable')
  await expect(page.locator('[data-role="variable"] .chip.assigned').nth(1)).toBeVisible()
  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 300_000 })

  // native-R verified (2026-06-12): score n=14 W=0.957345 p=.679237 · anxiety n=13 W=0.982822 p=.990406, D=0.087857
  const t = page.locator('#table-normality')
  await expect(t).toContainText('score'); await expect(t).toContainText('anxiety')
  await expect(t).toContainText('W 0.96'); await expect(t).toContainText('.679')
  await expect(t).toContainText('W 0.98'); await expect(t).toContainText('.990')
  await expect(t).toContainText('D 0.09')
  await expect(page.getByRole('img', { name: /qq_anxiety/ })).toBeVisible()
  await expect(page.getByText(/anxiety: Normality was assessed/)).toBeVisible()

  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!))))
  expect(entries.sort()).toEqual([
    '01_distribution-normality/figure_histogram_anxiety.png',
    '01_distribution-normality/figure_histogram_score.png',
    '01_distribution-normality/figure_qq_anxiety.png',
    '01_distribution-normality/figure_qq_score.png',
    '01_distribution-normality/table_normality.png',
  ])
})

test('multi-test journey B: paired fixture → one-sample (typed μ₀), paired t, wilcoxon', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/paired.csv')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  for (const name of ['One-sample t-test', 'Paired t-test', 'Wilcoxon signed-rank'])
    await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // 01 One-sample: outcome ← post, μ₀ typed as 70 (the kind:'number' option control)
  await dragChip(page, 'post', 'outcome')
  await expect(page.locator('[data-role="outcome"] .chip.assigned')).toContainText('post')
  await page.getByLabel('test value (μ₀)').fill('70')
  await configureStep(page, /Paired t-test/, [['pre', 'conditionA'], ['post', 'conditionB']])
  await configureStep(page, /Wilcoxon/, [['pre', 'conditionA'], ['post', 'conditionB']])
  await runAnalysis(page)

  // 01 · One-sample — difference CI (mean CI − μ₀), spike-verified
  await expect(page.getByText('01 · One-sample t-test')).toBeVisible({ timeout: 300_000 })
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 300_000 }) // the 01 · eyebrow shows on the running placeholder too — Download enables only when ALL runs land
  const o = page.locator('#table-one-sample-t-test')
  await expect(o).toContainText('70')      // Test value cell = the typed μ₀
  await expect(o).toContainText('8.00'); await expect(o).toContainText('[8.37, 16.30]'); await expect(o).toContainText('3.27')
  await expect(page.getByText('A one-sample t-test showed M=82.3 differed from 70, t(5)=8.00, p<.001, d=3.27.')).toBeVisible()
  // 02 · Paired t — d_z and the A−B difference CI
  await expect(page.getByText('A paired-samples t-test showed a change of M=−12.0, t(5)=−10.39, p<.001, dz=−4.24.')).toBeVisible()
  const pt = page.locator('#table-paired-t-test')
  await expect(pt).toContainText('−10.39'); await expect(pt).toContainText('[−14.97, −9.03]'); await expect(pt).toContainText('−4.24')
  // 03 · Wilcoxon — exact p with the asymptotic Z (card-specified mix)
  await expect(page.getByText('A Wilcoxon signed-rank test showed a change, Z=−2.20, p=.031, r=−1.00.')).toBeVisible()
  const w = page.locator('#table-signed-rank')
  await expect(w).toContainText('0.00'); await expect(w).toContainText('−2.20'); await expect(w).toContainText('−1.00')
})
