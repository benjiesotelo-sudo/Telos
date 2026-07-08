/* Documentation capture (NOT a gate test — run via playwright.docs.config.ts).
   For each live test: drive the real app to its configured state and capture
   the config screen, the results screen, the print-to-PDF, and the real export
   (analysis.R + report.tex + figures) into docs/test-documentation/NN_<id>/. */
import { test, expect, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { unzipSync } from 'fflate'

const OUT = 'docs/test-documentation'

type Drag = [string, string]
type DataCfg = { column: string; action: string } // 'use' | 'unuse' | 'level:nominal' | 'level:ordinal'
type SetAction = { label: string; action: 'fill' | 'select' | 'check'; value?: string }
interface Case {
  nn: string; id: string; name: string; question: string; fixture: string
  pickName: string; dataConfig: DataCfg[]; drags: Drag[]; set: SetAction[]
  scenario: string // one-line domain story, surfaced in the harness README (scripts/gen-doc-readmes.mjs)
  constructs?: { name: string; items: string[] }[] // construct-slots tests (AVE, CR) — no drag roles
  paths?: Drag[] // sem-canvas tests (CB-SEM, PLS-SEM): structural paths drawn between constructs (by name)
  nodePaths?: [number, number][] // path-analysis: observed-column path mode — paths drawn between column rectangles (by node id = index into used-columns)
  moderations?: [string, number][] // CB-SEM/PLS-SEM: [moderator construct name, index into `paths`] - click the moderator oval then the path's midpoint handle
}

async function dragChip(page: Page, chip: string, roleId: string) {
  // Tap-to-assign (the same mobile-friendly path DragSlots.tsx offers real users: click a chip to
  // arm it, click a slot to drop it — DragSlots.tsx's onChipTap/onSlotTap), NOT a simulated mouse
  // drag. The docs-v2 fixtures have far more columns than the old 2-3 column ones, so the chip pool
  // and the role-slots panel are often not simultaneously on screen; a raw mouse.move/down/up drag
  // computed from boundingBox() (which does not scroll) silently misses whichever endpoint is below
  // the fold, and scrolling one endpoint into view can scroll the OTHER back out (they sit in the
  // same page scroll, in separate side-by-side panels). Locator.click() scrolls its own target into
  // view as part of Playwright's actionability checks, so two clicks sidestep the problem entirely.
  const src = page.locator('.chip', { hasText: chip }).first()
  const dst = page.locator(`[data-role="${roleId}"]`)
  await src.click()
  await dst.click()
}

// Readability guard for full-page captures: a scrolled page paints the sticky rail STUCK mid-band
// over the title in fullPage screenshots (the bug behind the unreadable 05 config capture). The
// app scrolls to top on every step change (ratify N2), but configuring a long screen (e.g. the
// SEM construct form below the canvas) legitimately scrolls within the step - so scroll back to
// the top like a user reviewing the screen, wait for fonts and a couple of frames, then assert
// the rail sits in its natural flow position with the hint bar / eyebrow fully below it, so any
// recurrence fails loudly instead of silently shipping an unreadable capture.
async function settleForCapture(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))))
  await expect(async () => {
    const clear = await page.evaluate(() => {
      const rail = document.querySelector('.rail')?.getBoundingClientRect()
      const below = document.querySelector('.hintbar, .eyebrow')?.getBoundingClientRect()
      if (!rail || !below) return true
      return window.scrollY === 0 && below.top >= rail.bottom - 1 // 1px tolerance for subpixel rounding
    })
    expect(clear).toBe(true)
  }).toPass({ timeout: 2000 })
}

