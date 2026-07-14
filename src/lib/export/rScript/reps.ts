// Shared REP setups for the two consumers that need REAL, valid per-test configurations:
//   1. runs-in-r.test.ts - the native-R correctness gate (runs each REP's emitted analysis.R under Rscript)
//   2. wiringSweep.test.ts - the fast option-wiring gate (flips options, diffs the emitted script; no R)
// Extracted verbatim from runs-in-r.test.ts (T13/R16, board-clearing slice) with ZERO behavior change so
// the wiring sweep no longer has to scrape the test source. Configs derive from the e2e specs
// (tests/e2e/*.spec.ts) + the registries (src/lib/registry/<id>.ts). One+ per family.
import type { TestSetup } from '../../../state/session'

export type Rep = {
  id: string
  fixture: string
  setup: TestSetup
  /** substrings that MUST appear in stdout (the verified key numbers) */
  expect?: string[]
  /** raw dataset column -> Configure-data measurement level (H1 wiring, Task 7's emitRScript param).
   *  Only WLSMV cells need this (ordered= declaration); every other REP falls back to {} (all-scale). */
  columnLevels?: Record<string, string>
}

const mk = (
  id: string,
  fixture: string,
  roles: Record<string, string[]>,
  options: TestSetup['options'] = {},
  expectArr?: string[],
): Rep => ({ id, fixture, setup: { roles, options, props: {}, blocked: null }, expect: expectArr })

// H1 estimator/missing matrix (Task 10): raw column -> level map for the two WLSMV cells' ordered=
// declaration (Task 7's columnLevels param). a1..a3/b1..b3 are the ordinal Likert items; cont1/cont2
// stay scale-level (semFitArgs.ts's orderedRaw filter only picks up 'ordinal').
const LIKERT_MISSING_LEVELS: Record<string, string> = {
  a1: 'ordinal', a2: 'ordinal', a3: 'ordinal',
  b1: 'ordinal', b2: 'ordinal', b3: 'ordinal',
  cont1: 'scale', cont2: 'scale',
}

