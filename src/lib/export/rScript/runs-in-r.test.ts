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
import type { Dataset } from '../../stats/types'

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

  // pls-sem: 3 reflective constructs from the seminr 'mobi' example; nboot reduced to 300 for gate time.
  // native-R verified 2026-06-21 (seminr 2.5.0): reliability rhoC Image≈0.833, Satisfaction≈0.871;
  // R^2 Satisfaction≈0.616. Table numbering here is POST-reshape (U6-T6): Table 1 = merged measurement
  // (was Table 1 Outer model + Table 2 Reliability, pre-Unit-6), Table 2 = HTMT, Table 3 = structural paths.
  { id: 'pls-sem', fixture: 'mobi.csv',
    setup: {
      roles: {},
      options: { nboot: 300 },
      props: {},
      blocked: null,
      modelKind: 'latent' as const,
      constructs: [
        { id: 1, name: 'Image', mode: 'reflective' as const, items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
        { id: 2, name: 'Expectation', mode: 'reflective' as const, items: ['CUEX1', 'CUEX2', 'CUEX3'] },
        { id: 3, name: 'Satisfaction', mode: 'reflective' as const, items: ['CUSA1', 'CUSA2', 'CUSA3'] },
      ],
      paths: [
        { from: 1, to: 2 },
        { from: 1, to: 3 },
        { from: 2, to: 3 },
      ],
    },
    expect: ['Table 1: Measurement model', 'Table 2: HTMT', 'Table 3: Structural paths'],
  },

  // pls-sem moderation: full 7-construct mobi model (moderation spike §3 / plsSem.test.ts's MOBI_MOD_SETUP)
  // Expectation moderates Image -> Satisfaction (pathIndex 1). nboot=500 at the runner's pinned seed
  // 20260620 matches plsSem.test.ts's own native-R-verified reference EXACTLY (WebR proved byte-identical
  // to native R at this seed): interaction beta = -0.016341, t = -0.570661, perc CI = [-0.073773, 0.039758].
  { id: 'pls-sem', fixture: 'mobi.csv',
    setup: {
      roles: {}, options: { nboot: 500 }, props: {}, blocked: null, modelKind: 'latent' as const,
      constructs: [
        { id: 1, name: 'Image', mode: 'reflective' as const, items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
        { id: 2, name: 'Expectation', mode: 'reflective' as const, items: ['CUEX1', 'CUEX2', 'CUEX3'] },
        { id: 3, name: 'Quality', mode: 'reflective' as const, items: ['PERQ1', 'PERQ2', 'PERQ3', 'PERQ4', 'PERQ5', 'PERQ6', 'PERQ7'] },
        { id: 4, name: 'Value', mode: 'reflective' as const, items: ['PERV1', 'PERV2'] },
        { id: 5, name: 'Satisfaction', mode: 'reflective' as const, items: ['CUSA1', 'CUSA2', 'CUSA3'] },
        { id: 6, name: 'Complaints', mode: 'reflective' as const, items: ['CUSCO'] },
        { id: 7, name: 'Loyalty', mode: 'reflective' as const, items: ['CUSL1', 'CUSL2', 'CUSL3'] },
      ],
      paths: [
        { from: 1, to: 2 }, { from: 1, to: 5 }, { from: 1, to: 7 },
        { from: 2, to: 3 }, { from: 2, to: 4 }, { from: 2, to: 5 },
        { from: 3, to: 4 }, { from: 3, to: 5 },
        { from: 4, to: 5 },
        { from: 5, to: 6 }, { from: 5, to: 7 },
        { from: 6, to: 7 },
      ],
      moderations: [{ id: 1, moderatorId: 2, pathIndex: 1 }],
    },
    expect: ['Table 1: Measurement model', 'Table 2: HTMT', 'Table 3: Structural paths', 'interaction_term'],
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

  // path-analysis: observed-only CB-SEM, canonical saturated single-mediator X → M → Y (df = 0).
  // x1=X, x4=M, x7=Y from scale.csv; each construct.name IS the observed column (path mode, no =~).
  // The direct path x1→x7 makes the model just-identified (df=0) → the fit table is suppressed and the
  // saturation flag fires; the structural + indirect tables still reach stdout.
  // Needles MATCH the cb-sem emitter's actual output (latent.ts): the saturated-suppression cat line
  // ("--- Model is saturated (df = 0): fit indices not reported ---") and "--- Table 6: Structural paths ---".
  { id: 'path-analysis', fixture: 'scale.csv',
    setup: {
      roles: {},
      options: { estimator: 'ML', nboot: 200, ciType: 'percentile' },
      props: {},
      blocked: null,
      modelKind: 'path',
      constructs: [
        { id: 1, name: 'x1', items: ['x1'] },
        { id: 2, name: 'x4', items: ['x4'] },
        { id: 3, name: 'x7', items: ['x7'] },
      ],
      paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }],
    },
    expect: ['Model is saturated (df = 0)', 'Table 6: Structural paths'],
  },

  // spaced-header fixture (X1/X2, export side): 'customer satisfaction q1' replaces x1 in scale.csv's
  // header only (values unchanged) — the exported script's read.csv() default check.names=TRUE would
  // otherwise mangle it to 'customer.satisfaction.q1' via make.names(), which does NOT match the
  // TS-side lvNames token ('customer_satisfaction_q1') the model string references. cb-sem here is
  // LATENT mode (the item lives inside a construct); path-analysis below is the path-mode rep (the
  // spaced name IS the construct/column name itself).
  { id: 'cb-sem', fixture: 'sem-spaced.csv',
    setup: {
      roles: {},
      options: { estimator: 'ML', nboot: 200, ciType: 'percentile' },
      props: {},
      blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'C1', items: ['customer satisfaction q1', 'x2', 'x3'] },
        { id: 2, name: 'C2', items: ['x4', 'x5', 'x6'] },
        { id: 3, name: 'C3', items: ['x7', 'x8', 'x9'] },
      ],
      paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }],
    },
    expect: ['Table 3: Measurement model'],
  },
  { id: 'path-analysis', fixture: 'sem-spaced.csv',
    setup: {
      roles: {},
      options: { estimator: 'ML', nboot: 200, ciType: 'percentile' },
      props: {},
      blocked: null,
      modelKind: 'path',
      constructs: [
        { id: 1, name: 'customer satisfaction q1', items: ['customer satisfaction q1'] },
        { id: 2, name: 'x4', items: ['x4'] },
        { id: 3, name: 'x7', items: ['x7'] },
      ],
      paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }],
    },
    expect: ['Model is saturated (df = 0)', 'Table 6: Structural paths'],
  },

  // cb-sem moderation: SN/TA/TI matched interaction (spike §2, docs/superpowers/reviews/2026-07-06-moderation-spike.md).
  // bootstrap reduced to 500 (spike's own count) for the native-R time budget — matches the spike's exact numbers.
  { id: 'cb-sem', fixture: 'sem-moderation.csv',
    setup: {
      roles: {}, options: { estimator: 'ML', nboot: 500, ciType: 'percentile' }, props: {}, blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
        { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
        { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
      ],
      paths: [{ from: 1, to: 3 }, { from: 2, to: 3 }],
      moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
    },
    expect: ['slope_lo_1', 'slope_mid_1', 'slope_hi_1'],   // presence of the Table 9 defined-parameter rows
  },
]

