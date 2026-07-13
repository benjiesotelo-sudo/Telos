import { describe, it, expect, vi } from 'vitest'
import { latentEmitters, latentPackages } from './latent'
import type { TestSetup } from '../../../../state/session'
import { withPathModeConstructs } from '../../../../state/session'
import { semFitArgs } from '../../../stats/semFitArgs'
import { runCbSem } from '../../../stats/runCbSem'
import type { Engine } from '../../../webr/engine'
import type { Dataset } from '../../../stats/types'

const SETUP: TestSetup = {
  roles: {},
  options: { estimator: 'ML', nboot: 5000, ciType: 'percentile' },
  props: {},
  blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
    { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
    { id: 3, name: 'dem65', items: ['y5', 'y6', 'y7', 'y8'] },
  ],
  paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }],
}

describe("latentEmitters['cb-sem']", () => {
  const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, SETUP, { columns: [], rows: [] } as never)

  it('builds the lavaan measurement + structural + indirect model', () => {
    expect(r).toContain('ind60 =~ x1 + x2 + x3')
    expect(r).toContain('dem60 =~ y1 + y2 + y3 + y4')
    expect(r).toContain('dem65 ~ ') // dem65 regressed on dem60 + ind60
    expect(r).toContain(':=')        // auto indirect def for ind60 -> dem60 -> dem65
  })

  it('uses lavaan::sem with bootstrap percentile CI and gc() around it', () => {
    expect(r).toContain('lavaan::sem(')
    expect(r).toContain('se = "bootstrap"')
    expect(r).toContain('bootstrap = 5000')
    expect(r).toContain('boot.ci.type = "perc"')
    expect(r).toMatch(/gc\(\)/)
  })

  it('suppresses the fit table when df==0 (shared predicate inline)', () => {
    expect(r).toContain('fitMeasures(fit, "df")')
    expect(r).toContain('== 0') // saturation branch keyed strictly on df==0
  })

  it('draws the diagram via semPlot::semPaths', () => {
    expect(r).toContain('semPlot::semPaths(')
  })

  it('registers its packages', () => {
    expect(latentPackages['cb-sem']).toEqual(
      expect.arrayContaining(['lavaan', 'semTools', 'psych', 'semPlot']),
    )
  })
})

describe("latentEmitters['cb-sem'] - construct names with spaces", () => {
  // Display names with spaces are illegal lavaan `=~`/`~` tokens; the emitter must emit the SAME
  // sanitized identifiers the app runner uses (export ≡ app), never the raw display names.
  const SPACED_SETUP: TestSetup = {
    ...SETUP,
    constructs: [
      { id: 1, name: 'Industrialization 1960', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'Democracy 1960', items: ['y1', 'y2', 'y3', 'y4'] },
      { id: 3, name: 'Democracy 1965', items: ['y5', 'y6', 'y7', 'y8'] },
    ],
  }
  const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, SPACED_SETUP, { columns: [], rows: [] } as never)

  it('emits sanitized latent identifiers in the lavaan model', () => {
    expect(r).toContain('Industrialization_1960 =~ x1 + x2 + x3')
    expect(r).toContain('Democracy_1960 =~ y1 + y2 + y3 + y4')
    expect(r).toContain('Democracy_1960 ~ p_1_2*Industrialization_1960')
    expect(r).toContain('Democracy_1965 ~ p_2_3*Democracy_1960 + p_1_3*Industrialization_1960')
  })

  it('never emits a raw spaced name into the model string', () => {
    expect(r).not.toContain('Industrialization 1960 =~')
    expect(r).not.toContain('Democracy 1960 ~')
    expect(r).not.toContain('*Industrialization 1960')
  })
})

