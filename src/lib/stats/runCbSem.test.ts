import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runCbSem, computeItemStats, CB_SEM_DEFAULT_MISSING } from './runCbSem'
import { isSaturated } from './semSaturation'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'
import type { TestSetup, Construct } from '../../state/session'
import type { Dataset } from './types'

// Reference values: native R 4.6.0 / lavaan 0.6.21 on lavaan's PoliticalDemocracy (Bollen industrialization→democracy).
// Model: ind60=~x1+x2+x3 · dem60=~y1+y2+y3+y4 · dem65=~y5+y6+y7+y8 · dem60~ind60 · dem65~dem60+ind60 · ind_ie:=a*b.
// Derived 2026-06-20 via Rscript sem(): df=41, chisq=72.462, CFI=.953, TLI=.938, RMSEA=.101 [.061,.139], SRMR=.055.
// std β: ind60→dem60=.448, dem60→dem65=.913, ind60→dem65=.146 · R²: dem60=.201, dem65=.974.
// unstd indirect a*b=1.274 (SE≈.359) · std loadings ind60: x1=.920,x2=.973,x3=.872.

const SETUP: TestSetup = {
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
  paths: [
    { from: 1, to: 2 },
    { from: 2, to: 3 },
    { from: 1, to: 3 },
  ],
}

describe('semSaturation predicate', () => {
  it('isSaturated is true only at df==0', () => {
    expect(isSaturated(0)).toBe(true)
    expect(isSaturated(41)).toBe(false)
    expect(isSaturated(1)).toBe(false)
  })
})