async function documentTest(page: Page, c: Case) {
  const folder = join(OUT, `${c.nn}_${c.id}`)
  mkdirSync(folder, { recursive: true })

  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', `tests/e2e/fixtures/${c.fixture}`)
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  for (const dc of c.dataConfig) {
    if (dc.action === 'use') await page.getByLabel(`use ${dc.column}`).check()
    else if (dc.action === 'unuse') await page.getByLabel(`use ${dc.column}`).uncheck()
    else if (dc.action.startsWith('level:')) await page.getByLabel(`level of ${dc.column}`).selectOption(dc.action.slice(6))
  }
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await page.getByRole('checkbox', { name: c.pickName, exact: true }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  // (No scroll workaround needed: the app scrolls to top on every step change - ratify N2.)

  // configure-test: path-analysis (observed-only path mode) — no construct-slots form, no drag roles.
  // The canvas shows one RECTANGLE per used column (data-node-id = index into the used-columns list);
  // Draw is the default tool → click source rect then target rect to draw each structural path.
  if (c.nodePaths) {
    const rect = (id: number) => page.locator(`rect.sem-node-rect[data-node-id="${id}"]`)
    await expect(rect(0)).toBeVisible()
    for (const [from, to] of c.nodePaths) {
      await rect(from).click()
      await rect(to).click()
    }
    await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(c.nodePaths.length)
  } else if (c.constructs) {
    await expect(page.getByRole('button', { name: '+ Add construct' })).toBeVisible()
    for (let i = 0; i < c.constructs.length; i++) {
      await page.getByRole('button', { name: '+ Add construct' }).click()
      // scope item checkboxes to this construct's card (same column names repeat per construct)
      const card = page.locator('.card').filter({ has: page.getByLabel(`Construct ${i + 1} name`) })
      await card.getByLabel(`Construct ${i + 1} name`).fill(c.constructs[i].name)
      for (const item of c.constructs[i].items) await card.getByLabel(item).check()
    }
    // sem-canvas tests (CB-SEM, PLS-SEM): draw structural paths between the construct ovals.
    // Ovals render in construct add-order; Draw is the canvas default → click source oval then target.
    if (c.paths) {
      await expect(page.locator('ellipse[data-node-id]')).toHaveCount(c.constructs.length)
      // Fit BEFORE clicking ovals, not just before capture: with 5 constructs the default layout
      // places the outermost oval beyond the SVG viewBox — SVG content does not scroll, so
      // Playwright's click retries "element is outside of the viewport" forever (46/47 hung on
      // exactly this with the five-construct tourism-esg model).
      await page.getByRole('button', { name: 'Fit' }).click()
      await page.waitForTimeout(200)
      const idxOf = (name: string) => c.constructs!.findIndex((k) => k.name === name)
      for (const [from, to] of c.paths) {
        await page.locator('[data-node-id]').nth(idxOf(from)).click()
        await page.locator('[data-node-id]').nth(idxOf(to)).click()
      }
      // Moderation gesture (CB-SEM/PLS-SEM): click the moderator's own oval, then the target path's
      // midpoint handle (data-path-index, drawn after all base structural paths above) - see
      // sem-moderation.spec.ts for the same idiom.
      for (const [modName, pathIndex] of c.moderations ?? []) {
        await page.locator('[data-node-id]').nth(idxOf(modName)).click()
        await page.locator(`[data-path-index="${pathIndex}"]`).click()
      }
    }
  } else {
    await expect(page.locator('[data-role]').first()).toBeVisible()
    for (const [chip, role] of c.drags) {
      await dragChip(page, chip, role)
      await expect(page.locator(`[data-role="${role}"]`)).toContainText(chip)
    }
  }
  for (const s of c.set) {
    // exact match: a substring match on e.g. 'post-hoc' or 'CI' can resolve to the journey-bar
    // sub-dot button whose aria-label is the FULL test name ("One-way ANOVA + post-hoc"), which
    // sits earlier in the DOM than the actual option control (whose aria-label is the bare label).
    const el = page.getByLabel(s.label, { exact: true }).first()
    if (s.action === 'fill') await el.fill(s.value!)
    else if (s.action === 'select') await el.selectOption(s.value!)
    else await el.check()
  }
  // Canvas tests: the config canvas mounts before constructs are added, so fit the diagram to its
  // content before capturing — otherwise the outermost construct's item boxes sit off-view.
  // Only sem-canvas cards (paths/nodePaths) render the canvas; construct-slots cards (AVE, CR)
  // have no canvas and no Fit button.
  if (c.paths || c.nodePaths) {
    await page.getByRole('button', { name: 'Fit' }).click()
    await page.waitForTimeout(200)
  }
  await settleForCapture(page)
  await page.screenshot({ path: join(folder, '1-input-config.png'), fullPage: true })

  // run
  await expect(async () => {
    await page.getByRole('button', { name: 'Run analysis' }).click()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 3000 })
  }).toPass()
  // wait for the result card content (a table or a figure image) — generous for WebR + first-load assets
  // (SEM cards run lavaan/semTools + bootstrap, the slowest path in the app — allow up to 10 min)
  await expect(page.locator('section.card table, section.card img').first()).toBeVisible({ timeout: 600_000 })
  await page.waitForTimeout(600)
  await settleForCapture(page)
  await page.screenshot({ path: join(folder, '2-app-output.png'), fullPage: true })

  // PDF piece — the app's print-to-PDF (print stylesheet hides nav/export chrome)
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: join(folder, '3-pdf-report.pdf'), printBackground: true })
  await page.emulateMedia({ media: 'screen' })

  // LaTeX + R export — the real bundle
  for (const name of ['R script (.R)', 'LaTeX file (.tex)', 'Table images (.png)'])
    await page.getByRole('checkbox', { name }).check()
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  const zip = unzipSync(new Uint8Array(readFileSync((await dl.path()) as string)))
  for (const [p, bytes] of Object.entries(zip)) {
    const out = join(folder, 'export', p)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, bytes)
  }
}