describe("latentEmitters['cb-sem'] - latent moderation (export ≡ app, U5-T4)", () => {
  const MOD_SETUP: TestSetup = {
    roles: {}, options: { estimator: 'ML', nboot: 500, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
      { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
      { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
    ],
    paths: [{ from: 1, to: 3 }, { from: 2, to: 3 }],
    moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
  }
  const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, MOD_SETUP, { columns: [], rows: [] } as never)

  it('emits the indProd data-prep block + model_str already carrying pint_1/slope_*_1 (buildModel is the same fn runCbSem.ts calls)', () => {
    expect(r).toContain('indProd(d, var1 = v1, var2 = v2')
    expect(r).toContain('pint_1')
    expect(r).toContain('slope_lo_1  :=')
    expect(r).toContain('slope_mid_1 :=')
    expect(r).toContain('slope_hi_1  :=')
    expect(r).toContain('mod_matched <- c(TRUE)') // SN/TA both 4 items -> matched
  })

  it('forces bootstrap (moderation widens the gate regardless of any indirect chain) and emits DUAL CI (perc + bca.simple)', () => {
    expect(r).toContain('se = "bootstrap"')
    expect(r).toContain('boot.ci.type = "perc"')
    expect(r).toContain('boot.ci.type = "bca.simple"')
    expect(r).not.toContain('boot.ci.type = "bca"') // never the invalid literal (only "bca.simple" is valid)
  })

  it('prints a Table 8 Moderation table and a Table 9 Conditional effects (simple slopes) table', () => {
    expect(r).toContain('--- Table 8: Moderation ---')
    expect(r).toContain('--- Table 9: Conditional effects (simple slopes) ---')
  })

  it('the semPaths note is scoped to moderation being present', () => {
    expect(r).toContain('semPaths draws the interaction construct')
  })

  it('registers its packages unchanged', () => {
    expect(latentPackages['cb-sem']).toEqual(
      expect.arrayContaining(['lavaan', 'semTools', 'psych', 'semPlot']),
    )
  })

  // Reviewer-verified fixture (moderator-drawn): moderatorId=2 (TA) already has its own drawn path
  // to the target (paths[1] = TA -> TI), so buildModerationLines' alreadyPredicts guard suppresses the
  // pmod_ auto-injected covariate here — but the INT_1 interaction row (lavaan label pint_1) is ALWAYS
  // emitted as a `~` op row on the target regardless. Table 6 (Structural paths) must therefore scope
  // to the drawn paths' own p_<from>_<to> labels (unique to struct_rows in the app runner), never bare
  // `op == "~"`, or it leaks INT_1 as a THIRD "structural" row duplicating Table 8.
  it('Table 6 (Structural paths) is scoped by the p_ path label, not bare op=="~" - no INT_/pint_ leak', () => {
    const peRegLine = r.split('\n').find((l) => l.startsWith('pe_reg <-'))
    expect(peRegLine).toBeDefined()
    expect(peRegLine).toContain('grepl("^p_", pe$label)')
    expect(peRegLine).not.toBe('pe_reg <- pe[pe$op == "~", ]; pe_bc_reg <- pe_bc[pe_bc$op == "~", ]; ss_reg <- ss[ss$op == "~", ]')
  })
})

describe("latentEmitters['cb-sem'] - moderation with unequal indicator counts (match=FALSE disclosure)", () => {
  const UNEQ_SETUP: TestSetup = {
    roles: {}, options: { estimator: 'ML', nboot: 500, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
      { id: 2, name: 'TA3', items: ['ta1', 'ta2', 'ta3'] },
      { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
    ],
    paths: [{ from: 1, to: 3 }],
    moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
  }
  const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, UNEQ_SETUP, { columns: [], rows: [] } as never)

  it('uses match=FALSE and emits the disclosure comment', () => {
    expect(r).toContain('mod_matched <- c(FALSE)')
    expect(r).toContain('all possible pairs')
  })

  // Reviewer-verified fixture (moderator-undrawn): moderatorId=2 (TA3) has NO drawn path anywhere in
  // `paths` (only SN -> TI is drawn), so buildModerationLines' alreadyPredicts guard is false and the
  // auto-injected pmod_1*TA3 main-effect covariate IS spliced onto the target's regression line — a row
  // the app's struct_rows (runCbSem.ts, iterates path_from/path_to only) never surfaces anywhere. Table 6
  // must not leak it either: same p_-label scoping as the moderator-drawn fixture above covers this case
  // too, since pmod_1/pint_1 labels don't match the "^p_" prefix.
  it('Table 6 (Structural paths) excludes the auto-injected pmod_ covariate row (reported nowhere, same as the app)', () => {
    const peRegLine = r.split('\n').find((l) => l.startsWith('pe_reg <-'))
    expect(peRegLine).toBeDefined()
    expect(peRegLine).toContain('grepl("^p_", pe$label)')
  })
})

describe("latentEmitters['cb-sem'] - no moderation (regression guard, U5-T4)", () => {
  const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, SETUP, { columns: [], rows: [] } as never)

  it('never emits moderation-only text when no moderation is drawn', () => {
    expect(r).not.toContain('pint_')
    expect(r).not.toContain('INT_')
    expect(r).not.toContain('indProd(')
    expect(r).not.toContain('--- Table 8: Moderation ---')
    expect(r).not.toContain('semPaths draws the interaction construct')
  })

  it('still emits dual CI on the (non-moderation, indirect) structural/indirect tables', () => {
    expect(r).toContain('boot.ci.type = "perc"')
    expect(r).toContain('boot.ci.type = "bca.simple"')
  })
})