// Configs derived from the e2e specs (tests/e2e/*.spec.ts) + the registries (src/lib/registry/<id>.ts).
// One+ per family; includes the three recently-fixed cases (poisson dispersion, grouped describeBy, FE).
export const REPS: Rep[] = [
  // --- regression family ---
  mk('simple-linear-regression', 'regression.csv',
    { outcome: ['post_score'], predictor: ['pre_score'] },
    { alpha: 0.05, ci: '95%' },
    ['0.659']), // R² ≈ 0.659
  // poisson dispersion bug - exact bug config from the validation harness
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
  // Task 16b: group "Table 1" descriptives emit datasummary_balance - assert the balance table reaches stdout.
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
  // grouped describeBy fix - variables + groupBy (NOT the empty-group e2e journey)
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
  // R3 (board-clearing T3): the 'test' selector genuinely subsets the emitted calls - one REP per
  // choice so every branch of the emitter is native-R-proven (PP accompanies 'both' only).
  mk('stationarity-tests', 'timeseries.csv',
    { time: ['month'], series: ['sales'] },
    { test: 'both · ADF + KPSS', alpha: 0.05 },
    ['Dickey-Fuller', 'KPSS', 'Phillips-Perron']),
  mk('stationarity-tests', 'timeseries.csv',
    { time: ['month'], series: ['sales'] },
    { test: 'ADF only', alpha: 0.05 },
    ['Dickey-Fuller']),
  mk('stationarity-tests', 'timeseries.csv',
    { time: ['month'], series: ['sales'] },
    { test: 'KPSS only', alpha: 0.05 },
    ['KPSS Test for Level Stationarity']),

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
    expect: ['Table 1: Measurement model', 'Table 2: HTMT', 'Table 3: Structural paths',
      // R6 (Hair 2019 completeness) needles - native-R verified 2026-07-14 (R 4.6.0, seminr 2.5.0;
      // seed-independent estimate_pls point estimates, so the %.6f strings are stable):
      //   f² Image->Expectation=0.3505897754, Image->Satisfaction=0.5128647213,
      //      Expectation->Satisfaction=0.0705561085 (s$fSquare);
      //   inner VIF (s$vif_antecedents): both Satisfaction antecedents = 1.3505897754; Expectation has a
      //   single antecedent -> seminr NA (printed "."), emitted as the literal "NA". Sanity check: for
      //   this triangle model VIF = 1/(1 - beta_ImEx²) = 1 + f²(Image->Expectation) exactly - the
      //   matching .3505897754 digits are the algebra, not a copy-paste error.
      'Image -> Expectation: f2=0.350590 VIF=NA',
      'Image -> Satisfaction: f2=0.512865 VIF=1.350590',
      'Expectation -> Satisfaction: f2=0.070556 VIF=1.350590'],
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
  // T1 (R1, board-clearing slice): efa:true so the Tables E1/E2 preamble (shared EFA_STAGE_R fragment)
  // stays permanently native-R-gated too - needles match the emitter's own cat headers.
  { id: 'cb-sem', fixture: 'polidemocracy.csv',
    setup: {
      roles: {},
      options: { estimator: 'ML', nboot: 200, ciType: 'percentile', efa: true },
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
    // R11 needles (native Rscript 2026-07-14, this exact config): the combined correlation matrix
    // (script Table 4a = the app card's Table 3a) - full ind60 row pins a sqrt(AVE) diagonal (0.927),
    // an off-diagonal latent correlation (0.448) and the composite Mean/SD pair (4.468/1.156, which
    // also matches computeConstructStats' TS pins in runCbSem.test.ts); the dem60/dem65 needles pin
    // the remaining two sqrt(AVE) diagonals (0.787, 0.814).
    expect: ['Table E1: EFA suitability', 'Table E2: EFA rotated factor loadings', 'Table 5: Fit indices', 'Table 7: Indirect effects',
      'Table 4a: Construct correlations, means & SDs (sqrt(AVE) diagonal)',
      'ind60 0.927 0.448 0.555 4.468 1.156', 'dem60 0.448 0.787', 'dem65 0.555 0.978 0.814'],
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
  // header only (values unchanged) - the exported script's read.csv() default check.names=TRUE would
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

  // --- H1 estimator/missing matrix (Task 10) ---
  // 7 cells, pinned against src/lib/stats/h1Pins.ts (native-R ground truth; module doc there explains why
  // it's 7 not 8 - MLR+pairwise is lavaan-invalid). Cells 1-5 fit Bollen PoliticalDemocracy's DIRECT model
  // (ind60=~x1+x2+x3; dem60=~y1+y2+y3+y4; dem60~ind60) on politicalDemocracy-missing.csv - deliberately
  // simpler than the mediation cb-sem REP above (2 constructs, 1 direct path, no indirect chain -> no
  // bootstrap), so the emitted script fits with plain lavaan::sem(..., missing=, estimator=) exactly like
  // the pins were captured. The existing cb-sem REP (polidemocracy.csv, full ind60->dem60->dem65 mediation
  // model with bootstrap) does NOT cover the same cell - different model, different numbers - so it isn't
  // extended; each matrix cell gets its own REP. Cells 6-7 fit the WLSMV mixed ordinal/continuous model
  // (A=~a1+a2+a3; C=~cont1+cont2; B=~b1+b2+b3; B~A+C) on likert5-missing.csv, with columnLevels marking
  // a1..b3 ordinal (Task 7's emitRScript param - WLSMV's `ordered=` fragment reads this).
  // Needle = the structural path's `se` column from Table 6's unrounded print(struct_tab): `est` is
  // IDENTICAL between ML and MLR at a given missing setting (point estimates don't move under a robust
  // estimator - only se/chisq.scaled do), so `se` is the number that actually distinguishes ML from MLR
  // at the same missing setting; `est` distinguishes across missing settings. Format verified against a
  // live native-R run of each cell's own emitted script (R's default print.data.frame digits=7).
  // 8th REP (final-review fix, Critical C1): an ordinal-first-declaration regression case, directly below
  // Cell 7 - covers the once-crashing all-ordinal-first construct order, not a new pinned matrix cell.
  {
    id: 'cb-sem', fixture: 'politicalDemocracy-missing.csv',
    setup: {
      roles: {}, options: { estimator: 'ML', missing: 'listwise' }, props: {}, blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
        { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
      ],
      paths: [{ from: 1, to: 2 }],
    },
    expect: ['0.4774069'], // Cell 1 ML/listwise - h1Pins CELL_1_ML_LISTWISE structural se = 0.47740694
  },
  {
    id: 'cb-sem', fixture: 'politicalDemocracy-missing.csv',
    setup: {
      roles: {}, options: { estimator: 'ML', missing: 'fiml' }, props: {}, blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
        { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
      ],
      paths: [{ from: 1, to: 2 }],
    },
    expect: ['0.3899418'], // Cell 2 ML/fiml - h1Pins CELL_2_ML_FIML structural se = 0.38994176
  },
  {
    id: 'cb-sem', fixture: 'politicalDemocracy-missing.csv',
    setup: {
      roles: {}, options: { estimator: 'ML', missing: 'pairwise' }, props: {}, blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
        { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
      ],
      paths: [{ from: 1, to: 2 }],
    },
    expect: ['0.3623507'], // Cell 3 ML/pairwise - h1Pins CELL_3_ML_PAIRWISE structural se = 0.36235071
  },
  {
    id: 'cb-sem', fixture: 'politicalDemocracy-missing.csv',
    setup: {
      roles: {}, options: { estimator: 'MLR', missing: 'listwise' }, props: {}, blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
        { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
      ],
      paths: [{ from: 1, to: 2 }],
    },
    expect: ['0.4333398'], // Cell 4 MLR/listwise - h1Pins CELL_4_MLR_LISTWISE structural se = 0.4333398
  },
  {
    id: 'cb-sem', fixture: 'politicalDemocracy-missing.csv',
    setup: {
      roles: {}, options: { estimator: 'MLR', missing: 'fiml' }, props: {}, blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
        { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
      ],
      paths: [{ from: 1, to: 2 }],
    },
    // Two needles: the structural se (distinguishes ML from MLR) AND the Table 5 scaled chi-square
    // (final-review fix, Important I1 - the emitter's fit-indices block now requests the SAME
    // estimator-conditional fitMeasures names the app card uses, via semFitArgs.ts's shared
    // semFitMeasureNames(); previously it requested the naive unscaled "chisq" unconditionally, which
    // under MLR would print the WRONG number here - h1Pins CELL_5_MLR_FIML.fit.chisq = 22.15981477,
    // a different value from the scaled one below). Table 5 prints `round(fm, 3)`, not R's default
    // digits=7 print - value verified against a live native-R run of this exact cell's emitted script.
    expect: ['0.3257477', '20.754'], // Cell 5 MLR/fiml - h1Pins CELL_5_MLR_FIML se=0.32574772, chisq.scaled=20.7544659 (round 3dp)
  },
  // Construct order here puts the CONTINUOUS composite (C) first (A/B ordinal, declared second/third).
  // HISTORICAL NOTE (final-review fix, Critical C1): this ordering used to be load-bearing - Table 4's
  // semTools::compRelSEM(fit) ran on the parameterized WLSMV `fit` itself, and compRelSEM's internal
  // `isShared` flag was only initialized on a continuous composite's iteration, so an all-categorical
  // composite processed FIRST threw `object 'isShared' not found`. The fix makes Table 4 fit its OWN
  // separate continuous CFA (mirrors cfaReliability.ts, never given `ordered=`), which sidesteps
  // compRelSEM's ordered-composite path entirely - construct declaration order no longer matters for
  // this crash (proved by the ordinal-first REP directly below, same fixture/model, A declared first).
  // Kept C-first here anyway since the ordering is otherwise arbitrary and the h1Pins.ts "B ~ A" / "B ~ C"
  // row order already matches it.
  {
    id: 'cb-sem', fixture: 'likert5-missing.csv',
    setup: {
      roles: {}, options: { estimator: 'WLSMV', missing: 'listwise' }, props: {}, blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'C', items: ['cont1', 'cont2'] },
        { id: 2, name: 'A', items: ['a1', 'a2', 'a3'] },
        { id: 3, name: 'B', items: ['b1', 'b2', 'b3'] },
      ],
      paths: [{ from: 2, to: 3 }, { from: 1, to: 3 }],
    },
    columnLevels: LIKERT_MISSING_LEVELS,
    expect: ['-0.6615553'], // Cell 6 WLSMV/listwise - h1Pins CELL_6_WLSMV_LISTWISE "B ~ A" est = -0.66155525
  },
  {
    id: 'cb-sem', fixture: 'likert5-missing.csv',
    setup: {
      roles: {}, options: { estimator: 'WLSMV', missing: 'pairwise' }, props: {}, blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'C', items: ['cont1', 'cont2'] },
        { id: 2, name: 'A', items: ['a1', 'a2', 'a3'] },
        { id: 3, name: 'B', items: ['b1', 'b2', 'b3'] },
      ],
      paths: [{ from: 2, to: 3 }, { from: 1, to: 3 }],
    },
    columnLevels: LIKERT_MISSING_LEVELS,
    expect: ['-0.5858436'], // Cell 7 WLSMV/pairwise - h1Pins CELL_7_WLSMV_PAIRWISE "B ~ A" est = -0.58584362
  },
  // Regression REP (final-review fix, Critical C1): the ORDINAL construct (A, all-ordinal) declared
  // FIRST - the ordering the two cells above deliberately avoided pre-fix. Same fixture/estimator/
  // missing as Cell 6 (WLSMV/listwise), same model up to construct declaration order, so the structural
  // numbers are identical to CELL_6_WLSMV_LISTWISE (declaration order does not change what the model
  // fits) - this REP exists to prove the ONCE-crashing ordering now runs clean, not to pin a new number.
  // Reproduced pre-fix (native R, this exact script): `Error in semTools::compRelSEM(fit) : object
  // 'isShared' not found`.
  {
    id: 'cb-sem', fixture: 'likert5-missing.csv',
    setup: {
      roles: {}, options: { estimator: 'WLSMV', missing: 'listwise' }, props: {}, blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'A', items: ['a1', 'a2', 'a3'] },
        { id: 2, name: 'B', items: ['b1', 'b2', 'b3'] },
        { id: 3, name: 'C', items: ['cont1', 'cont2'] },
      ],
      paths: [{ from: 1, to: 2 }, { from: 3, to: 2 }],
    },
    columnLevels: LIKERT_MISSING_LEVELS,
    expect: ['-0.6615553'], // Same model as Cell 6 (declaration order only) - h1Pins CELL_6_WLSMV_LISTWISE "B ~ A" est = -0.66155525
  },

  // path-analysis (Task 8, Amendment B, docs/superpowers/specs/2026-07-11-path-mode-wlsmv-design.md):
  // the PATH_WLSMV_STRUCT cell (h1Pins.ts) as a PATH-MODE export - `b1 ~ a1 + cont1; b2 ~ b1`, non-
  // saturated (df=2). a1 is ordinal but purely EXOGENOUS (no path points into it), so per Amendment B it
  // stays numeric/undeclared (the disclosure case); b1 and b2 are ordinal AND endogenous, so
  // `ordered = c("b1", "b2")` - this is the emitter-side endogeneity downgrade this task added (mirrors
  // runCbSem.ts's Task 5 logic, verified byte-identical against the runner in latent.cbsem.test.ts).
  // Needle = the `b2 ~ b1` row's `est`, printed unrounded by Table 6's plain `print(struct_tab)` (R's
  // default print.data.frame digits=7, same convention as cells 6/7's `se` needles above) - this row is
  // CELL-DISTINGUISHING: it exists only in the non-saturated STRUCT model, not in the saturated SAT
  // model (which has no b2) or in cells 6/7 (a latent CFA model, not path mode). Live native-R run of
  // this exact emitted script (2026-07-11) printed `est = 0.3947533`, matching h1Pins
  // PATH_WLSMV_STRUCT.structural "b2 ~ b1" est = 0.39475332 to the printed precision - byte-for-byte
  // reproduction of the runner's own known-answer cell (runCbSem.test.ts's path-mode WLSMV describe
  // block), export ≡ app.
  {
    id: 'path-analysis', fixture: 'likert5-missing.csv',
    setup: {
      roles: {}, options: { estimator: 'WLSMV', missing: 'listwise', nboot: 200, ciType: 'percentile' }, props: {}, blocked: null,
      modelKind: 'path',
      constructs: [
        { id: 1, name: 'a1', items: ['a1'] },
        { id: 2, name: 'cont1', items: ['cont1'] },
        { id: 3, name: 'b1', items: ['b1'] },
        { id: 4, name: 'b2', items: ['b2'] },
      ],
      paths: [{ from: 1, to: 3 }, { from: 2, to: 3 }, { from: 3, to: 4 }],
    },
    columnLevels: { a1: 'ordinal', b1: 'ordinal', b2: 'ordinal', cont1: 'scale' },
    expect: ['0.3947533'],
  },

  // cb-sem moderation: SN/TA/TI matched interaction (spike §2, docs/superpowers/reviews/2026-07-06-moderation-spike.md).
  // bootstrap reduced to 500 (spike's own count) for the native-R time budget - matches the spike's exact numbers.
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