describe('runCbSem', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('Bollen PoliticalDemocracy SEM matches native-R reference values', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/polidemocracy.csv'))
    const result = await runCbSem(engine, data, SETUP)

    // --- mode + saturation ---
    expect(result.mode).toBe('full')
    expect(result.saturated).toBe(false)
    expect(result.fit!.df).toBe(41)

    // --- fit indices ---
    expect(result.fit!.chisq).toBeCloseTo(72.462, 1)
    expect(result.fit!.cfi).toBeCloseTo(0.953, 2)
    expect(result.fit!.tli).toBeCloseTo(0.938, 2)
    expect(result.fit!.rmsea).toBeCloseTo(0.101, 2)
    expect(result.fit!.rmseaLower).toBeCloseTo(0.061, 2)
    expect(result.fit!.rmseaUpper).toBeCloseTo(0.139, 2)
    expect(result.fit!.srmr).toBeCloseTo(0.055, 2)

    // --- CFA loadings present (std loading on ind60→x2 = .973) ---
    const x2 = result.cfaLoadings.find((r) => r.rhs === 'x2')!
    expect(Number(x2.stdLoading)).toBeCloseTo(0.973, 2)

    // --- structural standardized paths (id-keyed) ---
    const s = result.structural!
    const p12 = s.find((r) => r.from === 1 && r.to === 2)!
    const p23 = s.find((r) => r.from === 2 && r.to === 3)!
    const p13 = s.find((r) => r.from === 1 && r.to === 3)!
    expect(Number(p12.stdBeta)).toBeCloseTo(0.448, 2)
    expect(Number(p23.stdBeta)).toBeCloseTo(0.913, 2)
    expect(Number(p13.stdBeta)).toBeCloseTo(0.146, 2)

    // --- R² (endogenous constructs, id-keyed) ---
    expect(result.rsquare![2]).toBeCloseTo(0.201, 2)
    expect(result.rsquare![3]).toBeCloseTo(0.974, 2)

    // --- bootstrapped indirect effect (ind60→dem60→dem65) ---
    // The chain forces se="bootstrap" -> the result must say so (Table 5 CI-honesty fix round).
    expect(result.bootstrapped).toBe(true)
    const ie = result.indirect![0]
    expect(Number(ie.est)).toBeCloseTo(1.274, 1)
    expect(ie.ciLower).not.toBeNull()
    expect(ie.ciUpper).not.toBeNull()
    expect(Number(ie.ciLower)).toBeLessThan(Number(ie.est))
    expect(Number(ie.ciUpper)).toBeGreaterThan(Number(ie.est))

    // --- dual CIs (percentile + bca.simple) from ONE bootstrap run. Reference values computed
    // 2026-07-06 via native Rscript, EXACT model the runner builds (`dem60 ~ p_1_2*ind60`,
    // `dem65 ~ p_2_3*dem60 + p_1_3*ind60`, `ie_1_2_3 := p_1_2*p_2_3`), `set.seed(20260620)`
    // (the runner's existing hardcoded seed), `bootstrap=200`, both `boot.ci.type="perc"` and
    // `"bca.simple"` on the SAME fit:
    //   p_1_2 (ind60->dem60): est=1.474 · percentile CI [0.769, 2.068] · bca.simple CI [0.772, 2.072]
    //   p_2_3 (dem60->dem65): est=0.864 · percentile CI [0.677, 1.088] · bca.simple CI [0.659, 1.079]
    //   p_1_3 (ind60->dem65): est=0.453 · percentile CI [0.013, 0.921] · bca.simple CI [0.023, 0.994]
    //   ie_1_2_3 (indirect): est=1.274 · percentile CI [0.550, 2.004] · bca.simple CI [0.544, 1.999]
    const p12b = s.find((r) => r.from === 1 && r.to === 2)!
    expect(Number(p12b.ciPercLower)).toBeCloseTo(0.769, 2)
    expect(Number(p12b.ciPercUpper)).toBeCloseTo(2.068, 2)
    expect(Number(p12b.ciBcLower)).toBeCloseTo(0.772, 2)
    expect(Number(p12b.ciBcUpper)).toBeCloseTo(2.072, 2)
    const p23b = s.find((r) => r.from === 2 && r.to === 3)!
    expect(Number(p23b.ciPercLower)).toBeCloseTo(0.677, 2)
    expect(Number(p23b.ciBcLower)).toBeCloseTo(0.659, 2)
    const p13b = s.find((r) => r.from === 1 && r.to === 3)!
    expect(Number(p13b.ciPercLower)).toBeCloseTo(0.013, 2)
    expect(Number(p13b.ciBcLower)).toBeCloseTo(0.023, 2)
    const ieb = result.indirect![0]
    expect(Number(ieb.ciPercLower)).toBeCloseTo(0.550, 2)
    expect(Number(ieb.ciPercUpper)).toBeCloseTo(2.004, 2)
    expect(Number(ieb.ciBcLower)).toBeCloseTo(0.544, 2)
    expect(Number(ieb.ciBcUpper)).toBeCloseTo(1.999, 2)

    // --- estimates block for the canvas overlay (numeric ids) ---
    expect(result.estimates.paths).toHaveLength(3)
    expect(result.estimates.r2[3]).toBeCloseTo(0.974, 2)
    expect(result.estimates.loadings['x2']).toBeCloseTo(0.973, 2)

    // --- item Mean/SD (Table 1; complete-case fixture so listwise/fiml agree) ---
    expect(result.itemStats).toHaveLength(11)
    expect(result.itemStats.find((s) => s.item === 'x2')!.mean).toBeGreaterThan(0)

    // --- latent correlation p-values on the SAME ind60/dem60/dem65 measurement model (CFA-only fit,
    // distinct from the structural sem() fit above). Derived 2026-07-06 via native Rscript (cfa(),
    // std.lv=FALSE): ind60-dem60: z=4.393 p<.001 · ind60-dem65: z=6.195 p<.001 · dem60-dem65: z=37.483 p<.001
    expect(result.corLvP).toHaveLength(3)
    expect(result.corLvP[0][1]).toBeLessThan(0.0001)
    expect(result.corLvP[1][2]).toBeLessThan(0.0001)
    expect(result.fornellLarcker).toHaveLength(3)
    expect(result.htmt).toHaveLength(3)
    expect(result.discriminantLabels).toEqual(['ind60', 'dem60', 'dem65'])
  }, 600_000)

  // Regression for the dead ciType mapping (design §U2-T3): a literal 'bca' string passed to lavaan's
  // boot.ci.type would raise an R error ('bca' is not a valid lavaan boot.ci.type -- only 'perc' /
  // 'basic' / 'norm' / 'bca.simple' are). The fixed mapping maps the option's 'bca' value to the valid
  // 'bca.simple' token, so a run with this option set must NOT throw (dual CI is now unconditional and
  // no longer gated by ci_type at all, but the option must still round-trip without erroring).
  it('setup.options.ciType "bca" does not throw (fixed dead mapping -> "bca.simple", a valid lavaan token)', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/polidemocracy.csv'))
    const bcaSetup: TestSetup = { ...SETUP, options: { ...SETUP.options, ciType: 'bca' } }
    await expect(runCbSem(engine, data, bcaSetup)).resolves.toBeDefined()
  }, 600_000)
})