// H1 wiring, Task 7 (export emitter parity): the emitter must build the SAME SemFitArgsInput as the app
// runner (runCbSem.ts, Task 3) and splice fitArgs.fragment into both sem() call sites verbatim, plus a
// student-readable comment block above the fit (one line per non-default choice, zero for defaults).
describe("latentEmitters['cb-sem'] - H1 wiring: export emitter parity (Task 7)", () => {
  // Deliberately non-bootstrap (single direct path, no indirect chain, no moderation): a clean, minimal
  // fixture for the byte-pin and fragment-substitution assertions below.
  const H1_SETUP: TestSetup = {
    roles: {}, options: { estimator: 'ML', nboot: 5000, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'A', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'B', items: ['y1', 'y2', 'y3'] },
    ],
    paths: [{ from: 1, to: 2 }],
  }

  // Byte-pin, deliberately UPDATED by the final-review fix wave (Critical C1 + Important I2): Table 4
  // now fits its own separate continuous reliability CFA (mirrors cfaReliability.ts) instead of reusing
  // the parameterized structural `fit` - this changes the emitted script for EVERY cb-sem export,
  // including this default cell, and that change is accepted (correctness over byte-pin; see the
  // fix-wave report). Every other line stays byte-identical to the pre-H1 snapshot this test used to pin.
  it('default (ML + listwise) setup emits a script byte-identical to the fix-wave snapshot (byte-pin)', () => {
    const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, H1_SETUP, { columns: [], rows: [] } as never)
    expect(r).toMatchSnapshot()
  })

  it('MLR + fiml emits the fit-argument fragment AND the student-readable comment block above the fit', () => {
    const setup: TestSetup = { ...H1_SETUP, options: { ...H1_SETUP.options, estimator: 'MLR', missing: 'fiml' } }
    const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never)
    expect(r).toContain('# Estimator: MLR (robust maximum likelihood) - robust standard errors and scaled fit statistics.')
    expect(r).toContain('# Missing data: FIML (missing = "ml") - uses all available cases instead of dropping incomplete rows.')
    expect(r).toContain('fit <- lavaan::sem(model_str, data = d, estimator = "MLR", missing = "ml")')
  })

  it('WLSMV emits ordered = c(...) with sanitized item names + the ordinal disclosure comment', () => {
    const setup: TestSetup = {
      ...H1_SETUP,
      options: { ...H1_SETUP.options, estimator: 'WLSMV' },
      constructs: [
        { id: 1, name: 'A', items: ['a 1', 'x2', 'x3'] },
        { id: 2, name: 'B', items: ['y1', 'y2', 'y3'] },
      ],
    }
    // Configure-data measurement levels, threaded in as the emitter's 5th argument (session -> export
    // entry point -> emitter, mirroring Task 3's runner threading of the SAME map).
    const columnLevels = { 'a 1': 'ordinal' }
    const r = latentEmitters['cb-sem'](
      { id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never, undefined, columnLevels,
    )
    expect(r).toContain('ordered = c("a_1")')
    expect(r).toContain('# Ordinal indicators (ordered =): a_1 - declared from your Configure-data measurement levels.')
  })

  it('the emitted fragment equals semFitArgs(...).fragment verbatim (the parity assertion)', () => {
    const setup: TestSetup = { ...H1_SETUP, options: { ...H1_SETUP.options, estimator: 'MLR', missing: 'fiml' } }
    const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never)
    const expected = semFitArgs({
      estimator: 'MLR',
      missing: 'fiml',
      indicatorLevels: { x1: 'scale', x2: 'scale', x3: 'scale', y1: 'scale', y2: 'scale', y3: 'scale' },
      itemNameOf: (raw) => raw,
      hasModeration: false,
      wantsBootstrap: false,
    })
    expect(r).toContain(`fit <- lavaan::sem(model_str, data = d, ${expected.fragment})`)
  })

  // Reviewer-requested regression pin: the bootstrap gate is estimator-aware (fitArgs.needsBootstrap,
  // ML only) - an MLR setup WITH a mediation chain must take the PLAIN (non-bootstrap) fit path, never
  // silently fall into se = "bootstrap" (semFitArgs's bootstrapAllowed guard, spike-verified: lavaan
  // does not support bootstrap the same way under robust estimators).
  it('MLR + mediation exports the PLAIN fit (never se = "bootstrap") - the estimator-gated bootstrap pin', () => {
    // SETUP (top of file) carries the mediation chain ind60 -> dem60 -> dem65 (auto := indirect def).
    const setup: TestSetup = { ...SETUP, options: { ...SETUP.options, estimator: 'MLR', missing: 'fiml' } }
    const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never)
    // Sanity: the mediation chain is really in the model (this is not a no-indirect fixture).
    expect(r).toContain(':=')
    // The plain fit call carrying the fragment - NOT the bootstrap call.
    expect(r).toContain('fit <- lavaan::sem(model_str, data = d, estimator = "MLR", missing = "ml")')
    expect(r).not.toContain('se = "bootstrap"')
    expect(r).not.toContain('bootstrap = 5000')
    // None of the bootstrap-path machinery (dual-CI comment + boot.ci.type calls)...
    expect(r).not.toContain('# Dual CI (percentile + bias-corrected) from the SAME bootstrap draws')
    expect(r).not.toContain('boot.ci.type = "perc"')
    expect(r).not.toContain('boot.ci.type = "bca.simple"')
    // ...and the non-bootstrap shape instead (same as the byte-pin's default path): plain
    // parameterEstimates + the blanked pe_bc (never a fabricated bias-corrected interval).
    expect(r).toContain('pe  <- lavaan::parameterEstimates(fit, level = 0.95)')
    expect(r).toContain('pe_bc <- pe; pe_bc$ci.lower <- NA_real_; pe_bc$ci.upper <- NA_real_')
  })

  it('a stale missing:"mi" (removed multiple-imputation option) normalizes to the DEFAULT - no fragment, no comment - exactly like the runner fallback', () => {
    const setup: TestSetup = { ...H1_SETUP, options: { ...H1_SETUP.options, missing: 'mi' } }
    const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never)
    expect(r).toContain('fit <- lavaan::sem(model_str, data = d)')
    expect(r).not.toContain('# Missing data:')
    expect(r).not.toContain('missing = ')
  })

  it('a stale-invalid setup (WLSMV saved but no ordinal indicator after a data change) throws - the guard propagates, never a silent fallback', () => {
    const setup: TestSetup = { ...H1_SETUP, options: { ...H1_SETUP.options, estimator: 'WLSMV' } }
    expect(() =>
      latentEmitters['cb-sem']({ id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never),
    ).toThrow(/at least one ordinal indicator/)
  })
})