// ── docs-v2 scenario worlds (deterministic generators under tests/docs/fixtures-src/) ──
// W1 campus-study.csv   - education experiment (n=240): 3 teaching methods x 2 genders, nested schools.
// W2 sleep-caffeine.csv - within-subject caffeine crossover (n=40): Baseline/Low/High, wide format.
// W3 econometrics       - minwage-employment / scholarship / returns-education / province-panel / macro-quarterly / job-training.
// W4 tourism-esg.csv    - tourist ESG-perception survey (n=400): 5 constructs, a moderation edge.
const CASES: Case[] = [
  { nn: '01', id: 'summary-statistics', name: 'Summary statistics', question: 'central tendency & spread of numeric variables', fixture: 'campus-study.csv', pickName: 'Summary statistics', dataConfig: [], drags: [['exam_score', 'variables'], ['study_hours_per_week', 'variables'], ['gender', 'groupBy']], set: [],
    scenario: 'Campus study: exam-score and study-hour descriptives by gender (the honest null).' },
  { nn: '02', id: 'frequencies-crosstabs', name: 'Frequencies & cross-tabs', question: 'counts for categorical data', fixture: 'campus-study.csv', pickName: 'Frequencies & cross-tabs', dataConfig: [], drags: [['teaching_method', 'variables']], set: [],
    scenario: 'Campus study: how many students landed in each teaching method.' },
  { nn: '03', id: 'distribution-normality', name: 'Distribution & normality', question: 'is a variable normally distributed?', fixture: 'campus-study.csv', pickName: 'Distribution & normality', dataConfig: [], drags: [['exam_score', 'variable'], ['absences', 'variable']], set: [],
    scenario: 'Campus study: exam score looks normal, but absences is right-skewed.' },
  { nn: '04', id: 'one-sample-t-test', name: 'One-sample t-test', question: 'does a mean differ from a fixed value?', fixture: 'campus-study.csv', pickName: 'One-sample t-test', dataConfig: [], drags: [['pretest_score', 'outcome']], set: [{ label: 'test value (μ₀)', action: 'fill', value: '50' }],
    scenario: "Campus study: do entering students' pretest scores differ from the 50-point national baseline?" },
  { nn: '05', id: 'independent-t-test', name: 'Independent t-test', question: "do two groups' means differ?", fixture: 'campus-study.csv', pickName: 'Independent t-test', dataConfig: [], drags: [['exam_score', 'outcome'], ['gender', 'group']], set: [],
    scenario: "Campus study: do male and female students' exam scores differ (the honest null)?" },
  { nn: '06', id: 'paired-t-test', name: 'Paired t-test', question: 'do two related measurements differ?', fixture: 'sleep-caffeine.csv', pickName: 'Paired t-test', dataConfig: [], drags: [['sleep_baseline', 'conditionA'], ['sleep_high', 'conditionB']], set: [],
    scenario: 'Sleep & caffeine: does a high dose reduce sleep quality versus baseline?' },
  { nn: '07', id: 'one-way-anova', name: 'One-way ANOVA + post-hoc', question: 'do 3+ groups differ, and which pairs?', fixture: 'campus-study.csv', pickName: 'One-way ANOVA + post-hoc', dataConfig: [], drags: [['exam_score', 'outcome'], ['teaching_method', 'factor']],
    set: [{ label: 'post-hoc', action: 'select', value: 'Tukey HSD' }, { label: 'CI', action: 'select', value: '99%' }],
    scenario: 'Campus study: which teaching method produces the highest exam scores (99% CI)?' },
  { nn: '08', id: 'factorial-anova', name: 'Factorial ANOVA', question: 'main effects + interaction of 2+ factors', fixture: 'campus-study.csv', pickName: 'Factorial ANOVA', dataConfig: [], drags: [['exam_score', 'outcome'], ['teaching_method', 'factors'], ['gender', 'factors']], set: [],
    scenario: 'Campus study: teaching method x gender on exam score.' },
  { nn: '09', id: 'repeated-measures-anova', name: 'Repeated-measures ANOVA', question: '3+ conditions on the same subjects', fixture: 'sleep-caffeine.csv', pickName: 'Repeated-measures ANOVA', dataConfig: [{ column: 'participant_id', action: 'use' }, { column: 'participant_id', action: 'level:nominal' }], drags: [['participant_id', 'subject'], ['sleep_baseline', 'measures'], ['sleep_low', 'measures'], ['sleep_high', 'measures']], set: [],
    scenario: 'Sleep & caffeine: sleep quality across three caffeine doses, same participants.' },
  { nn: '10', id: 'mixed-anova', name: 'Mixed ANOVA', question: 'between-groups × repeated conditions', fixture: 'sleep-caffeine.csv', pickName: 'Mixed ANOVA', dataConfig: [{ column: 'participant_id', action: 'use' }, { column: 'participant_id', action: 'level:nominal' }], drags: [['participant_id', 'subject'], ['tolerance_group', 'between'], ['sleep_baseline', 'measures'], ['sleep_low', 'measures'], ['sleep_high', 'measures']], set: [],
    scenario: 'Sleep & caffeine: dose x caffeine-tolerance group on sleep quality.' },
  { nn: '11', id: 'nested-anova', name: 'Nested ANOVA', question: 'one factor nested within another', fixture: 'campus-study.csv', pickName: 'Nested ANOVA', dataConfig: [], drags: [['exam_score', 'outcome'], ['school', 'factor'], ['classroom', 'nested']], set: [],
    scenario: 'Campus study: classrooms nested within schools on exam score.' },
  { nn: '12', id: 'welch-anova', name: "Welch's ANOVA", question: '3+ groups, unequal variances', fixture: 'campus-study.csv', pickName: "Welch's ANOVA", dataConfig: [], drags: [['exam_score', 'outcome'], ['teaching_method', 'factor']], set: [],
    scenario: 'Campus study: teaching-method effect on exam score, unequal variances (Games-Howell post-hoc).' },
  { nn: '13', id: 'ancova', name: 'ANCOVA', question: 'group means adjusted for a covariate', fixture: 'campus-study.csv', pickName: 'ANCOVA', dataConfig: [], drags: [['exam_score', 'outcome'], ['teaching_method', 'factor'], ['pretest_score', 'covariates']], set: [],
    scenario: 'Campus study: method effect on exam score, adjusting for entering ability.' },
  { nn: '14', id: 'manova', name: 'MANOVA', question: 'groups compared on several outcomes at once', fixture: 'campus-study.csv', pickName: 'MANOVA', dataConfig: [], drags: [['exam_score', 'outcomes'], ['retention_score', 'outcomes'], ['teaching_method', 'factors']], set: [],
    scenario: 'Campus study: method effect on exam AND retention score together.' },
  { nn: '15', id: 'mancova', name: 'MANCOVA', question: 'MANOVA with covariate control', fixture: 'campus-study.csv', pickName: 'MANCOVA', dataConfig: [], drags: [['exam_score', 'outcomes'], ['retention_score', 'outcomes'], ['teaching_method', 'factors'], ['pretest_score', 'covariates']], set: [],
    scenario: 'Campus study: method effect on exam AND retention, adjusting for entering ability.' },
  { nn: '16', id: 'mann-whitney-u', name: 'Mann-Whitney U', question: 'nonparametric two-group comparison', fixture: 'campus-study.csv', pickName: 'Mann-Whitney U', dataConfig: [], drags: [['absences', 'outcome'], ['gender', 'group']], set: [],
    scenario: 'Campus study: do absence counts (skewed) differ by gender?' },
  { nn: '17', id: 'wilcoxon-signed-rank', name: 'Wilcoxon signed-rank', question: 'nonparametric paired comparison', fixture: 'sleep-caffeine.csv', pickName: 'Wilcoxon signed-rank', dataConfig: [], drags: [['rt_baseline', 'conditionA'], ['rt_high', 'conditionB']], set: [],
    scenario: 'Sleep & caffeine: does a high dose speed up reaction time (skewed RT)?' },
  { nn: '18', id: 'kruskal-wallis', name: 'Kruskal-Wallis', question: 'nonparametric 3+ group comparison', fixture: 'campus-study.csv', pickName: 'Kruskal-Wallis', dataConfig: [], drags: [['absences', 'outcome'], ['teaching_method', 'group']], set: [],
    scenario: 'Campus study: absence counts (skewed) across teaching methods.' },
  { nn: '19', id: 'friedman', name: 'Friedman', question: 'nonparametric repeated measures', fixture: 'sleep-caffeine.csv', pickName: 'Friedman', dataConfig: [{ column: 'participant_id', action: 'use' }, { column: 'participant_id', action: 'level:nominal' }], drags: [['participant_id', 'subject'], ['rt_baseline', 'measures'], ['rt_low', 'measures'], ['rt_high', 'measures']], set: [],
    scenario: 'Sleep & caffeine: reaction time (skewed) across three doses, same participants.' },
  { nn: '20', id: 'pearson', name: 'Pearson', question: 'linear association of two numeric variables', fixture: 'campus-study.csv', pickName: 'Pearson', dataConfig: [], drags: [['study_hours_per_week', 'variableA'], ['exam_score', 'variableB']], set: [],
    scenario: 'Campus study: do study hours predict exam score?' },
  { nn: '21', id: 'spearman', name: 'Spearman', question: 'rank association (ordinal / monotonic)', fixture: 'campus-study.csv', pickName: 'Spearman', dataConfig: [{ column: 'motivation_1', action: 'level:ordinal' }], drags: [['motivation_1', 'variableA'], ['exam_score', 'variableB']], set: [],
    scenario: 'Campus study: does self-reported motivation (Likert) track exam rank?' },
  { nn: '22', id: 'kendalls-tau', name: "Kendall's tau", question: 'rank association, robust to ties', fixture: 'campus-study.csv', pickName: "Kendall's tau", dataConfig: [{ column: 'motivation_1', action: 'level:ordinal' }, { column: 'motivation_2', action: 'level:ordinal' }], drags: [['motivation_1', 'variableA'], ['motivation_2', 'variableB']], set: [],
    scenario: 'Campus study: do two motivation-scale items agree (rank concordance)?' },
  { nn: '23', id: 'chi-square-independence', name: 'Chi-square independence', question: 'are two categorical variables related?', fixture: 'campus-study.csv', pickName: 'Chi-square independence', dataConfig: [], drags: [['teaching_method', 'rowVar'], ['passed_course', 'colVar']], set: [],
    scenario: 'Campus study: is teaching method related to pass/fail?' },
  { nn: '24', id: 'chi-square-goodness-of-fit', name: 'Chi-square goodness-of-fit', question: 'do counts match an expected split?', fixture: 'campus-study.csv', pickName: 'Chi-square goodness-of-fit', dataConfig: [], drags: [['teaching_method', 'variable']], set: [{ label: 'expected proportions', action: 'select', value: 'custom' }, { label: 'proportion: Lecture', action: 'fill', value: '0.5' }, { label: 'proportion: Blended', action: 'fill', value: '0.3' }, { label: 'proportion: Flipped', action: 'fill', value: '0.2' }],
    scenario: "Campus study: does enrollment match the department's planned 50/30/20 method split?" },
  { nn: '25', id: 'fishers-exact', name: "Fisher's exact", question: 'exact test for small categorical tables', fixture: 'campus-study.csv', pickName: "Fisher's exact", dataConfig: [], drags: [['gender', 'rowVar'], ['passed_course', 'colVar']], set: [],
    scenario: 'Campus study: gender x pass/fail, exact test.' },
  { nn: '26', id: 'simple-linear-regression', name: 'Simple linear regression', question: 'one numeric outcome, one predictor', fixture: 'campus-study.csv', pickName: 'Simple linear regression', dataConfig: [], drags: [['exam_score', 'outcome'], ['study_hours_per_week', 'predictor']], set: [],
    scenario: 'Campus study: predicting exam score from study hours alone.' },
  { nn: '27', id: 'multiple-linear-regression', name: 'Multiple linear regression', question: 'one numeric outcome, several predictors', fixture: 'campus-study.csv', pickName: 'Multiple linear regression', dataConfig: [], drags: [['exam_score', 'outcome'], ['pretest_score', 'predictors'], ['study_hours_per_week', 'predictors'], ['teaching_method', 'predictors']], set: [],
    scenario: 'Campus study: exam score from entering ability, study hours, and method together.' },
  { nn: '28', id: 'logistic-regression', name: 'Logistic regression', question: 'predict a yes/no outcome', fixture: 'campus-study.csv', pickName: 'Logistic regression', dataConfig: [], drags: [['passed_course', 'outcome'], ['pretest_score', 'predictors'], ['study_hours_per_week', 'predictors'], ['teaching_method', 'predictors']], set: [{ label: 'event category', action: 'select', value: 'Yes' }],
    scenario: 'Campus study: predicting pass/fail from ability, effort, and method (classification table).' },
  { nn: '29', id: 'poisson-negative-binomial', name: 'Poisson / negative binomial', question: 'predict a count outcome', fixture: 'campus-study.csv', pickName: 'Poisson / negative binomial', dataConfig: [], drags: [['absences', 'outcome'], ['teaching_method', 'predictors'], ['gender', 'predictors'], ['weeks_enrolled', 'exposure']], set: [],
    scenario: 'Campus study: modeling overdispersed absence counts by method and gender.' },
  // seasonal period 4 + horizon 8: macro-quarterly is QUARTERLY — the card's default (12, a monthly
  // convention) mis-fit a [12] seasonal term on the first sweep pass (Ljung-Box p<.001); the README row
  // always documented 4/8, the set actions were simply missing (docs-v2 sweep 2 config fix).
  { nn: '30', id: 'arima-sarima', name: 'ARIMA / SARIMA', question: 'model & forecast one series', fixture: 'macro-quarterly.csv', pickName: 'ARIMA / SARIMA', dataConfig: [], drags: [['quarter', 'time'], ['gdp_growth', 'series']],
    set: [{ label: 'seasonal period', action: 'fill', value: '4' }, { label: 'forecast horizon', action: 'fill', value: '8' }],
    scenario: 'Macro quarterly: forecasting GDP growth over an 8-year business cycle.' },
  { nn: '31', id: 'stationarity-tests', name: 'Stationarity tests (ADF, KPSS)', question: 'is the series stationary?', fixture: 'macro-quarterly.csv', pickName: 'Stationarity tests (ADF, KPSS)', dataConfig: [], drags: [['quarter', 'time'], ['gdp_growth', 'series']], set: [],
    scenario: 'Macro quarterly: is GDP growth stationary around its cyclical mean?' },
  { nn: '32', id: 'granger-causality', name: 'Granger causality', question: 'does X predict future Y?', fixture: 'macro-quarterly.csv', pickName: 'Granger causality', dataConfig: [], drags: [['quarter', 'time'], ['gdp_growth', 'seriesX'], ['unemployment', 'seriesY']], set: [],
    scenario: "Macro quarterly: does GDP growth predict next quarter's unemployment (Okun's law)?" },
  { nn: '33', id: 'var', name: 'VAR', question: 'several interrelated series', fixture: 'macro-quarterly.csv', pickName: 'VAR', dataConfig: [], drags: [['quarter', 'time'], ['gdp_growth', 'series'], ['inflation', 'series'], ['unemployment', 'series']], set: [],
    scenario: 'Macro quarterly: joint dynamics of growth, inflation, and unemployment.' },
  { nn: '34', id: 'fixed-effects', name: 'Fixed effects', question: 'panel regression, entity effects', fixture: 'province-panel.csv', pickName: 'Fixed effects', dataConfig: [{ column: 'year', action: 'level:ordinal' }], drags: [['province', 'entity'], ['year', 'time'], ['growth', 'outcome'], ['investment', 'regressors'], ['education_spend', 'regressors'], ['urbanization', 'regressors']], set: [],
    scenario: 'Province panel: does investment raise growth, controlling for province effects?' },
  { nn: '35', id: 'random-effects', name: 'Random effects', question: 'panel regression, random entity effects', fixture: 'province-panel.csv', pickName: 'Random effects', dataConfig: [{ column: 'year', action: 'level:ordinal' }], drags: [['province', 'entity'], ['year', 'time'], ['growth', 'outcome'], ['investment', 'regressors'], ['education_spend', 'regressors'], ['urbanization', 'regressors']], set: [],
    scenario: "Province panel: random-effects estimate of investment's growth effect." },
  { nn: '36', id: 'hausman-test', name: 'Hausman test', question: 'fixed vs. random effects?', fixture: 'province-panel.csv', pickName: 'Hausman test', dataConfig: [{ column: 'year', action: 'level:ordinal' }], drags: [['province', 'entity'], ['year', 'time'], ['growth', 'outcome'], ['investment', 'regressors'], ['education_spend', 'regressors'], ['urbanization', 'regressors']], set: [],
    scenario: 'Province panel: fixed vs. random effects for the investment-growth model.' },
  { nn: '37', id: 'did', name: 'Difference-in-differences (DiD)', question: 'policy effect, before/after × treated/control', fixture: 'minwage-employment.csv', pickName: 'Difference-in-differences (DiD)', dataConfig: [{ column: 'year', action: 'level:ordinal' }, { column: 'treated', action: 'level:nominal' }, { column: 'post', action: 'level:nominal' }], drags: [['employment', 'outcome'], ['treated', 'treatment'], ['post', 'period'], ['state', 'entity'], ['year', 'time']], set: [],
    scenario: 'Minimum wage: did the 2018 hike change employment relative to non-hike states (parallel pre-trends)?' },
  { nn: '38', id: 'rdd', name: 'Regression discontinuity (RDD)', question: 'effect at a cutoff', fixture: 'scholarship.csv', pickName: 'Regression discontinuity (RDD)', dataConfig: [], drags: [['later_gpa', 'outcome'], ['entrance_score', 'running']], set: [{ label: 'cutoff value', action: 'fill', value: '60' }],
    scenario: 'Scholarship: does crossing the entrance-score cutoff raise later GPA (bandwidth-sensitivity check)?' },
  { nn: '39', id: 'iv-2sls', name: 'Instrumental variables (IV / 2SLS)', question: 'effect with an endogenous predictor', fixture: 'returns-education.csv', pickName: 'Instrumental variables (IV / 2SLS)', dataConfig: [], drags: [['wage', 'outcome'], ['education', 'endogenous'], ['mother_education', 'instruments'], ['experience', 'controls']], set: [],
    scenario: "Returns to education: causal wage effect of schooling, instrumented by mother's education." },
  { nn: '40', id: 'propensity-score-matching', name: 'Propensity score matching', question: 'treatment effect via matching', fixture: 'job-training.csv', pickName: 'Propensity score matching', dataConfig: [{ column: 'enrolled', action: 'level:nominal' }], drags: [['post_earnings', 'outcome'], ['enrolled', 'treatment'], ['age', 'covariates'], ['education_years', 'covariates'], ['prior_earnings', 'covariates']], set: [],
    scenario: 'Job training: does the program raise earnings once we match on background (selection-bias demo)?' },
  // -- Latent variables & SEM - sub-slice A (no canvas): tourism-esg.csv, W4 --
  // Cronbach: items slot requires ordinal/interval; numeric columns auto-detect ratio → set to interval.
  { nn: '41', id: 'cronbachs-alpha', name: "Cronbach's alpha", question: 'internal consistency of one scale', fixture: 'tourism-esg.csv', pickName: "Cronbach's alpha", dataConfig: [{ column: 'esg1', action: 'level:interval' }, { column: 'esg2', action: 'level:interval' }, { column: 'esg3', action: 'level:interval' }, { column: 'esg4', action: 'level:interval' }], drags: [['esg1', 'items'], ['esg2', 'items'], ['esg3', 'items'], ['esg4', 'items']], set: [],
    scenario: 'Tourism ESG: internal consistency of the ESG-perception scale.' },
  // AVE / CR use the construct-slots UI: all five constructs, for the richest discriminant-validity matrix.
  { nn: '42', id: 'ave', name: 'Average variance extracted (AVE)', question: 'convergent & discriminant validity of constructs', fixture: 'tourism-esg.csv', pickName: 'Average variance extracted (AVE)', dataConfig: [], drags: [], set: [],
    constructs: [{ name: 'esg', items: ['esg1', 'esg2', 'esg3', 'esg4'] }, { name: 'norm', items: ['norm1', 'norm2', 'norm3', 'norm4'] }, { name: 'intent', items: ['intent1', 'intent2', 'intent3'] }, { name: 'attitude', items: ['attitude1', 'attitude2', 'attitude3', 'attitude4'] }, { name: 'service_quality', items: ['service_quality1', 'service_quality2', 'service_quality3', 'service_quality4'] }],
    scenario: 'Tourism ESG: convergent & discriminant validity across all five constructs.' },
  { nn: '43', id: 'composite-reliability', name: 'Composite reliability (CR)', question: 'reliability of each construct', fixture: 'tourism-esg.csv', pickName: 'Composite reliability (CR)', dataConfig: [], drags: [], set: [],
    constructs: [{ name: 'esg', items: ['esg1', 'esg2', 'esg3', 'esg4'] }, { name: 'norm', items: ['norm1', 'norm2', 'norm3', 'norm4'] }, { name: 'intent', items: ['intent1', 'intent2', 'intent3'] }, { name: 'attitude', items: ['attitude1', 'attitude2', 'attitude3', 'attitude4'] }, { name: 'service_quality', items: ['service_quality1', 'service_quality2', 'service_quality3', 'service_quality4'] }],
    scenario: 'Tourism ESG: composite reliability of each construct.' },
  { nn: '44', id: 'efa', name: 'Exploratory factor analysis (EFA)', question: 'underlying factors behind a set of items', fixture: 'tourism-esg.csv', pickName: 'Exploratory factor analysis (EFA)', dataConfig: [], drags: [['esg1', 'items'], ['esg2', 'items'], ['esg3', 'items'], ['esg4', 'items'], ['norm1', 'items'], ['norm2', 'items'], ['norm3', 'items'], ['norm4', 'items'], ['intent1', 'items'], ['intent2', 'items'], ['intent3', 'items']],
    set: [{ label: 'rotation', action: 'select', value: 'oblimin' }],
    scenario: 'Tourism ESG: do ESG perception, norm, and intention form three distinct factors?' },
  { nn: '45', id: 'pca', name: 'Principal component analysis (PCA)', question: 'reduce many variables to a few components', fixture: 'tourism-esg.csv', pickName: 'Principal component analysis (PCA)', dataConfig: [], drags: [['esg1', 'variables'], ['esg2', 'variables'], ['esg3', 'variables'], ['esg4', 'variables'], ['norm1', 'variables'], ['norm2', 'variables'], ['norm3', 'variables'], ['norm4', 'variables'], ['intent1', 'variables'], ['intent2', 'variables'], ['intent3', 'variables']], set: [],
    scenario: 'Tourism ESG: reducing 11 survey items to a handful of components.' },
  // -- Latent variables & SEM - sub-slice B (AMOS canvas): tourism-esg.csv, W4 --
  // CB-SEM / PLS-SEM: esg/norm/service_quality -> intent, with attitude MODERATING the norm -> intent path
  // (drawn via the canvas gesture: click the attitude oval, then the norm -> intent path's midpoint).
  { nn: '46', id: 'cb-sem', name: 'CB-SEM', question: 'confirmatory structural model among latent constructs', fixture: 'tourism-esg.csv', pickName: 'CB-SEM', dataConfig: [], drags: [],
    set: [{ label: '1k', action: 'check' }],
    constructs: [{ name: 'esg', items: ['esg1', 'esg2', 'esg3', 'esg4'] }, { name: 'norm', items: ['norm1', 'norm2', 'norm3', 'norm4'] }, { name: 'service_quality', items: ['service_quality1', 'service_quality2', 'service_quality3', 'service_quality4'] }, { name: 'attitude', items: ['attitude1', 'attitude2', 'attitude3', 'attitude4'] }, { name: 'intent', items: ['intent1', 'intent2', 'intent3'] }],
    paths: [['esg', 'intent'], ['norm', 'intent'], ['service_quality', 'intent']],
    moderations: [['attitude', 1]],
    scenario: 'Tourism ESG: does environmental attitude strengthen the norm -> intention link (moderation, simple-slopes figure)?' },
  { nn: '47', id: 'pls-sem', name: 'PLS-SEM', question: 'variance-based structural model (prediction-oriented)', fixture: 'tourism-esg.csv', pickName: 'PLS-SEM', dataConfig: [], drags: [],
    set: [{ label: '1k', action: 'check' }],
    constructs: [{ name: 'esg', items: ['esg1', 'esg2', 'esg3', 'esg4'] }, { name: 'norm', items: ['norm1', 'norm2', 'norm3', 'norm4'] }, { name: 'service_quality', items: ['service_quality1', 'service_quality2', 'service_quality3', 'service_quality4'] }, { name: 'attitude', items: ['attitude1', 'attitude2', 'attitude3', 'attitude4'] }, { name: 'intent', items: ['intent1', 'intent2', 'intent3'] }],
    paths: [['esg', 'intent'], ['norm', 'intent'], ['service_quality', 'intent']],
    moderations: [['attitude', 1]],
    scenario: 'Tourism ESG: the same moderated structural model, estimated variance-based (PLS interaction_term).' },
  // path-analysis (48): observed-only path mode, using the composite SCORE columns (mean of each
  // construct's items) rather than raw items - unuse all 19 raw items + the two composites not in
  // the model, leaving esg_score/norm_score/intent_score (node ids 0, 1, 2 in that column order).
  // Canonical single-mediator-with-direct-effect triangle: esg_score -> norm_score -> intent_score,
  // plus the direct esg_score -> intent_score path (df = 0 saturated, mediation bootstrap).
  { nn: '48', id: 'path-analysis', name: 'Path analysis', question: 'directed-path model among observed variables', fixture: 'tourism-esg.csv', pickName: 'Path analysis',
    dataConfig: [
      { column: 'esg1', action: 'unuse' }, { column: 'esg2', action: 'unuse' }, { column: 'esg3', action: 'unuse' }, { column: 'esg4', action: 'unuse' },
      { column: 'norm1', action: 'unuse' }, { column: 'norm2', action: 'unuse' }, { column: 'norm3', action: 'unuse' }, { column: 'norm4', action: 'unuse' },
      { column: 'intent1', action: 'unuse' }, { column: 'intent2', action: 'unuse' }, { column: 'intent3', action: 'unuse' },
      { column: 'attitude1', action: 'unuse' }, { column: 'attitude2', action: 'unuse' }, { column: 'attitude3', action: 'unuse' }, { column: 'attitude4', action: 'unuse' },
      { column: 'service_quality1', action: 'unuse' }, { column: 'service_quality2', action: 'unuse' }, { column: 'service_quality3', action: 'unuse' }, { column: 'service_quality4', action: 'unuse' },
      { column: 'attitude_score', action: 'unuse' }, { column: 'service_quality_score', action: 'unuse' },
    ],
    set: [{ label: '1k', action: 'check' }], drags: [], nodePaths: [[0, 1], [1, 2], [0, 2]],
    scenario: "Tourism ESG: does ESG perception's effect on intention run partly through norm (observed composites)?" },
]

for (const c of CASES) {
  test(`${c.nn} · ${c.name}`, async ({ page }) => {
    await documentTest(page, c)
  })
}