// Reference values: native R 4.6.0 / lavaan on scale.csv (Holzinger-Swineford x1..x9, n=301 complete).
// Observed-only path mode (modelKind:'path'): each construct.name IS the observed column.
// Canonical saturated single-mediator x1 (X) → x4 (M) → x7 (Y) with the direct path x1→x7 ⇒ df=0.
// Model the runner builds: x4 ~ p_1_2*x1 · x7 ~ p_2_3*x4 + p_1_3*x1 · ie_1_2_3 := p_1_2*p_2_3.
// Derived 2026-06-21 via Rscript sem(se="bootstrap", boot=200, seed=20260620):
//   df=0 (saturated) · std β: x1→x4=.373, x4→x7=.173, x1→x7=.002 · unstd B: .372 / .162 / .002
//   R²: x4=.139, x7=.030 · indirect ie est=.060 (std .064), percentile CI finite [≈.018, ≈.105].
// (point estimates β/B/R²/indirect-est are nboot-independent; only the indirect CI bounds vary with nboot.)
const PATH_SETUP: TestSetup = {
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
  paths: [
    { from: 1, to: 2 },
    { from: 2, to: 3 },
    { from: 1, to: 3 },
  ],
}

describe('runCbSem — construct names with spaces', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  // Same Bollen PoliticalDemocracy model/data as above, only the construct DISPLAY NAMES carry spaces
  // (the reported launch blocker: "ESG Perception"-style names crash `cor_lv[construct_names, ...]`
  // because the raw name is illegal lavaan `=~` syntax). Since renaming a construct does not change the
  // fitted numbers, this reuses the exact reference values from the unspaced test above.
  const SPACED_SETUP: TestSetup = {
    ...SETUP,
    constructs: [
      { id: 1, name: 'Industrialization 1960', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'Democracy 1960', items: ['y1', 'y2', 'y3', 'y4'] },
      { id: 3, name: 'Democracy 1965', items: ['y5', 'y6', 'y7', 'y8'] },
    ],
  }

  it('a construct name with spaces runs successfully and the returned tables carry the ORIGINAL spaced name', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/polidemocracy.csv'))
    const result = await runCbSem(engine, data, SPACED_SETUP)

    expect(result.mode).toBe('full')
    expect(result.saturated).toBe(false)
    expect(result.fit!.df).toBe(41)
    expect(result.fit!.chisq).toBeCloseTo(72.462, 1)

    // --- CFA loadings carry the ORIGINAL spaced construct name, not a sanitized R token ---
    const x2 = result.cfaLoadings.find((r) => r.rhs === 'x2')!
    expect(x2.construct).toBe('Industrialization 1960')
    expect(Number(x2.stdLoading)).toBeCloseTo(0.973, 2)

    // --- EVERY std loading finite + substantive (est.std joins survive sanitization end-to-end) ---
    expect(result.cfaLoadings.length).toBe(11)
    for (const row of result.cfaLoadings) {
      expect(Number.isFinite(Number(row.stdLoading))).toBe(true)
      expect(Number(row.stdLoading)).toBeGreaterThan(0.3)
    }

    // --- reliability table carries the ORIGINAL spaced construct name ---
    const relInd = result.reliability.find((r) => r.construct === 'Industrialization 1960')
    expect(relInd).toBeDefined()

    // --- structural paths: fromName/toName are the ORIGINAL spaced names ---
    const s = result.structural!
    const p12 = s.find((r) => r.from === 1 && r.to === 2)!
    expect(p12.fromName).toBe('Industrialization 1960')
    expect(p12.toName).toBe('Democracy 1960')
    expect(Number(p12.stdBeta)).toBeCloseTo(0.448, 2)

    // --- EVERY structural row: std beta + CI finite; R² finite on endogenous rows ---
    for (const row of s) {
      expect(Number.isFinite(Number(row.stdBeta))).toBe(true)
      expect(Number.isFinite(Number(row.ciLower))).toBe(true)
      expect(Number.isFinite(Number(row.ciUpper))).toBe(true)
    }
    expect(Number.isFinite(Number(result.rsquare![2]))).toBe(true)
    expect(Number.isFinite(Number(result.rsquare![3]))).toBe(true)

    // --- indirect effect chain label uses ORIGINAL spaced names ---
    const ie = result.indirect![0]
    expect(String(ie.pathLabel)).toBe('Industrialization 1960 → Democracy 1960 → Democracy 1965')
    expect(Number(ie.est)).toBeCloseTo(1.274, 1)
  }, 600_000)
})