// Task 8 (emitter parity + runs-in-r REP, Amendment B, docs/superpowers/specs/2026-07-11-path-mode-
// wlsmv-design.md): the emitter's semFitArgs inputs (indicatorLevels endogeneity downgrade + itemNameOf
// sanitizer) must mirror runCbSem.ts's Task 5 semantics EXACTLY -- same PRODUCTION-shaped setups as
// runCbSem.test.ts's "Path-mode WLSMV cells" describe block (built via withPathModeConstructs, the SAME
// bridge session.ts's runAll/buildExportFiles share), run through BOTH the runner (mocked engine,
// capturing the R source string handed to runJson) and this emitter, asserting the emitted
// `ordered = c(...)` fragment is byte-identical between the two -- the whole point of Task 8.
describe("latentEmitters['cb-sem'] - path-mode WLSMV parity: runner vs emitter (Amendment B, Task 8)", () => {
  const pathData = (cols: string[]): Dataset => ({
    columns: cols,
    rows: Array.from({ length: 10 }, (_, i) => Object.fromEntries(cols.map((c, j) => [c, ((i + j) % 5) + 1]))),
  })

  // Path mode never calls runCfaReliability/capturePlot (mirrors runCbSem.test.ts's fakeEngine) --
  // exactly ONE engine.runJson call per run.
  function fakeEngine() {
    const mainStats = {
      fit: {}, df: 0, cfaLoadings: [], structural: [], rsquareIds: {}, indirect: [],
      estLoadings: {}, estPaths: [], moderationRows: [], slopeRows: [],
    }
    const runJson = vi.fn().mockResolvedValueOnce(mainStats)
    const engine = { runJson } as unknown as Engine
    return { engine, runJson }
  }

  const orderedFrag = (source: string) => source.match(/ordered = c\([^)]*\)/)?.[0]

  it('PATH_WLSMV_SAT setup (b1 ~ a1 + cont1): runner and emitter emit the identical ordered=c("b1") fragment', async () => {
    const setup = withPathModeConstructs({
      roles: {}, options: { estimator: 'WLSMV', nboot: 200, ciType: 'percentile' }, props: {}, blocked: null,
      modelKind: 'path',
      placed: ['a1', 'cont1', 'b1'],
      paths: [{ from: 0, to: 2 }, { from: 1, to: 2 }],
    })
    const columnLevels = { a1: 'ordinal', b1: 'ordinal', cont1: 'scale' }

    const { engine, runJson } = fakeEngine()
    await runCbSem(engine, pathData(['a1', 'cont1', 'b1']), setup, undefined, columnLevels)
    const [runnerSource] = runJson.mock.calls[0] as [string, Record<string, unknown>]

    const r = latentEmitters['cb-sem'](
      { id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never, undefined, columnLevels,
    )

    expect(orderedFrag(runnerSource)).toBe('ordered = c("b1")')
    expect(orderedFrag(r)).toBe('ordered = c("b1")')
    expect(orderedFrag(r)).toBe(orderedFrag(runnerSource))
    // The exogenous-ordinal disclosure comment (a1 is ordinal but purely exogenous here).
    expect(r).toContain(
      '# Ordinal predictor (not declared ordered =): a1 - enters the model numerically, standard practice; ordered-threshold modeling applies to endogenous variables.',
    )
  })

  it('PATH_WLSMV_STRUCT setup (b1 ~ a1 + cont1; b2 ~ b1): runner and emitter emit the identical ordered=c("b1","b2") fragment', async () => {
    const setup = withPathModeConstructs({
      roles: {}, options: { estimator: 'WLSMV', nboot: 200, ciType: 'percentile' }, props: {}, blocked: null,
      modelKind: 'path',
      placed: ['a1', 'cont1', 'b1', 'b2'],
      paths: [{ from: 0, to: 2 }, { from: 1, to: 2 }, { from: 2, to: 3 }],
    })
    const columnLevels = { a1: 'ordinal', b1: 'ordinal', b2: 'ordinal', cont1: 'scale' }

    const { engine, runJson } = fakeEngine()
    await runCbSem(engine, pathData(['a1', 'cont1', 'b1', 'b2']), setup, undefined, columnLevels)
    const [runnerSource] = runJson.mock.calls[0] as [string, Record<string, unknown>]

    const r = latentEmitters['cb-sem'](
      { id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never, undefined, columnLevels,
    )

    expect(orderedFrag(runnerSource)).toBe('ordered = c("b1", "b2")')
    expect(orderedFrag(r)).toBe('ordered = c("b1", "b2")')
    expect(orderedFrag(r)).toBe(orderedFrag(runnerSource))
    expect(r).toContain(
      '# Ordinal predictor (not declared ordered =): a1 - enters the model numerically, standard practice; ordered-threshold modeling applies to endogenous variables.',
    )
  })

  // The H1-ledgered edge (mirrors runCbSem.test.ts's spaced/special-char case): a raw column name that
  // is not already a valid R identifier. Both runner and emitter must sanitize it to the SAME token.
  it('a spaced/special-char endogenous ordinal column sanitizes identically in both runner and emitter', async () => {
    const setup = withPathModeConstructs({
      roles: {}, options: { estimator: 'WLSMV', nboot: 200, ciType: 'percentile' }, props: {}, blocked: null,
      modelKind: 'path',
      placed: ['a1', 'cont1', 'b 1!'],
      paths: [{ from: 0, to: 2 }, { from: 1, to: 2 }],
    })
    const columnLevels = { a1: 'ordinal', 'b 1!': 'ordinal', cont1: 'scale' }

    const { engine, runJson } = fakeEngine()
    await runCbSem(engine, pathData(['a1', 'cont1', 'b 1!']), setup, undefined, columnLevels)
    const [runnerSource] = runJson.mock.calls[0] as [string, Record<string, unknown>]

    const r = latentEmitters['cb-sem'](
      { id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never, undefined, columnLevels,
    )

    expect(orderedFrag(runnerSource)).toBe('ordered = c("b_1")')
    expect(orderedFrag(r)).toBe('ordered = c("b_1")')
    expect(orderedFrag(r)).toBe(orderedFrag(runnerSource))
  })

  // No exogenous ordinal columns placed -> the disclosure comment is absent (byte-pin: this class of
  // setup emits no new line at all).
  it('no exogenous ordinal columns: the disclosure comment is absent', () => {
    const setup = withPathModeConstructs({
      roles: {}, options: { estimator: 'WLSMV', nboot: 200, ciType: 'percentile' }, props: {}, blocked: null,
      modelKind: 'path',
      placed: ['b1', 'cont1'],
      paths: [{ from: 1, to: 0 }],
    })
    const columnLevels = { b1: 'ordinal', cont1: 'scale' }
    const r = latentEmitters['cb-sem'](
      { id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never, undefined, columnLevels,
    )
    expect(orderedFrag(r)).toBe('ordered = c("b1")')
    expect(r).not.toContain('not declared ordered =')
  })

  // ML default path-mode emission is a byte-pin: the endogeneity-downgrade code added for Task 8 is
  // gated on isPath + WLSMV-relevant ordinal levels; a plain default ML path-mode setup with no
  // Configure-data levels supplied must emit an UNCHANGED script (regression guard).
  it('ML path-mode default emission is unaffected (snapshot)', () => {
    const setup = withPathModeConstructs({
      roles: {}, options: { estimator: 'ML', nboot: 200, ciType: 'percentile' }, props: {}, blocked: null,
      modelKind: 'path',
      placed: ['a1', 'cont1', 'b1'],
      paths: [{ from: 0, to: 2 }, { from: 1, to: 2 }],
    })
    const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, setup, { columns: [], rows: [] } as never)
    expect(r).toMatchSnapshot()
  })
})

describe("latentEmitters['ave'] / ['composite-reliability'] - construct names with spaces", () => {
  const SPACED_CFA: TestSetup = {
    roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent',
    constructs: [
      { id: 1, name: 'Visual Perception', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'Verbal Ability', items: ['x4', 'x5', 'x6'] },
    ],
    paths: [],
  }

  it('ave emits sanitized names in the model AND the construct_names indexing vector', () => {
    const r = latentEmitters['ave']({ id: 'ave' } as never, SPACED_CFA, { columns: [], rows: [] } as never)
    expect(r).toContain('Visual_Perception =~ x1 + x2 + x3')
    expect(r).toContain('construct_names <- c("Visual_Perception", "Verbal_Ability")')
    expect(r).not.toContain('Visual Perception =~')
  })

  it('composite-reliability emits sanitized names in the model AND the construct_names indexing vector', () => {
    const r = latentEmitters['composite-reliability'](
      { id: 'composite-reliability' } as never, SPACED_CFA, { columns: [], rows: [] } as never)
    expect(r).toContain('Visual_Perception =~ x1 + x2 + x3')
    expect(r).toContain('construct_names <- c("Visual_Perception", "Verbal_Ability")')
    expect(r).not.toContain('Visual Perception =~')
  })
})

// T1 (R1, board-clearing slice): the EFA pipeline stage in the exported analysis.R - app == export
// parity. When setup.options['efa'] is on (latent mode), the script gains a Tables E1/E2 preamble
// BEFORE the sem() fit, built from the SAME shared fragment the app runner executes (EFA_STAGE_R,
// semEfaStage.ts); off (the default) leaves the script untouched (the byte-pin snapshot above).
describe("latentEmitters['cb-sem'] - EFA stage (Tables E1/E2, export == app)", () => {
  const efaSetup: TestSetup = { ...SETUP, options: { ...SETUP.options, efa: true } }
  const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, efaSetup, { columns: [], rows: [] } as never)

  it('emits the E1/E2 preamble before the fit: complete-cases data, KMO + Bartlett, psych::fa with the shared fixed choices', () => {
    expect(r).toContain('--- Table E1: EFA suitability ---')
    expect(r).toContain('--- Table E2: EFA rotated factor loadings ---')
    expect(r).toContain('psych::KMO(R_efa)$MSA')
    expect(r).toContain('psych::cortest.bartlett(R_efa, n = nrow(d_efa))')
    expect(r).toContain('psych::fa(d_efa, nfactors = efa_k, fm = "pa", rotate = "oblimin")')
    expect(r).toContain('efa_k <- 3L') // factor count fixed to the number of constructs
    expect(r).toContain('complete.cases') // listwise sample, same rule as the app runner
    // items = ALL construct items, in construct order
    expect(r).toContain('efa_items <- c("x1", "x2", "x3", "y1", "y2", "y3", "y4", "y5", "y6", "y7", "y8")')
    // the preamble precedes the model/fit
    expect(r.indexOf('Table E1')).toBeLessThan(r.indexOf('model_str <-'))
  })

  it('efa off (default) emits NO EFA text at all (regression guard for the byte-pin)', () => {
    const off = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, SETUP, { columns: [], rows: [] } as never)
    expect(off).not.toContain('Table E1')
    expect(off).not.toContain('d_efa')
    expect(off).not.toContain('psych::fa(')
  })

  it('path mode ignores the efa option (no measurement items to factor)', () => {
    const pathSetup: TestSetup = {
      roles: {}, options: { estimator: 'ML', nboot: 200, efa: true }, props: {}, blocked: null,
      modelKind: 'path',
      constructs: [
        { id: 0, name: 'x', items: ['x'] },
        { id: 1, name: 'y', items: ['y'] },
      ],
      paths: [{ from: 0, to: 1 }],
    }
    const p = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, pathSetup, { columns: [], rows: [] } as never)
    expect(p).not.toContain('Table E1')
    expect(p).not.toContain('d_efa')
  })

  it('spaced item names reach the EFA block sanitized (same itemNameOf as the fit)', () => {
    const spaced: TestSetup = {
      ...efaSetup,
      constructs: [
        { id: 1, name: 'CS', items: ['customer satisfaction q1', 'x2', 'x3'] },
        { id: 2, name: 'LY', items: ['x4', 'x5', 'x6'] },
      ],
      paths: [{ from: 1, to: 2 }],
    }
    const s = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, spaced, { columns: [], rows: [] } as never)
    expect(s).toContain('efa_items <- c("customer_satisfaction_q1", "x2", "x3", "x4", "x5", "x6")')
    expect(s).not.toContain('"customer satisfaction q1"')
  })
})
