import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { unzipSync } from 'fflate'

// ── Helpers (copied from flow.spec.ts — module-local, byte-untouched) ─────────

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

// ── Journey A: between-subjects ────────────────────────────────────────────────

test('Journey A: between-subjects — one-way ANOVA + factorial ANOVA + Kruskal-Wallis', async ({ page }) => {
  // ── Upload & step 4 (defaults: numerics ratio, strings nominal; subject_id id-tagged, unused) ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/anova.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  // Defaults are fine — numerics auto-ratio, strings auto-nominal; subject_id id-tagged stays unused
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── Pick tests ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  for (const name of ['One-way ANOVA + post-hoc', 'Factorial ANOVA', 'Kruskal-Wallis'])
    await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── Configure One-way ANOVA: outcome→Outcome, group→Factor ──
  await expect(page.locator('.eyebrow').first()).toContainText('One-way ANOVA')
  await dragChip(page, 'outcome', 'outcome')
  await expect(page.locator('[data-role="outcome"] .chip.assigned')).toContainText('outcome')
  await dragChip(page, 'group', 'factor')
  await expect(page.locator('[data-role="factor"] .chip.assigned')).toContainText('group')
  // Assert post-hoc select pill shows 'Tukey HSD' as default
  await expect(page.getByLabel('post-hoc')).toHaveValue('Tukey HSD')

  // ── Configure Factorial ANOVA: outcome + factors group, gender ──
  await configureStep(page, /Factorial ANOVA/, [
    ['outcome', 'outcome'],
    ['group', 'factors'],
    ['gender', 'factors'],
  ])

  // ── Configure Kruskal-Wallis: outcome + group ──
  await configureStep(page, /Kruskal-Wallis/, [
    ['outcome', 'outcome'],
    ['group', 'group'],
  ])

  // ── Run all ──
  await runAnalysis(page)

  // Wait for all results to land (Download button enables only when ALL runs complete)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 360_000 })

  // ── Assert One-way ANOVA card ──
  const owaApa = page.getByText(/A one-way ANOVA gave/)
  await expect(owaApa).toBeVisible()
  await expect(owaApa).toContainText('F(2,57)=2.81')
  await expect(owaApa).toContainText('p = .069')
  await expect(owaApa).toContainText('η²=.09')

  const owaAnova = page.locator('#table-one-way-anova-anova')
  await expect(owaAnova).toContainText('2.81')
  await expect(owaAnova).toContainText('.069')
  await expect(owaAnova).toContainText('0.09')

  const owaPosthoc = page.locator('#table-one-way-anova-posthoc')
  await expect(owaPosthoc).toContainText('.828')  // control - drug_a Tukey p_adj = .828

  // ── Assert Factorial ANOVA card ──
  const facAnova = page.locator('#table-factorial-anova-anova')
  await expect(facAnova).toContainText('2.48')    // group × gender interaction F
  await expect(facAnova).toContainText('.093')    // interaction p

  // Recorded decision 2: no significant effect → "Simple effects / post-hoc" caption ABSENT
  await expect(page.getByText('Simple effects / post-hoc')).toHaveCount(0)

  // ── Assert Kruskal-Wallis card ──
  // domId absent on the kruskal-wallis table → id = t.spec.id = 'kruskal-wallis'
  const kwTable = page.locator('#table-kruskal-wallis')
  await expect(kwTable).toContainText('6.56')   // H
  await expect(kwTable).toContainText('.038')   // p
  await expect(kwTable).toContainText('0.11')   // ε²

  const kwPosthoc = page.locator('#table-kruskal-wallis-posthoc')
  await expect(kwPosthoc).toContainText('.042')  // control - drug_b Dunn holm p_adj

  // ── Download & unzip ──
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-results.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()

  // Figure filenames: `figure_${fig.file ?? fig.type}.png` — the card-faithful bundle names; tables: `table_${t.spec.id}.png`

  // 01_one-way-anova: 4 files (including post-hoc — always rendered)
  expect(entries).toContain('01_one-way-anova/table_descriptives.png')
  expect(entries).toContain('01_one-way-anova/table_anova.png')
  expect(entries).toContain('01_one-way-anova/table_posthoc.png')
  expect(entries).toContain('01_one-way-anova/figure_means-plot.png')

  // 02_factorial-anova: 3 files — NO table_simple-effects.png (nothing significant, recorded decision 2)
  expect(entries).toContain('02_factorial-anova/table_cell-descriptives.png')
  expect(entries).toContain('02_factorial-anova/table_anova.png')
  expect(entries).toContain('02_factorial-anova/figure_interaction.png')
  expect(entries).not.toContain('02_factorial-anova/table_simple-effects.png')

  // 03_kruskal-wallis: 4 files
  expect(entries).toContain('03_kruskal-wallis/table_rank-summary.png')
  expect(entries).toContain('03_kruskal-wallis/table_kruskal-wallis.png')
  expect(entries).toContain('03_kruskal-wallis/table_posthoc.png')
  expect(entries).toContain('03_kruskal-wallis/figure_boxplot.png')
})