describe('runCbSem — observed-only path mode (modelKind:path)', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('saturated single-mediator on observed columns matches native-R reference values', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/scale.csv'))
    const result = await runCbSem(engine, data, PATH_SETUP)

    // --- mode + saturation (df==0) ---
    expect(result.mode).toBe('path')
    expect(result.saturated).toBe(true)
    expect(isSaturated(result)).toBe(true)
    expect(result.fit!.df).toBe(0)

    // --- NO measurement model in path mode (no loadings; empty R list() may deserialize to [] or {}) ---
    expect(result.cfaLoadings).toHaveLength(0)
    expect(result.reliability).toHaveLength(0)
    expect(Object.keys(result.estimates.loadings)).toHaveLength(0)

    // --- structural standardized βs (id-keyed) match native R ---
    const s = result.structural!
    const p12 = s.find((r) => r.from === 1 && r.to === 2)! // x1 → x4
    const p23 = s.find((r) => r.from === 2 && r.to === 3)! // x4 → x7
    const p13 = s.find((r) => r.from === 1 && r.to === 3)! // x1 → x7 (direct)
    expect(Number(p12.stdBeta)).toBeCloseTo(0.373, 2)
    expect(Number(p23.stdBeta)).toBeCloseTo(0.173, 2)
    expect(Number(p13.stdBeta)).toBeCloseTo(0.002, 2)
    // unstandardized B
    expect(Number(p12.b)).toBeCloseTo(0.372, 2)
    expect(Number(p23.b)).toBeCloseTo(0.162, 2)

    // --- R² (endogenous only, id-keyed) ---
    expect(result.rsquare![2]).toBeCloseTo(0.139, 2) // x4
    expect(result.rsquare![3]).toBeCloseTo(0.030, 2) // x7

    // --- indirect effect x1 → x4 → x7 present + finite, bootstrap CI present ---
    expect(result.indirect).toBeDefined()
    const ie = result.indirect![0]
    expect(Number.isFinite(Number(ie.est))).toBe(true)
    expect(Number(ie.est)).toBeCloseTo(0.06, 2)
    expect(ie.ciLower).not.toBeNull()
    expect(ie.ciUpper).not.toBeNull()
    expect(Number.isFinite(Number(ie.ciLower))).toBe(true)
    expect(Number.isFinite(Number(ie.ciUpper))).toBe(true)
  }, 600_000)
})

