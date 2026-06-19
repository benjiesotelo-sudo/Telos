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
type DataCfg = { column: string; action: string } // 'use' | 'level:nominal' | 'level:ordinal'
type SetAction = { label: string; action: 'fill' | 'select' | 'check'; value?: string }
interface Case {
  nn: string; id: string; name: string; question: string; fixture: string
  pickName: string; dataConfig: DataCfg[]; drags: Drag[]; set: SetAction[]
  constructs?: { name: string; items: string[] }[] // construct-slots tests (AVE, CR) — no drag roles
}

async function dragChip(page: Page, chip: string, roleId: string) {
  const src = page.locator('.chip', { hasText: chip }).first()
  const dst = page.locator(`[data-role="${roleId}"]`)
  const a = (await src.boundingBox())!, b = (await dst.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
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
    else if (dc.action.startsWith('level:')) await page.getByLabel(`level of ${dc.column}`).selectOption(dc.action.slice(6))
  }
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await page.getByRole('checkbox', { name: c.pickName, exact: true }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // configure-test: construct-slots (AVE / CR) OR drag columns into role slots
  if (c.constructs) {
    await expect(page.getByRole('button', { name: '+ Add construct' })).toBeVisible()
    for (let i = 0; i < c.constructs.length; i++) {
      await page.getByRole('button', { name: '+ Add construct' }).click()
      // scope item checkboxes to this construct's card (same column names repeat per construct)
      const card = page.locator('.card').filter({ has: page.getByLabel(`Construct ${i + 1} name`) })
      await card.getByLabel(`Construct ${i + 1} name`).fill(c.constructs[i].name)
      for (const item of c.constructs[i].items) await card.getByLabel(item).check()
    }
  } else {
    await expect(page.locator('[data-role]').first()).toBeVisible()
    for (const [chip, role] of c.drags) {
      await dragChip(page, chip, role)
      await expect(page.locator(`[data-role="${role}"]`)).toContainText(chip)
    }
  }
  for (const s of c.set) {
    const el = page.getByLabel(s.label).first()
    if (s.action === 'fill') await el.fill(s.value!)
    else if (s.action === 'select') await el.selectOption(s.value!)
    else await el.check()
  }
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
  await page.screenshot({ path: join(folder, '2-app-output.png'), fullPage: true })

  // PDF piece — the app's print-to-PDF (print stylesheet hides nav/export chrome)
  await page.emulateMedia({ media: 'print' })
  await page.pdf({ path: join(folder, '3-report.pdf'), printBackground: true })
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

const CASES: Case[] = [
  { nn: '01', id: 'summary-statistics', name: 'Summary statistics', question: 'central tendency & spread of numeric variables', fixture: 'students.csv', pickName: 'Summary statistics', dataConfig: [], drags: [['score', 'variables'], ['anxiety', 'variables'], ['gender', 'groupBy']], set: [] },
  { nn: '02', id: 'frequencies-crosstabs', name: 'Frequencies & cross-tabs', question: 'counts for categorical data', fixture: 'study.csv', pickName: 'Frequencies & cross-tabs', dataConfig: [], drags: [['group', 'variables']], set: [] },
  { nn: '03', id: 'distribution-normality', name: 'Distribution & normality', question: 'is a variable normally distributed?', fixture: 'students.csv', pickName: 'Distribution & normality', dataConfig: [], drags: [['score', 'variable'], ['anxiety', 'variable']], set: [] },
  { nn: '04', id: 'one-sample-t-test', name: 'One-sample t-test', question: 'does a mean differ from a fixed value?', fixture: 'paired.csv', pickName: 'One-sample t-test', dataConfig: [], drags: [['post', 'outcome']], set: [{ label: 'test value (μ₀)', action: 'fill', value: '70' }] },
  { nn: '05', id: 'independent-t-test', name: 'Independent t-test', question: "do two groups' means differ?", fixture: 'study.csv', pickName: 'Independent t-test', dataConfig: [], drags: [['score', 'outcome'], ['group', 'group']], set: [] },
  { nn: '06', id: 'paired-t-test', name: 'Paired t-test', question: 'do two related measurements differ?', fixture: 'paired.csv', pickName: 'Paired t-test', dataConfig: [], drags: [['pre', 'conditionA'], ['post', 'conditionB']], set: [] },
  { nn: '07', id: 'one-way-anova', name: 'One-way ANOVA + post-hoc', question: 'do 3+ groups differ, and which pairs?', fixture: 'anova.csv', pickName: 'One-way ANOVA + post-hoc', dataConfig: [], drags: [['outcome', 'outcome'], ['group', 'factor']], set: [] },
  { nn: '08', id: 'factorial-anova', name: 'Factorial ANOVA', question: 'main effects + interaction of 2+ factors', fixture: 'anova.csv', pickName: 'Factorial ANOVA', dataConfig: [], drags: [['outcome', 'outcome'], ['group', 'factors'], ['gender', 'factors']], set: [] },
  { nn: '09', id: 'repeated-measures-anova', name: 'Repeated-measures ANOVA', question: '3+ conditions on the same subjects', fixture: 'anova.csv', pickName: 'Repeated-measures ANOVA', dataConfig: [{ column: 'subject_id', action: 'use' }, { column: 'subject_id', action: 'level:nominal' }], drags: [['subject_id', 'subject'], ['score_t1', 'measures'], ['score_t2', 'measures'], ['score_t3', 'measures']], set: [] },
  { nn: '10', id: 'mixed-anova', name: 'Mixed ANOVA', question: 'between-groups × repeated conditions', fixture: 'anova.csv', pickName: 'Mixed ANOVA', dataConfig: [{ column: 'subject_id', action: 'use' }, { column: 'subject_id', action: 'level:nominal' }], drags: [['subject_id', 'subject'], ['group', 'between'], ['score_t1', 'measures'], ['score_t2', 'measures'], ['score_t3', 'measures']], set: [] },
  { nn: '11', id: 'nested-anova', name: 'Nested ANOVA', question: 'one factor nested within another', fixture: 'anova.csv', pickName: 'Nested ANOVA', dataConfig: [], drags: [['outcome', 'outcome'], ['school', 'factor'], ['classroom', 'nested']], set: [] },
  { nn: '12', id: 'welch-anova', name: "Welch's ANOVA", question: '3+ groups, unequal variances', fixture: 'anova.csv', pickName: "Welch's ANOVA", dataConfig: [], drags: [['outcome', 'outcome'], ['group', 'factor']], set: [] },
  { nn: '13', id: 'ancova', name: 'ANCOVA', question: 'group means adjusted for a covariate', fixture: 'anova.csv', pickName: 'ANCOVA', dataConfig: [], drags: [['outcome', 'outcome'], ['group', 'factor'], ['baseline', 'covariates']], set: [] },
  { nn: '14', id: 'manova', name: 'MANOVA', question: 'groups compared on several outcomes at once', fixture: 'anova.csv', pickName: 'MANOVA', dataConfig: [], drags: [['outcome', 'outcomes'], ['outcome2', 'outcomes'], ['group', 'factors']], set: [] },
  { nn: '15', id: 'mancova', name: 'MANCOVA', question: 'MANOVA with covariate control', fixture: 'anova.csv', pickName: 'MANCOVA', dataConfig: [], drags: [['outcome', 'outcomes'], ['outcome2', 'outcomes'], ['group', 'factors'], ['baseline', 'covariates']], set: [] },
  { nn: '16', id: 'mann-whitney-u', name: 'Mann-Whitney U', question: 'nonparametric two-group comparison', fixture: 'study.csv', pickName: 'Mann-Whitney U', dataConfig: [], drags: [['score', 'outcome'], ['group', 'group']], set: [] },
  { nn: '17', id: 'wilcoxon-signed-rank', name: 'Wilcoxon signed-rank', question: 'nonparametric paired comparison', fixture: 'paired.csv', pickName: 'Wilcoxon signed-rank', dataConfig: [], drags: [['pre', 'conditionA'], ['post', 'conditionB']], set: [] },
  { nn: '18', id: 'kruskal-wallis', name: 'Kruskal-Wallis', question: 'nonparametric 3+ group comparison', fixture: 'anova.csv', pickName: 'Kruskal-Wallis', dataConfig: [], drags: [['outcome', 'outcome'], ['group', 'group']], set: [] },
  { nn: '19', id: 'friedman', name: 'Friedman', question: 'nonparametric repeated measures', fixture: 'anova.csv', pickName: 'Friedman', dataConfig: [{ column: 'subject_id', action: 'use' }, { column: 'subject_id', action: 'level:nominal' }], drags: [['subject_id', 'subject'], ['score_t1', 'measures'], ['score_t2', 'measures'], ['score_t3', 'measures']], set: [] },
  { nn: '20', id: 'pearson', name: 'Pearson', question: 'linear association of two numeric variables', fixture: 'association.csv', pickName: 'Pearson', dataConfig: [], drags: [['hours_studied', 'variableA'], ['exam_score', 'variableB']], set: [] },
  { nn: '21', id: 'spearman', name: 'Spearman', question: 'rank association (ordinal / monotonic)', fixture: 'association.csv', pickName: 'Spearman', dataConfig: [{ column: 'satisfaction', action: 'level:ordinal' }, { column: 'motivation', action: 'level:ordinal' }], drags: [['satisfaction', 'variableA'], ['motivation', 'variableB']], set: [] },
  { nn: '22', id: 'kendalls-tau', name: "Kendall's tau", question: 'rank association, robust to ties', fixture: 'association.csv', pickName: "Kendall's tau", dataConfig: [{ column: 'satisfaction', action: 'level:ordinal' }, { column: 'motivation', action: 'level:ordinal' }], drags: [['satisfaction', 'variableA'], ['motivation', 'variableB']], set: [] },
  { nn: '23', id: 'chi-square-independence', name: 'Chi-square independence', question: 'are two categorical variables related?', fixture: 'association.csv', pickName: 'Chi-square independence', dataConfig: [], drags: [['method', 'rowVar'], ['passed', 'colVar']], set: [] },
  { nn: '24', id: 'chi-square-goodness-of-fit', name: 'Chi-square goodness-of-fit', question: 'do counts match an expected split?', fixture: 'association.csv', pickName: 'Chi-square goodness-of-fit', dataConfig: [], drags: [['method', 'variable']], set: [{ label: 'expected proportions', action: 'select', value: 'custom' }, { label: 'proportion: discussion', action: 'fill', value: '0.5' }, { label: 'proportion: lecture', action: 'fill', value: '0.3' }, { label: 'proportion: seminar', action: 'fill', value: '0.2' }] },
  { nn: '25', id: 'fishers-exact', name: "Fisher's exact", question: 'exact test for small categorical tables', fixture: 'association.csv', pickName: "Fisher's exact", dataConfig: [], drags: [['passed', 'rowVar'], ['gender', 'colVar']], set: [] },
  { nn: '26', id: 'simple-linear-regression', name: 'Simple linear regression', question: 'one numeric outcome, one predictor', fixture: 'regression.csv', pickName: 'Simple linear regression', dataConfig: [], drags: [['post_score', 'outcome'], ['pre_score', 'predictor']], set: [] },
  { nn: '27', id: 'multiple-linear-regression', name: 'Multiple linear regression', question: 'one numeric outcome, several predictors', fixture: 'regression.csv', pickName: 'Multiple linear regression', dataConfig: [], drags: [['post_score', 'outcome'], ['pre_score', 'predictors'], ['age', 'predictors'], ['group', 'predictors'], ['method', 'predictors']], set: [] },
  { nn: '28', id: 'logistic-regression', name: 'Logistic regression', question: 'predict a yes/no outcome', fixture: 'regression.csv', pickName: 'Logistic regression', dataConfig: [], drags: [['passed', 'outcome'], ['pre_score', 'predictors'], ['age', 'predictors'], ['group', 'predictors']], set: [{ label: 'event category', action: 'select', value: 'yes' }] },
  { nn: '29', id: 'poisson-negative-binomial', name: 'Poisson / negative binomial', question: 'predict a count outcome', fixture: 'regression.csv', pickName: 'Poisson / negative binomial', dataConfig: [], drags: [['complaints', 'outcome'], ['age', 'predictors'], ['group', 'predictors'], ['months_observed', 'exposure']], set: [] },
  { nn: '30', id: 'arima-sarima', name: 'ARIMA / SARIMA', question: 'model & forecast one series', fixture: 'timeseries.csv', pickName: 'ARIMA / SARIMA', dataConfig: [], drags: [['month', 'time'], ['sales', 'series']], set: [] },
  { nn: '31', id: 'stationarity-tests', name: 'Stationarity tests (ADF, KPSS)', question: 'is the series stationary?', fixture: 'timeseries.csv', pickName: 'Stationarity tests (ADF, KPSS)', dataConfig: [], drags: [['month', 'time'], ['sales', 'series']], set: [] },
  { nn: '32', id: 'granger-causality', name: 'Granger causality', question: 'does X predict future Y?', fixture: 'timeseries.csv', pickName: 'Granger causality', dataConfig: [], drags: [['month', 'time'], ['ad_spend', 'seriesX'], ['sales', 'seriesY']], set: [] },
  { nn: '33', id: 'var', name: 'VAR', question: 'several interrelated series', fixture: 'timeseries.csv', pickName: 'VAR', dataConfig: [], drags: [['month', 'time'], ['sales', 'series'], ['visitors', 'series']], set: [] },
  { nn: '34', id: 'fixed-effects', name: 'Fixed effects', question: 'panel regression, entity effects', fixture: 'panel.csv', pickName: 'Fixed effects', dataConfig: [{ column: 'year', action: 'level:ordinal' }], drags: [['firm', 'entity'], ['year', 'time'], ['roa', 'outcome'], ['leverage', 'regressors'], ['rd_spend', 'regressors'], ['size', 'regressors']], set: [] },
  { nn: '35', id: 'random-effects', name: 'Random effects', question: 'panel regression, random entity effects', fixture: 'panel.csv', pickName: 'Random effects', dataConfig: [{ column: 'year', action: 'level:ordinal' }], drags: [['firm', 'entity'], ['year', 'time'], ['roa', 'outcome'], ['leverage', 'regressors'], ['rd_spend', 'regressors'], ['size', 'regressors']], set: [] },
  { nn: '36', id: 'hausman-test', name: 'Hausman test', question: 'fixed vs. random effects?', fixture: 'panel.csv', pickName: 'Hausman test', dataConfig: [{ column: 'year', action: 'level:ordinal' }], drags: [['firm', 'entity'], ['year', 'time'], ['roa', 'outcome'], ['leverage', 'regressors'], ['rd_spend', 'regressors'], ['size', 'regressors']], set: [] },
  { nn: '37', id: 'did', name: 'Difference-in-differences (DiD)', question: 'policy effect, before/after × treated/control', fixture: 'panel.csv', pickName: 'Difference-in-differences (DiD)', dataConfig: [{ column: 'year', action: 'level:ordinal' }, { column: 'treated', action: 'level:nominal' }, { column: 'post', action: 'level:nominal' }], drags: [['roa', 'outcome'], ['treated', 'treatment'], ['post', 'period'], ['firm', 'entity'], ['year', 'time']], set: [] },
  { nn: '38', id: 'rdd', name: 'Regression discontinuity (RDD)', question: 'effect at a cutoff', fixture: 'causal.csv', pickName: 'Regression discontinuity (RDD)', dataConfig: [], drags: [['score', 'outcome'], ['running_var', 'running']], set: [] },
  { nn: '39', id: 'iv-2sls', name: 'Instrumental variables (IV / 2SLS)', question: 'effect with an endogenous predictor', fixture: 'causal.csv', pickName: 'Instrumental variables (IV / 2SLS)', dataConfig: [], drags: [['wage', 'outcome'], ['educ', 'endogenous'], ['educ_iv', 'instruments'], ['exper', 'controls']], set: [] },
  { nn: '40', id: 'propensity-score-matching', name: 'Propensity score matching', question: 'treatment effect via matching', fixture: 'causal.csv', pickName: 'Propensity score matching', dataConfig: [{ column: 'enroll', action: 'level:nominal' }], drags: [['health', 'outcome'], ['enroll', 'treatment'], ['exper', 'covariates'], ['age', 'covariates'], ['ability', 'covariates']], set: [] },
  // ── Latent variables & SEM — sub-slice A (no canvas): scale.csv = Holzinger-Swineford x1–x9 ──
  // Cronbach: items slot requires ordinal/interval; scale.csv auto-detects ratio → set x1/x2/x3 to interval.
  { nn: '41', id: 'cronbachs-alpha', name: "Cronbach's alpha", question: 'internal consistency of one scale', fixture: 'scale.csv', pickName: "Cronbach's alpha", dataConfig: [{ column: 'x1', action: 'level:interval' }, { column: 'x2', action: 'level:interval' }, { column: 'x3', action: 'level:interval' }], drags: [['x1', 'items'], ['x2', 'items'], ['x3', 'items']], set: [] },
  // AVE / CR use the construct-slots UI (Benjie's chosen input): 3 constructs = the canonical H-S structure.
  { nn: '42', id: 'ave', name: 'Average variance extracted (AVE)', question: 'convergent & discriminant validity of constructs', fixture: 'scale.csv', pickName: 'Average variance extracted (AVE)', dataConfig: [], drags: [], set: [], constructs: [{ name: 'visual', items: ['x1', 'x2', 'x3'] }, { name: 'textual', items: ['x4', 'x5', 'x6'] }, { name: 'speed', items: ['x7', 'x8', 'x9'] }] },
  { nn: '43', id: 'composite-reliability', name: 'Composite reliability (CR)', question: 'reliability of each construct', fixture: 'scale.csv', pickName: 'Composite reliability (CR)', dataConfig: [], drags: [], set: [], constructs: [{ name: 'visual', items: ['x1', 'x2', 'x3'] }, { name: 'textual', items: ['x4', 'x5', 'x6'] }, { name: 'speed', items: ['x7', 'x8', 'x9'] }] },
  { nn: '44', id: 'efa', name: 'Exploratory factor analysis (EFA)', question: 'underlying factors behind a set of items', fixture: 'scale.csv', pickName: 'Exploratory factor analysis (EFA)', dataConfig: [], drags: [['x1', 'items'], ['x2', 'items'], ['x3', 'items'], ['x4', 'items'], ['x5', 'items'], ['x6', 'items'], ['x7', 'items'], ['x8', 'items'], ['x9', 'items']], set: [] },
  { nn: '45', id: 'pca', name: 'Principal component analysis (PCA)', question: 'reduce many variables to a few components', fixture: 'scale.csv', pickName: 'Principal component analysis (PCA)', dataConfig: [], drags: [['x1', 'variables'], ['x2', 'variables'], ['x3', 'variables'], ['x4', 'variables'], ['x5', 'variables'], ['x6', 'variables'], ['x7', 'variables'], ['x8', 'variables'], ['x9', 'variables']], set: [] },
]

for (const c of CASES) {
  test(`${c.nn} · ${c.name}`, async ({ page }) => {
    await documentTest(page, c)
  })
}