// ── Journey B: wide / repeated-measures ───────────────────────────────────────

test('Journey B: wide/repeated — RM ANOVA + Mixed ANOVA + Friedman; sphericity omission on 2-level re-run', async ({ page }) => {
  // ── Upload ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/anova.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // ── Step 4: mark subject_id as Used + level nominal (recorded decision 3) ──
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByLabel('use subject_id').check()
  await page.getByLabel('level of subject_id').selectOption('nominal')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── Pick tests ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  for (const name of ['Repeated-measures ANOVA', 'Mixed ANOVA', 'Friedman'])
    await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── Configure Repeated-measures ANOVA ──
  await expect(page.locator('.eyebrow').first()).toContainText('Repeated-measures ANOVA')
  await dragChip(page, 'subject_id', 'subject')
  await expect(page.locator('[data-role="subject"] .chip.assigned')).toContainText('subject_id')
  await dragChip(page, 'score_t1', 'measures')
  await expect(page.locator('[data-role="measures"]')).toContainText('score_t1')
  await dragChip(page, 'score_t2', 'measures')
  await expect(page.locator('[data-role="measures"]')).toContainText('score_t2')
  await dragChip(page, 'score_t3', 'measures')
  await expect(page.locator('[data-role="measures"]')).toContainText('score_t3')
  // Assert sphericity select defaults to 'GG correction'
  await expect(page.getByLabel('sphericity')).toHaveValue('GG correction')

  // ── Configure Mixed ANOVA: same measures + between-groups = group ──
  await configureStep(page, /Mixed ANOVA/, [
    ['subject_id', 'subject'],
    ['group', 'between'],
    ['score_t1', 'measures'],
    ['score_t2', 'measures'],
    ['score_t3', 'measures'],
  ])

  // ── Configure Friedman: subject + three scores ──
  await configureStep(page, /Friedman/, [
    ['subject_id', 'subject'],
    ['score_t1', 'measures'],
    ['score_t2', 'measures'],
    ['score_t3', 'measures'],
  ])

  // ── Run all ──
  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 420_000 })

  // ── Assert Repeated-measures ANOVA card ──
  // df1=1.78 in the ANOVA table; df2=104.75 in the APA text only (table has one df column)
  const rmAnova = page.locator('#table-repeated-measures-anova-rm-anova')
  await expect(rmAnova).toContainText('1.78')
  await expect(rmAnova).toContainText('78.51')
  await expect(rmAnova).toContainText('<.001')
  // df2 and full APA fragment are in the APA sentence
  await expect(page.getByText(/A repeated-measures ANOVA/)).toContainText('F(1.78,104.75)=78.51')

  // Sphericity table present on both RM and Mixed ANOVA (two instances total after initial run)
  await expect(page.getByText("Sphericity (Mauchly's test)")).toHaveCount(2)
  const rmSpher = page.locator('#table-repeated-measures-anova-sphericity')
  await expect(rmSpher).toContainText('0.87')  // W rounded to 2dp
  await expect(rmSpher).toContainText('.020')  // p = .0198...

  // ── Assert Mixed ANOVA card ──
  // Interaction row: p(GG) = .056... → '.056'
  const mixedAnova = page.locator('#table-mixed-anova-mixed-anova')
  await expect(mixedAnova).toContainText('.056')

  // Sphericity table present on Mixed ANOVA too
  await expect(page.locator('#table-mixed-anova-sphericity')).toBeVisible()

  // ── Assert Friedman card ──
  const friedmanTable = page.locator('#table-friedman-friedman')
  await expect(friedmanTable).toContainText('67.19')   // χ²
  await expect(friedmanTable).toContainText('<.001')   // p
  await expect(friedmanTable).toContainText('0.56')    // W

  const friedmanPosthoc = page.locator('#table-friedman-posthoc')
  await expect(friedmanPosthoc).toContainText('<.001')  // Nemenyi score_t1 - score_t2 pAdj = 2.84e-05

  // ── Back-edit RM config: remove score_t3 (2-level run → sphericity omitted) ──
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: /Repeated-measures ANOVA/ }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(/Repeated-measures ANOVA/, { timeout: 1000 })
  }).toPass()
  await page.getByRole('button', { name: 'remove score_t3' }).click()
  // Verify score_t3 chip is removed (the slot hint contains "score_t3" as an example, so scope to .chip.assigned)
  await expect(page.locator('[data-role="measures"] .chip.assigned')).toHaveCount(2)

  // Navigate back to Results — ANY config edit stales ALL runs (navcap rule): three stale
  // cards appear, so .first() avoids the strict-mode violation flow.spec's single-card path never hit
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: 'Results' }).click()
    await expect(page.getByText(/Stale — the configuration changed/).first()).toBeVisible({ timeout: 1000 })
  }).toPass()

  // Re-run the stale RM analysis
  await page.getByRole('button', { name: 'Run analysis again' }).first().click()
  await expect(page.getByText(/Stale — the configuration changed/).first()).toHaveCount(0, { timeout: 240_000 })

  // Sphericity caption ABSENT after 2-level RM run (card rule: 2 levels = sphericity automatically met)
  await expect(page.getByText("Sphericity (Mauchly's test)")).toHaveCount(1)  // only Mixed ANOVA's sphericity remains

  // ── Download & unzip ──
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()

  // Figure filenames: card-faithful `figure_${fig.file ?? fig.type}.png`; tables: `table_${t.spec.id}.png`

  // 01_repeated-measures-anova: NO table_sphericity.png (2-level run, sphericity omitted)
  expect(entries).toContain('01_repeated-measures-anova/table_descriptives.png')
  expect(entries).toContain('01_repeated-measures-anova/table_rm-anova.png')
  expect(entries).not.toContain('01_repeated-measures-anova/table_sphericity.png')
  expect(entries).toContain('01_repeated-measures-anova/table_posthoc.png')
  expect(entries).toContain('01_repeated-measures-anova/figure_profile.png')

  // 02_mixed-anova: all 5 files (3-level stays, sphericity present)
  expect(entries).toContain('02_mixed-anova/table_descriptives.png')
  expect(entries).toContain('02_mixed-anova/table_mixed-anova.png')
  expect(entries).toContain('02_mixed-anova/table_sphericity.png')
  expect(entries).toContain('02_mixed-anova/table_posthoc.png')
  expect(entries).toContain('02_mixed-anova/figure_profile.png')

  // 03_friedman: all 4 files
  expect(entries).toContain('03_friedman/table_rank-summary.png')
  expect(entries).toContain('03_friedman/table_friedman.png')
  expect(entries).toContain('03_friedman/table_posthoc.png')
  expect(entries).toContain('03_friedman/figure_profile.png')
})
