import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from '../../data/parseCsv'
import { emitRScript } from './emit'
import { toCsv } from '../cleanedCsv'
import { SPECS } from '../../registry/catalog'
import type { TestSetup } from '../../../state/session'

// Native-R correctness gate (the export slice's differentiator). For a representative test per family we
// build the cleaned CSV + emit the R via the REAL production pipeline, run it under native Rscript, and
// assert it executes (exit 0) — and for the recently-fixed cases, that a key number reaches stdout.
//
// A full validation already confirmed all 40 emitters run clean and reproduce app numbers in native R 4.6.0;
// this committed subset is regression protection. Auto-runs where Rscript exists (this machine, full `npm test`),
// skips elsewhere. Excluded from `test:fast` via package.json --exclude (mirrors src/lib/stats + src/lib/webr).

const hasR = (() => {
  try {
    execSync('Rscript --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

// fixtures live at <repo>/tests/e2e/fixtures — resolve from this file, not from cwd.
const FIXTURES = fileURLToPath(new URL('../../../../tests/e2e/fixtures/', import.meta.url))

type Rep = {
  id: string
  fixture: string
  setup: TestSetup
  /** substrings that MUST appear in stdout (the verified key numbers) */
  expect?: string[]
}

const mk = (
  id: string,
  fixture: string,
  roles: Record<string, string[]>,
  options: TestSetup['options'] = {},
  expectArr?: string[],
): Rep => ({ id, fixture, setup: { roles, options, props: {}, blocked: null }, expect: expectArr })

// Configs derived from the e2e specs (tests/e2e/*.spec.ts) + the registries (src/lib/registry/<id>.ts).
// One+ per family; includes the three recently-fixed cases (poisson dispersion, grouped describeBy, FE).
const REPS: Rep[] = [
  // --- regression family ---
  mk('simple-linear-regression', 'regression.csv',
    { outcome: ['post_score'], predictor: ['pre_score'] },
    { alpha: 0.05, ci: '95%' },
    ['0.659']), // R² ≈ 0.659
  // poisson dispersion bug — exact bug config from the validation harness
  mk('poisson-negative-binomial', 'regression.csv',
    { outcome: ['complaints'], predictors: ['age', 'group'], exposure: ['months_observed'] },
    { model: 'Poisson', alpha: 0.05, ci: '95%' }),
  mk('logistic-regression', 'regression.csv',
    { outcome: ['passed'], predictors: ['pre_score', 'age', 'group'] },
    { alpha: 0.05, ci: '95%', reportOR: true, event: 'yes' }),

  // --- group / ANOVA family ---
  mk('one-way-anova', 'anova.csv',
    { outcome: ['outcome'], factor: ['group'] },
    { alpha: 0.05, posthoc: 'Tukey HSD', ci: '95%' },
    ['2.80', 'Std. Dev.']), // F ≈ 2.805; Table 1 = datasummary_balance (Task 16b)
  // Task 16b: group "Table 1" descriptives emit datasummary_balance — assert the balance table reaches stdout.
  mk('independent-t-test', 'study.csv',
    { outcome: ['score'], group: ['group'] },
    { alpha: 0.05, tails: 'two-tailed', equalVariance: false, ci: '95%' },
    ['Std. Dev.']),
  mk('factorial-anova', 'anova.csv', // novel ~cell interaction-balance shape
    { outcome: ['outcome'], factors: ['group', 'gender'] },
    { alpha: 0.05 },
    ['Std. Dev.']),
  mk('mann-whitney-u', 'study.csv',
    { outcome: ['score'], group: ['group'] },
    { alpha: 0.05, tails: 'two-tailed', continuity: true }),

  // --- association / descriptive family ---
  mk('pearson', 'association.csv',
    { variableA: ['hours_studied'], variableB: ['exam_score'] },
    { alpha: 0.05, tails: 'two-tailed', ci: '95%' }),
  mk('chi-square-independence', 'association.csv',
    { rowVar: ['method'], colVar: ['passed'] },
    { alpha: 0.05, continuity: true }),
  // grouped describeBy fix — variables + groupBy (NOT the empty-group e2e journey)
  mk('summary-statistics', 'study.csv',
    { variables: ['score'], groupBy: ['group'] },
    {}),
  mk('distribution-normality', 'students.csv',
    { variable: ['score', 'anxiety'] },
    {}),

  // --- panel / causal family ---
  mk('fixed-effects', 'panel.csv',
    { entity: ['firm'], time: ['year'], outcome: ['roa'], regressors: ['leverage', 'rd_spend', 'size'] },
    { effects: 'entity', se: 'clustered by entity', alpha: '0.05' },
    ['-5.57']), // leverage B ≈ -5.574
  mk('iv-2sls', 'causal.csv',
    { outcome: ['wage'], endogenous: ['educ'], instruments: ['educ_iv'], controls: ['exper'] },
    { alpha: 0.05, se: 'robust', weakTest: 'on' }),

  // --- time-series family ---
  mk('arima-sarima', 'timeseries.csv',
    { time: ['month'], series: ['sales'] },
    { order: 'auto-select', seasonalPeriod: 12, horizon: 12 }),

  // --- latent variable / SEM family ---
  mk('cronbachs-alpha', 'scale.csv',
    { items: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'] },
    { standardizedAlpha: false, dropItem: true },
    ['0.76', 'omega:']), // α ≈ 0.7605; ω line confirms compRelSEM ran
  // AVE: 3 constructs × 3 items from scale.csv; asserts AVE + HTMT reach stdout
  { id: 'ave', fixture: 'scale.csv',
    setup: {
      roles: {},
      options: { estimator: 'ML (continuous) · WLSMV (ordinal)' },
      props: {},
      blocked: null,
      constructs: [
        { id: 1, name: 'C1', items: ['x1', 'x2', 'x3'] },
        { id: 2, name: 'C2', items: ['x4', 'x5', 'x6'] },
        { id: 3, name: 'C3', items: ['x7', 'x8', 'x9'] },
      ],
    },
    expect: ['AVE=', 'HTMT'],
  },
  // efa: 9 items from scale.csv (Holzinger-Swineford); asserts KMO + Phi table reach stdout
  mk('efa', 'scale.csv',
    { items: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'] },
    { extraction: 'PAF', rotation: 'oblimin', retention: 'parallel' },
    ['KMO:', 'Table 4: Interfactor correlations (Phi)']),

  // pca: 9 variables from scale.csv (Holzinger-Swineford x1–x9); parallel analysis retains 3
  // native-R verified 2026-06-19: eigenvalues ≈ [3.216, 1.639, 1.365, ...]; cumulative ≈ 35.7%, 53.9%, 69.1%
  mk('pca', 'scale.csv',
    { variables: ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'] },
    { retention: 'parallel', standardize: true },
    ['Parallel analysis retain: 3', 'eigenvalue=3.216', 'eigenvalue=1.639', 'eigenvalue=1.365', 'cumulative=35.7%', 'Table 2: Component loadings']),

  // composite-reliability: 3 constructs × 3 items; asserts CR= substring in stdout
  { id: 'composite-reliability', fixture: 'scale.csv',
    setup: {
      roles: {},
      options: { estimator: 'ML (continuous) · WLSMV (ordinal)' },
      props: {},
      blocked: null,
      constructs: [
        { id: 1, name: 'C1', items: ['x1', 'x2', 'x3'] },
        { id: 2, name: 'C2', items: ['x4', 'x5', 'x6'] },
        { id: 3, name: 'C3', items: ['x7', 'x8', 'x9'] },
      ],
    },
    expect: ['CR=', 'Table 1: Composite reliability'],
  },

  // cb-sem: Bollen PoliticalDemocracy (ind60→dem60→dem65 + direct). df=41 (NOT saturated → fit table prints).
  // native-R verified 2026-06-20: CFI≈.953, indirect a*b≈1.274; nboot reduced to 200 for the time budget.
  { id: 'cb-sem', fixture: 'polidemocracy.csv',
    setup: {
      roles: {},
      options: { estimator: 'ML', nboot: 200, ciType: 'percentile' },
      props: {},
      blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
        { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
        { id: 3, name: 'dem65', items: ['y5', 'y6', 'y7', 'y8'] },
      ],
      paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }],
    },
    expect: ['Table 5: Fit indices', 'Table 7: Indirect effects'],
  },
]

describe.skipIf(!hasR)('native-R correctness gate (export rScript)', () => {
  for (const rep of REPS) {
    const label = rep.expect?.length
      ? `${rep.id} — runs in R + emits ${rep.expect.join(', ')}`
      : `${rep.id} — runs in R (exit 0)`
    it(
      label,
      () => {
        const ds = parseCsv(readFileSync(join(FIXTURES, rep.fixture), 'utf8'))
        const R = emitRScript([rep.id], { [rep.id]: rep.setup }, SPECS, ds)
        const csv = toCsv(ds)

        const dir = mkdtempSync(join(tmpdir(), 'telos-r-'))
        writeFileSync(join(dir, 'analysis.R'), R)
        writeFileSync(join(dir, 'cleaned.csv'), csv)

        // execSync THROWS on a non-zero exit — a clean run (no throw) IS the exit-0 assertion.
        const out = execSync('Rscript analysis.R', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })

        for (const needle of rep.expect ?? []) {
          expect(out).toContain(needle)
        }
      },
      120_000,
    )
  }
})