describe('computeItemStats — item Mean/SD per missing-setting', () => {
  // Fixture: tests/e2e/fixtures/scale.csv (HolzingerSwineford x1..x9, n=301, complete) with 5 rows of
  // x1 and 5 (different, non-overlapping) rows of x4 blanked to null — exercises listwise (shared N,
  // rows with ANY blank dropped) vs fiml/mi/pairwise (each item's own N). Reference values computed
  // 2026-07-06 via native Rscript (blank d$x1[1:5], d$x4[11:15]; sd() is n-1 sample SD, matching
  // sampleMeanSd here):
  //   observed-per-item: x1 N=296 mean=4.940315 sd=1.172826 · x4 N=296 mean=3.055180 sd=1.162647
  //                       x2 (untouched) N=301 mean=6.088040 sd=1.177451
  //   listwise (rows with ANY of x1..x9 blank dropped, N=291):
  //                       x1 mean=4.932417 sd=1.175751 · x4 mean=3.072165 sd=1.162202 · x2 mean=6.097079 sd=1.180400
  it('fiml/mi/pairwise use each item\'s own observed N; listwise uses the shared estimation-sample N', async () => {
    const raw = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/scale.csv'))
    const rows = raw.rows.map((r) => ({ ...r }))
    for (let i = 0; i < 5; i++) rows[i] = { ...rows[i], x1: null }
    for (let i = 10; i < 15; i++) rows[i] = { ...rows[i], x4: null }
    const data: Dataset = { columns: raw.columns, rows }
    const constructs: Construct[] = [
      { id: 1, name: 'visual', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'textual', items: ['x4', 'x5', 'x6'] },
      { id: 3, name: 'speed', items: ['x7', 'x8', 'x9'] },
    ]
    const usedCols = constructs.flatMap((c) => c.items)
    const listwiseRows = data.rows.filter((r) => usedCols.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number)))
    expect(listwiseRows.length).toBe(291)

    const fiml = computeItemStats(data, constructs, listwiseRows, 'fiml')
    const x1f = fiml.find((s) => s.item === 'x1')!
    const x4f = fiml.find((s) => s.item === 'x4')!
    const x2f = fiml.find((s) => s.item === 'x2')!
    expect(x1f.n).toBe(296); expect(x1f.mean).toBeCloseTo(4.940315, 5); expect(x1f.sd).toBeCloseTo(1.172826, 5)
    expect(x4f.n).toBe(296); expect(x4f.mean).toBeCloseTo(3.055180, 5); expect(x4f.sd).toBeCloseTo(1.162647, 5)
    expect(x2f.n).toBe(301); expect(x2f.mean).toBeCloseTo(6.088040, 5); expect(x2f.sd).toBeCloseTo(1.177451, 5)

    const listwise = computeItemStats(data, constructs, listwiseRows, 'listwise')
    const x1l = listwise.find((s) => s.item === 'x1')!
    const x4l = listwise.find((s) => s.item === 'x4')!
    const x2l = listwise.find((s) => s.item === 'x2')!
    expect(x1l.n).toBe(291); expect(x1l.mean).toBeCloseTo(4.932417, 5); expect(x1l.sd).toBeCloseTo(1.175751, 5)
    expect(x4l.n).toBe(291); expect(x4l.mean).toBeCloseTo(3.072165, 5); expect(x4l.sd).toBeCloseTo(1.162202, 5)
    expect(x2l.n).toBe(291); expect(x2l.mean).toBeCloseTo(6.097079, 5); expect(x2l.sd).toBeCloseTo(1.180400, 5)

    // pairwise buckets with fiml/mi (observed-per-item), not with listwise
    const pairwise = computeItemStats(data, constructs, listwiseRows, 'pairwise')
    expect(pairwise.find((s) => s.item === 'x1')!.n).toBe(296)
  })

  // Regression (default-value seam, slice-5 review): an untouched setup.options has NO 'missing' key
  // (freshSetup filters kind:'display' registry options out of setup.options — see src/state/session.ts).
  // The runner's ONLY fallback for that gap is CB_SEM_DEFAULT_MISSING, the same constant SemControls.tsx
  // uses for the dropdown's displayed default. This proves the runner's effective value for an untouched
  // dropdown is 'listwise' — matching what lavaan::sem() itself does (no `missing=` arg → its own
  // listwise default) — NOT 'fiml' (the stale UI fallback this fix replaces).
  it('an untouched setup.options (no "missing" key) resolves to CB_SEM_DEFAULT_MISSING, identically to explicit listwise', () => {
    expect(CB_SEM_DEFAULT_MISSING).toBe('listwise')

    const raw = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/scale.csv'))
    const data: Dataset = { columns: raw.columns, rows: raw.rows }
    const constructs: Construct[] = [
      { id: 1, name: 'visual', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'textual', items: ['x4', 'x5', 'x6'] },
      { id: 3, name: 'speed', items: ['x7', 'x8', 'x9'] },
    ]
    const usedCols = constructs.flatMap((c) => c.items)
    const listwiseRows = data.rows.filter((r) => usedCols.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number)))

    // Mirrors the exact fallback expression at the runCbSem.ts call site.
    const untouchedOptions: TestSetup['options'] = {}
    const untouched = computeItemStats(data, constructs, listwiseRows, String(untouchedOptions['missing'] ?? CB_SEM_DEFAULT_MISSING))
    const explicitListwise = computeItemStats(data, constructs, listwiseRows, 'listwise')
    expect(untouched).toEqual(explicitListwise)
  })
})