// Second moderation config, deliberately NOT added to REPS above: the REP there always draws TA->TI as
// its own structural path, so `alreadyPredicts` (moderationModel.ts's buildModerationLines) is TRUE and
// pmod_1 (the auto-injected moderator main-effect covariate) is NEVER generated for it — its own Table 6
// "no pmod_1 leakage" assertion is vacuous, since there is no pmod_1 anywhere to leak. This config mirrors
// the app's e2e journey where a construct is picked purely as a MODERATOR and never wired as its own drawn
// path (paths: only SN->TI; TA is moderator-only) — that's what makes alreadyPredicts FALSE and actually
// exercises the auto-injection branch. Kept out of the generic exit-0 loop (and its own REPS entry) so its
// assertions below can share a single Rscript run rather than paying for a second execSync.
const MODERATION_MODERATOR_ONLY_REP: Rep = {
  id: 'cb-sem', fixture: 'sem-moderation.csv',
  setup: {
    roles: {}, options: { estimator: 'ML', nboot: 500, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
      { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
      { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
    ],
    paths: [{ from: 1, to: 3 }], // ONLY SN->TI drawn — TA is moderator-only, never its own path
    moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
  },
}

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

  // Dedicated numeric-precision + Table 6 scoping assertions for the moderation REP above — the plain
  // string-containment loop doesn't carry decimal precision or row-count, so these get their own `it`s
  // (mirrors this repo's existing convention for reps that need more than substring presence).
  it(
    'cb-sem moderation — interaction path B matches the spike reference to 6 decimals in native R stdout',
    () => {
      const ds = parseCsv(readFileSync(join(FIXTURES, 'sem-moderation.csv'), 'utf8'))
      const rep = REPS.find((r) => r.fixture === 'sem-moderation.csv')!
      const R = emitRScript([rep.id], { [rep.id]: rep.setup }, SPECS, ds)
      const csv = toCsv(ds)
      const dir = mkdtempSync(join(tmpdir(), 'telos-r-mod-'))
      writeFileSync(join(dir, 'analysis.R'), R)
      writeFileSync(join(dir, 'cleaned.csv'), csv)
      const out = execSync('Rscript analysis.R', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
      // pull the INTERACTION path's estimate out of the printed parameterEstimates rows for the `pint_1` label
      // (pint_1 is the interaction term per U2-T4's label scheme; pmod_1 is the moderator's OWN main effect, a
      // DIFFERENT number - U2-T6's own reference values: pint_1 b=0.25819002, pmod_1 b=0.34369423 - do not
      // conflate them, as an earlier draft of this test did)
      const m = out.match(/pint_1[^\n]*?(-?\d+\.\d+)/)
      expect(m).not.toBeNull()
      // Native-R verified 2026-07-07 (Rscript 4.6.0, this exact config): mod_tab$est[1] = 0.25819002 to 8dp —
      // sprintf("%.8f", ...) needled directly, bypassing R's default 7-sig-fig print truncation. Matches
      // runCbSem.moderation.integration.test.ts's own pin (toBeCloseTo(0.25819002, 4)) exactly — this is the
      // TRUE point estimate (bootstrap SE fits still report the analytic ML estimate, not a bootstrap-draw
      // average, so it is seed-independent and safe to pin tighter than the SE/CI columns).
      expect(Number(m![1])).toBeCloseTo(0.25819002, 6)
    },
    120_000,
  )

  // Table 4.4's fix (04e8e25) scoped Table 6 to grepl("^p_", label) so the interaction row (pint_1) and any
  // auto-injected moderator main-effect covariate (pmod_1) never leak into the structural-paths table under
  // moderation. This REP (SN->TI and TA->TI BOTH drawn) genuinely exercises the pint_1 half of that contract
  // — pint_1 is always present under moderation, so its absence from Table 6 here is a real assertion.
  // It does NOT exercise the pmod_1 half: because TA is already a drawn path into TI, buildModerationLines'
  // `alreadyPredicts` guard (moderationModel.ts) is TRUE and pmod_1 is never generated at all for this
  // config — there is no pmod_1 term anywhere in the fitted model, so checking Table 6 doesn't contain it
  // is vacuously true and proves nothing. The genuine auto-injected-pmod_1 exclusion is proven by the
  // dedicated test below, using a config where the moderator is NOT itself a drawn path.
  it('cb-sem moderation — Table 6 contains only the 2 drawn paths, no pint_ leakage (pmod_1 never generated for this REP)', () => {
    const ds = parseCsv(readFileSync(join(FIXTURES, 'sem-moderation.csv'), 'utf8'))
    const rep = REPS.find((r) => r.fixture === 'sem-moderation.csv')!
    const R = emitRScript([rep.id], { [rep.id]: rep.setup }, SPECS, ds)
    const csv = toCsv(ds)
    const dir = mkdtempSync(join(tmpdir(), 'telos-r-mod-tbl6-'))
    writeFileSync(join(dir, 'analysis.R'), R)
    writeFileSync(join(dir, 'cleaned.csv'), csv)
    const out = execSync('Rscript analysis.R', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })

    const start = out.indexOf('--- Table 6: Structural paths ---')
    const end = out.indexOf('--- R-square (endogenous) ---')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const table6Block = out.slice(start, end)

    // No interaction row and no auto-injected moderator-main-effect row inside Table 6's own block.
    expect(table6Block).not.toContain('pint_1')
    expect(table6Block).not.toContain('pmod_1')
    expect(table6Block).not.toContain('INT_1')

    // Exactly the 2 drawn structural paths (p_1_3 SN->TI, p_2_3 TA->TI) — no more, no fewer. Match on the
    // `label` column token rather than counting printed lines: R's data.frame print wraps onto a second
    // physical line per row once the column count exceeds the console width, which would otherwise double-count.
    const labels = new Set(table6Block.match(/\bp_\d+_\d+\b/g) ?? [])
    expect(labels).toEqual(new Set(['p_1_3', 'p_2_3']))
  })

  // Genuine auto-injected-pmod_1 coverage (the test above's pmod_1 check is vacuous — see its comment).
  // With TA moderator-only (not drawn as its own path into TI), `alreadyPredicts` is FALSE, so buildModel
  // really does splice ` + pmod_1*TA` onto TI's structural line (moderationModel.ts:81). Confirm at the
  // native-R level, in ONE shared Rscript run, that: (1) the model actually fits with that term present —
  // a harness `cat(model_str, ...)` line appended AFTER the fit call proves it (if pmod_1's syntax were
  // bad, lavaan::sem() would already have thrown before the harness line ever ran); (2) Table 6 still
  // contains exactly the ONE drawn path (p_1_3) and nothing else; (3) pint_1 reaches Table 8 and Table 8
  // only. Bootstrap kept at 500 (matches the spike's own count) for the native-R time budget.
  it('cb-sem moderation, moderator-only (not drawn as its own path) — pmod_1 really is in the fitted model but stays out of Table 6; pint_1 lands in Table 8 only', () => {
    const ds = parseCsv(readFileSync(join(FIXTURES, MODERATION_MODERATOR_ONLY_REP.fixture), 'utf8'))
    const R = emitRScript(
      [MODERATION_MODERATOR_ONLY_REP.id],
      { [MODERATION_MODERATOR_ONLY_REP.id]: MODERATION_MODERATOR_ONLY_REP.setup },
      SPECS,
      ds,
    )
    const csv = toCsv(ds)
    const dir = mkdtempSync(join(tmpdir(), 'telos-r-mod-unpred-'))
    // Test-only harness line appended to the EMITTED script (production emitter is untouched) — prints the
    // runtime model_str AFTER the model has already fit successfully, so the harness output is proof the
    // fitted model (not just the JS-generated source text) really contained pmod_1*TA.
    const harnessed = `${R}\ncat("\\n--- MODEL_STR (test harness) ---\\n"); cat(model_str, "\\n")`
    writeFileSync(join(dir, 'analysis.R'), harnessed)
    writeFileSync(join(dir, 'cleaned.csv'), csv)

    // execSync THROWS on a non-zero exit — a clean run (no throw) reaching the harness line below IS the
    // "model fits" assertion (it fits WITH the pmod_1 term, since that term is part of model_str already).
    const out = execSync('Rscript analysis.R', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })

    // (1) pmod_1*TA really is in the model the R engine fit, not just the pre-execution JS string.
    expect(out).toContain('pmod_1*TA')

    const t6start = out.indexOf('--- Table 6: Structural paths ---')
    const t6end = out.indexOf('--- R-square (endogenous) ---')
    const t8start = out.indexOf('--- Table 8: Moderation ---')
    const t8end = out.indexOf('--- Table 9: Conditional effects (simple slopes) ---')
    expect(t6start).toBeGreaterThan(-1)
    expect(t6end).toBeGreaterThan(t6start)
    expect(t8start).toBeGreaterThan(t6end)
    expect(t8end).toBeGreaterThan(t8start)
    const table6Block = out.slice(t6start, t6end)
    const table8Block = out.slice(t8start, t8end)

    // (2) Table 6 = exactly the one drawn path (p_1_3) — the genuine pmod_1 exclusion this REP was built for.
    const labels = new Set(table6Block.match(/\bp_\d+_\d+\b/g) ?? [])
    expect(labels).toEqual(new Set(['p_1_3']))
    expect(table6Block).not.toContain('pmod_1')
    expect(table6Block).not.toContain('pint_1')

    // (3) pint_1 (the interaction term) reaches Table 8 — its only home.
    expect(table8Block).toContain('pint_1')
  }, 120_000)

  // U6-T6: PLS-SEM moderation numeric precision (mirrors the cb-sem moderation test above). The interaction
  // path's own beta/t in Table 3's printed data.frame must match plsSem.test.ts's native-R-verified reference
  // EXACTLY - same seed (20260620) and nboot (500), so this is a genuine cross-check of the export emitter
  // against the already WebR≡native-verified runner, not a fresh derivation.
  it(
    'pls-sem moderation - interaction path beta/t match the native-R reference to 5 decimals, table titles/scoping post-reshape',
    () => {
      const modRep = REPS.filter((r) => r.id === 'pls-sem').find((r) => (r.setup.moderations?.length ?? 0) > 0)!
      const ds = parseCsv(readFileSync(join(FIXTURES, modRep.fixture), 'utf8'))
      const R = emitRScript([modRep.id], { [modRep.id]: modRep.setup }, SPECS, ds)
      const csv = toCsv(ds)
      const dir = mkdtempSync(join(tmpdir(), 'telos-r-pls-mod-'))
      writeFileSync(join(dir, 'analysis.R'), R)
      writeFileSync(join(dir, 'cleaned.csv'), csv)
      const out = execSync('Rscript analysis.R', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })

      const t3start = out.indexOf('--- Table 3: Structural paths ---')
      const t3end = out.indexOf('--- Table 4: Structural quality')
      const t6start = out.indexOf('--- Table 6: Conditional effects (simple slopes) ---')
      expect(t3start).toBeGreaterThan(-1)
      expect(t3end).toBeGreaterThan(t3start)
      expect(t6start).toBeGreaterThan(t3end) // Table 6 only present because moderation ran

      const table3Block = out.slice(t3start, t3end)
      expect(table3Block).toContain('Image*Expectation -> Satisfaction')
      const rowMatch = table3Block.match(/Image\*Expectation -> Satisfaction\s+(-?\d+\.\d+)\s+(-?\d+\.\d+)/)
      expect(rowMatch).not.toBeNull()
      // Native-R verified (plsSem.test.ts's MOBI_MOD_SETUP, same seed 20260620/nboot 500): beta = -0.016341, t = -0.570661
      expect(Number(rowMatch![1])).toBeCloseTo(-0.016341, 5)
      expect(Number(rowMatch![2])).toBeCloseTo(-0.570661, 5)

      // Table 1 (measurement) scoping: the DRAWN constructs only, never the derived interaction pseudo-construct.
      const t1start = out.indexOf('--- Table 1: Measurement model ---')
      const t1end = out.indexOf('--- Table 2: HTMT ---')
      const table1Block = out.slice(t1start, t1end)
      expect(table1Block).not.toContain('Image*Expectation')

      // Export ≡ app: Table 6's printed row now carries p (the SAME bootstrap-proportion formula as
      // plsSem.ts's app-side slope runner - p = 2 * min(mean(draws <= 0), mean(draws > 0)) - not a
      // normal-theory approximation), matching the conditional-effects table the card renders.
      const table6Block = out.slice(t6start)
      const midRowMatch = table6Block.match(/Image\*Expectation \(mean\): b=([-.\d]+) se=([-.\d]+) p=([-.\d]+) ci=/)
      expect(midRowMatch).not.toBeNull()
      // Native-R verified at this seed/nboot (plsSem.test.ts's MOBI_MOD_SETUP reference: mid b=0.180788,
      // ciLower=0.088966/ciUpper=0.291639, both > 0 -> every one of the 500 draws lands on the same side
      // of zero, so the bootstrap-proportion formula gives an exact 0).
      expect(Number(midRowMatch![1])).toBeCloseTo(0.180788, 4)
      const pMid = Number(midRowMatch![3])
      expect(pMid).toBe(0)
    },
    180_000,
  )

  // U10-T2: reviewer's exact repro, proven at the native-R level (not just string-inspected). Two
  // SEM-family tests selected together, sharing a raw column ('a b') whose sanitized token depends on a
  // collision partner ('a.b') that exists in only ONE of the two tests' own item domains. Pre-fix, each
  // emitter's local lvNames() call disagreed on 'a b' -> the losing test's body referenced a column the
  // renamed data frame never had -> `object 'a_b' not found` (or similar) and Rscript exits non-zero.
  // Retention pinned to fixed-n=1 on the efa side (skips the 500-rep parallel-analysis simulation and its
  // sampling variance) and composite-reliability never bootstraps — kept cheap on purpose.
  it('multi-test SEM selection with a cross-test rename collision runs clean in native R (U10 fix)', () => {
    const setupCR: TestSetup = {
      roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent',
      constructs: [{ id: 1, name: 'C1', items: ['a.b', 'x', 'a b'] }],
      paths: [],
    }
    const setupEfa: TestSetup = {
      roles: { items: ['a b', 'y', 'z'] },
      options: { retention: 'fixed-n', nFactors: 1 },
      props: {}, blocked: null,
    }
    // Small correlated synthetic dataset — a.b/x/"a b" share a common factor (so the 1-factor CFA
    // identifies cleanly); y/z are independent filler so efa's 3rd/4th items aren't degenerate.
    const n = 40
    const rows = Array.from({ length: n }, (_, i) => {
      const f = Math.sin(i * 0.7)
      return {
        'a.b': f + Math.sin(i * 1.3) * 0.3,
        x: f + Math.cos(i * 1.1) * 0.3,
        'a b': f + Math.sin(i * 2.1) * 0.3,
        y: Math.cos(i * 0.9),
        z: Math.sin(i * 1.7),
      }
    })
    const ds: Dataset = { columns: ['a.b', 'x', 'a b', 'y', 'z'], rows }

    const R = emitRScript(
      ['composite-reliability', 'efa'],
      { 'composite-reliability': setupCR, efa: setupEfa },
      SPECS,
      ds,
    )
    const csv = toCsv(ds)
    const dir = mkdtempSync(join(tmpdir(), 'telos-r-u10-'))
    writeFileSync(join(dir, 'analysis.R'), R)
    writeFileSync(join(dir, 'cleaned.csv'), csv)

    // execSync THROWS on a non-zero exit — a clean run (no throw) IS the fix's proof: both emitted
    // bodies reference columns that actually exist in the renamed data frame.
    const out = execSync('Rscript analysis.R', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
    expect(out).toContain('--- Table 1: Composite reliability ---')
    expect(out).toContain('--- Table 2: Variance explained ---')
  })
})
