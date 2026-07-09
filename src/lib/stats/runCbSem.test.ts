import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Engine } from '../webr/engine'
import { runCbSem, computeItemStats, CB_SEM_DEFAULT_MISSING } from './runCbSem'
import type { CbSemResult } from './runCbSem'
import { isSaturated } from './semSaturation'
import { loadCsvFixture } from './csvFixture'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TestSetup, Construct } from '../../state/session'
import type { Dataset } from './types'
import {
  CELL_1_ML_LISTWISE, CELL_2_ML_FIML, CELL_3_ML_PAIRWISE,
  CELL_4_MLR_LISTWISE, CELL_5_MLR_FIML,
  CELL_6_WLSMV_LISTWISE, CELL_7_WLSMV_PAIRWISE,
  type H1PinCell,
} from './h1Pins'

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

describe('runCbSem — spaced ITEM names (X1 app-side fix)', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  // Same Bollen PoliticalDemocracy model/data as the top-of-file SETUP, only the ITEM (indicator) column
  // names carry spaces -- the measurement model's `=~` RHS (`c.items.join(' + ')`) and `colnames(d)` both
  // need the SAME sanitized token or lavaan either fails to parse or the data frame columns silently
  // misalign. Renaming items doesn't change the fitted numbers, so this reuses the exact reference
  // values from the SETUP test above.
  const ITEM_RENAME: Record<string, string> = {
    x1: 'industrial score 1', x2: 'industrial score 2', x3: 'industrial score 3',
    y1: 'democracy 1960 a', y2: 'democracy 1960 b', y3: 'democracy 1960 c', y4: 'democracy 1960 d',
    y5: 'democracy 1965 a', y6: 'democracy 1965 b', y7: 'democracy 1965 c', y8: 'democracy 1965 d',
  }
  const SPACED_ITEM_SETUP: TestSetup = {
    ...SETUP,
    constructs: [
      { id: 1, name: 'ind60', items: ['industrial score 1', 'industrial score 2', 'industrial score 3'] },
      { id: 2, name: 'dem60', items: ['democracy 1960 a', 'democracy 1960 b', 'democracy 1960 c', 'democracy 1960 d'] },
      { id: 3, name: 'dem65', items: ['democracy 1965 a', 'democracy 1965 b', 'democracy 1965 c', 'democracy 1965 d'] },
    ],
  }

  it('spaced item names run successfully (latent mode) and preserve display names in cfaLoadings/estimates.loadings/itemStats', async () => {
    const raw = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/polidemocracy.csv'))
    const spacedData: Dataset = {
      columns: raw.columns.map((c) => ITEM_RENAME[c] ?? c),
      rows: raw.rows.map((r) => {
        const row: Dataset['rows'][number] = {}
        for (const [k, v] of Object.entries(r)) row[ITEM_RENAME[k] ?? k] = v
        return row
      }),
    }
    const result = await runCbSem(engine, spacedData, SPACED_ITEM_SETUP)

    expect(result.fit!.df).toBe(41)
    expect(result.fit!.chisq).toBeCloseTo(72.462, 1)

    // --- cfaLoadings: the displayed `item` carries the ORIGINAL spaced name, never the sanitized R token ---
    const x2 = result.cfaLoadings.find((r) => r.item === 'industrial score 2')!
    expect(x2).toBeDefined()
    expect(x2.construct).toBe('ind60')
    expect(Number(x2.stdLoading)).toBeCloseTo(0.973, 2)

    // --- canvas overlay (estimates.loadings) is keyed by the RAW display item name -- SemCanvas looks
    // it up via Construct.items, which never gets sanitized ---
    expect(result.estimates.loadings['industrial score 2']).toBeCloseTo(0.973, 2)

    // --- structural paths/R² unaffected (paths key off construct ids, not items) ---
    const s = result.structural!
    const p12 = s.find((r) => r.from === 1 && r.to === 2)!
    expect(Number(p12.stdBeta)).toBeCloseTo(0.448, 2)
    expect(result.rsquare![3]).toBeCloseTo(0.974, 2)

    // --- item Mean/SD (Table 1) still keyed by the raw display item name ---
    expect(result.itemStats.find((st) => st.item === 'industrial score 2')).toBeDefined()
  }, 600_000)

  // Path mode's item/column sanitization was ALREADY correct before this fix (construct.name doubles as
  // the observed column, sanitized via rNameOf) -- this proves that pre-existing correctness isn't
  // regressed by the new item-sanitization code path added for latent/full/cfa-only mode. In path mode
  // the construct NAME is the actual data column (not `.items`), so renaming it to a spaced display
  // label requires renaming the underlying dataset column to match, same as the CSV-header rename used
  // for the latent-mode item tests above.
  it('path mode with spaced observed-column (construct) names is unaffected by the item-sanitization fix', async () => {
    const raw = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/scale.csv'))
    const data: Dataset = {
      columns: raw.columns.map((c) => (c === 'x4' ? 'perceptual speed score' : c)),
      rows: raw.rows.map((r) => {
        const row: Dataset['rows'][number] = {}
        for (const [k, v] of Object.entries(r)) row[k === 'x4' ? 'perceptual speed score' : k] = v
        return row
      }),
    }
    const spacedPathSetup: TestSetup = {
      ...PATH_SETUP,
      constructs: [
        { id: 1, name: 'x1', items: ['x1'] },
        { id: 2, name: 'perceptual speed score', items: ['perceptual speed score'] },
        { id: 3, name: 'x7', items: ['x7'] },
      ],
      paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }],
    }
    const result = await runCbSem(engine, data, spacedPathSetup)

    expect(result.mode).toBe('path')
    expect(result.saturated).toBe(true)
    expect(result.fit!.df).toBe(0)
    expect(result.cfaLoadings).toHaveLength(0) // no measurement model in path mode

    const s = result.structural!
    const p12 = s.find((r) => r.from === 1 && r.to === 2)!
    const p23 = s.find((r) => r.from === 2 && r.to === 3)!
    expect(p12.toName).toBe('perceptual speed score')
    expect(Number(p12.stdBeta)).toBeCloseTo(0.373, 2)
    expect(Number(p23.stdBeta)).toBeCloseTo(0.173, 2)
    expect(result.rsquare![2]).toBeCloseTo(0.139, 2)
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

// H1 wiring (docs/superpowers/specs/2026-07-10-h1-estimator-missing-wiring-design.md): runCbSem now
// consumes semFitArgs.ts for the estimator/missing/ordered fragment, estimator-conditional robust fit
// measures, the full-rows-with-NA missing-data path, and the ML-only bootstrap gate. TDD against the
// MOCKED engine only -- the real-WebR 8-cell known-answer matrix (native-R pins from the Task 0 spike,
// docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md) is a later task. Follows the mocked-engine
// pattern established in runCbSem.moderation.test.ts (engine.runJson captured source/env assertions).
describe('runCbSem - semFitArgs wiring (mocked engine, no WebR)', () => {
  const items = { a: ['a1', 'a2'], b: ['b1', 'b2'], c: ['c1', 'c2'] }
  const allCols = [...items.a, ...items.b, ...items.c]
  const data: Dataset = {
    columns: allCols,
    rows: Array.from({ length: 10 }, (_, i) => Object.fromEntries(allCols.map((c, j) => [c, i + j + 1]))),
  }
  // Two constructs, one direct path: no indirect chain, no moderation -- wantsBootstrap is false here
  // regardless of estimator, so this setup isolates the fragment/fit-measures/full-rows plumbing from
  // the bootstrap gate (covered separately below by the three-construct chain setup).
  const baseSetup: TestSetup = {
    roles: {}, options: { estimator: 'ML', nboot: 200, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'A', items: items.a },
      { id: 2, name: 'B', items: items.b },
    ],
    paths: [{ from: 1, to: 2 }],
  }
  // Three-construct chain A->B->C (+ direct A->C): buildModel auto-derives an indirect := def, so
  // hasIndirect is true -- this is what wantsBootstrap keys off.
  const chainSetup: TestSetup = {
    ...baseSetup,
    constructs: [
      { id: 1, name: 'A', items: items.a },
      { id: 2, name: 'B', items: items.b },
      { id: 3, name: 'C', items: items.c },
    ],
    paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }],
  }

  const cfaResult2 = {
    perConstruct: [
      { name: 'A', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
      { name: 'B', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
    ],
    fornellLarcker: [[1, 0], [0, 1]], htmt: [[0, 0], [0, 0]], labels: ['A', 'B'], corLvP: [[0, 0], [0, 0]],
  }
  const cfaResult3 = {
    perConstruct: [
      { name: 'A', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
      { name: 'B', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
      { name: 'C', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
    ],
    fornellLarcker: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], htmt: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    labels: ['A', 'B', 'C'], corLvP: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  }
  const baseRaw2 = {
    fit: {}, df: 1, cfaLoadings: [], structural: [], rsquareIds: { 2: 0.4 }, indirect: [],
    estLoadings: {}, estPaths: [], moderationRows: [], slopeRows: [],
  }
  const chainRaw3 = {
    fit: {}, df: 1, cfaLoadings: [], structural: [], rsquareIds: { 2: 0.4, 3: 0.5 },
    indirect: [{ label: 'ie_1_2_3', est: 0.1, se: 0.1, ciLower: -0.1, ciUpper: 0.3, ciPercLower: -0.1, ciPercUpper: 0.3, ciBcLower: -0.1, ciBcUpper: 0.3, p: 0.3 }],
    estLoadings: {}, estPaths: [], moderationRows: [], slopeRows: [],
  }

  /** Fakes the two engine.runJson round-trips runCbSem makes in latent mode (main R_STATS block, then
   *  runCfaReliability's own block) -- same pattern as runCbSem.moderation.test.ts's fakeEngine. */
  function fakeEngine(mainStats: Record<string, unknown>, cfaResult: Record<string, unknown>) {
    const runJson = vi.fn().mockResolvedValueOnce(mainStats).mockResolvedValueOnce(cfaResult)
    const engine = { runJson } as unknown as Engine
    return { engine, runJson }
  }

  it('ML + listwise (untouched setup): the generated R source matches the pre-H1 baseline exactly, apart from the has_indirect guard this task adds to moderation ciBc* reads', async () => {
    const { engine, runJson } = fakeEngine(baseRaw2, cfaResult2)
    await runCbSem(engine, data, baseSetup)
    const [source] = runJson.mock.calls[0] as [string, Record<string, unknown>]

    // Golden fixture: the ACTUAL pre-H1 runCbSem's generated R source for this exact setup (captured
    // by running the pre-change code, not transcribed by hand -- see the Task 3 report for provenance).
    const golden = readFileSync(join(__dirname, 'fixtures/runCbSemPreH1.r.txt'), 'utf-8')

    // The ONE mandated correctness fix this task also makes (parent task brief "Bootstrap gate" note):
    // mod_rows/slope_rows' ciBcLower/ciBcUpper now read has_indirect-guarded, exactly like struct_rows/
    // indirect_rows already did -- moderation under MLR is now legal but never bootstraps, so pe_bc is
    // just pe aliased back (Wald CIs) and must read as NA, not masquerade as a bootstrap BC interval.
    const goldenWithGuardFix = golden
      .replace(
        'ciBcLower = as.numeric(pe_bc$ci.lower[mb]), ciBcUpper = as.numeric(pe_bc$ci.upper[mb])',
        'ciBcLower = if (has_indirect) as.numeric(pe_bc$ci.lower[mb]) else NA_real_,\n      ciBcUpper = if (has_indirect) as.numeric(pe_bc$ci.upper[mb]) else NA_real_',
      )
      .replace(
        'ciBcLower = as.numeric(pe_bc$ci.lower[ib]), ciBcUpper = as.numeric(pe_bc$ci.upper[ib])',
        'ciBcLower = if (has_indirect) as.numeric(pe_bc$ci.lower[ib]) else NA_real_,\n        ciBcUpper = if (has_indirect) as.numeric(pe_bc$ci.upper[ib]) else NA_real_',
      )
    const sourceWithoutNewComment = source.replace(
      '# ciBc* are guarded by has_indirect exactly like struct_rows/indirect_rows above (H1 wiring: moderation\n# under MLR is legal but never bootstraps, so pe_bc is just pe aliased back -- Wald CIs, not BC -- and\n# must read as NA here, not silently masquerade as a bootstrap BC interval).\n',
      '',
    )
    expect(sourceWithoutNewComment).toBe(goldenWithGuardFix)
  })

  it('MLR + fiml: the fragment reaches both sem() lines, robust fit-index names are requested, and env carries no ci_type', async () => {
    const mlrSetup: TestSetup = { ...baseSetup, options: { ...baseSetup.options, estimator: 'MLR', missing: 'fiml' } }
    const { engine, runJson } = fakeEngine(baseRaw2, cfaResult2)
    await runCbSem(engine, data, mlrSetup)
    const [source, env] = runJson.mock.calls[0] as [string, Record<string, unknown>]
    expect(source).toContain(
      'fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = as.integer(nboot), estimator = "MLR", missing = "ml")',
    )
    expect(source).toContain('fit <- lavaan::sem(model_str, data = d, estimator = "MLR", missing = "ml")')
    expect(source).toContain(
      'fm <- lavaan::fitMeasures(fit, c("chisq.scaled","df.scaled","pvalue.scaled","cfi.robust",',
    )
    expect(source).toContain('fit_list$robust <- TRUE')
    expect(env).not.toHaveProperty('ci_type')
  })

  it('WLSMV + pairwise: the fragment includes ordered= sanitized to used columns only, filtered from a whole-dataset columnLevels map', async () => {
    const wlsmvSetup: TestSetup = { ...baseSetup, options: { ...baseSetup.options, estimator: 'WLSMV', missing: 'pairwise' } }
    const { engine, runJson } = fakeEngine(baseRaw2, cfaResult2)
    // c1 is a real ordinal column in the dataset but NOT part of this model's used columns (A/B only) --
    // it must never leak into lavaan's ordered = c(...) (brief item 1: "build indicatorLevels ... per
    // USED raw column").
    const result = await runCbSem(engine, data, wlsmvSetup, undefined, { a1: 'ordinal', a2: 'ordinal', c1: 'ordinal' })
    const [source] = runJson.mock.calls[0] as [string, Record<string, unknown>]
    expect(source).toContain(
      'fit <- lavaan::sem(model_str, data = d, estimator = "WLSMV", missing = "pairwise", ordered = c("a1", "a2"))',
    )
    expect(source).toContain('fm <- lavaan::fitMeasures(fit, c("chisq.scaled","df.scaled","pvalue.scaled","cfi.scaled",')
    expect(result.orderedItems).toEqual(['a1', 'a2'])
  })

  it('fiml full-rows path: env carries ALL rows (not listwise-deleted) with NaN marshaled for missing cells', async () => {
    const holeyData: Dataset = {
      columns: data.columns,
      rows: data.rows.map((r, i) => (i === 3 ? { ...r, a1: null } : r)),
    }
    const mlrSetup: TestSetup = { ...baseSetup, options: { ...baseSetup.options, estimator: 'MLR', missing: 'fiml' } }
    const { engine, runJson } = fakeEngine(baseRaw2, cfaResult2)
    await runCbSem(engine, holeyData, mlrSetup)
    const [, env] = runJson.mock.calls[0] as [string, Record<string, unknown>]
    expect(env.n).toBe(10) // full rows -- the null a1 row is NOT dropped, unlike listwise
    const flat = env.item_cols_flat as number[]
    // item_cols_flat is column-major over usedCols = ['a1','a2','b1','b2']; row 3's a1 is the null cell.
    expect(Number.isNaN(flat[3])).toBe(true)
    expect(flat.filter((v) => Number.isNaN(v))).toHaveLength(1)
  })

  it('a listwise (non-fiml) run with the SAME hole drops the row instead of marshaling NaN (contrast case)', async () => {
    const holeyData: Dataset = {
      columns: data.columns,
      rows: data.rows.map((r, i) => (i === 3 ? { ...r, a1: null } : r)),
    }
    const { engine, runJson } = fakeEngine(baseRaw2, cfaResult2)
    await runCbSem(engine, holeyData, baseSetup) // ML + listwise (default)
    const [, env] = runJson.mock.calls[0] as [string, Record<string, unknown>]
    expect(env.n).toBe(9) // listwise-deleted: the holey row is gone entirely
    const flat = env.item_cols_flat as number[]
    expect(flat.some((v) => Number.isNaN(v))).toBe(false)
  })

  it('needsBootstrap is false under MLR even with an indirect chain (bootstrap requires ML) -- env.has_indirect and result.bootstrapped both false, ciMethod delta', async () => {
    const mlrChainSetup: TestSetup = { ...chainSetup, options: { ...chainSetup.options, estimator: 'MLR' } }
    const { engine, runJson } = fakeEngine(chainRaw3, cfaResult3)
    const result = await runCbSem(engine, data, mlrChainSetup)
    const [, env] = runJson.mock.calls[0] as [string, Record<string, unknown>]
    expect(env.has_indirect).toBe(false)
    expect(result.bootstrapped).toBe(false)
    expect(result.ciMethod).toBe('delta')
    expect(result.estimator).toBe('MLR')
  })

  it('ML + indirect chain (default): new CbSemResult fields report the pre-H1-equivalent bootstrap/ML behavior', async () => {
    const { engine } = fakeEngine(chainRaw3, cfaResult3)
    const result = await runCbSem(engine, data, chainSetup)
    expect(result.estimator).toBe('ML')
    expect(result.ciMethod).toBe('bootstrap')
    expect(result.bootstrapped).toBe(true)
    expect(result.orderedItems).toEqual([])
  })

  it('an unrecognized estimator/missing value (stale UI junk) falls back to ML/listwise rather than throwing', async () => {
    const staleSetup: TestSetup = { ...baseSetup, options: { ...baseSetup.options, estimator: 'mi', missing: 'mi' } }
    const { engine } = fakeEngine(baseRaw2, cfaResult2)
    const result = await runCbSem(engine, data, staleSetup)
    expect(result.estimator).toBe('ML')
  })

  it('moderation under MLR: non-bootstrapped run keeps the moderation rows/slopes, BC CIs come through as null (has_indirect-guarded R reads), ciMethod delta', async () => {
    // Moderation + MLR is legal (only WLSMV is blocked) but NEVER bootstraps (bootstrap needs ML), so
    // the R side's pe_bc is just pe aliased back and the mod_rows/slope_rows ciBc* reads must be
    // has_indirect-guarded to NA -- the same convention struct_rows' bootstrapped:false path already
    // uses (R NA_real_ -> JSON null, passed through to TS untouched). The mock's null ciBc* fields are
    // exactly what the guarded R would produce on a non-bootstrapped run.
    const modSetup: TestSetup = {
      ...baseSetup,
      options: { ...baseSetup.options, estimator: 'MLR' },
      constructs: [
        { id: 1, name: 'A', items: items.a },
        { id: 2, name: 'B', items: items.b },
        { id: 3, name: 'C', items: items.c },
      ],
      paths: [{ from: 1, to: 3 }],
      moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
    }
    const naModRow = {
      id: 1, b: 0.1, se: 0.1, z: 1, p: 0.3, stdBeta: 0.1,
      ciPercLower: -0.1, ciPercUpper: 0.3, ciBcLower: null, ciBcUpper: null,
    }
    const naSlopeRow = (level: 'lo' | 'mid' | 'hi') => ({
      modId: 1, level, est: 0.1, se: 0.1, z: 1, p: 0.3,
      ciPercLower: -0.1, ciPercUpper: 0.3, ciBcLower: null, ciBcUpper: null,
    })
    const modRaw = {
      ...baseRaw2, rsquareIds: { 3: 0.4 },
      moderationRows: [naModRow],
      slopeRows: [naSlopeRow('lo'), naSlopeRow('mid'), naSlopeRow('hi')],
      estModeration: [{ beta: 0.2 }],
    }
    const runJson = vi.fn().mockResolvedValueOnce(modRaw).mockResolvedValueOnce(cfaResult3)
    const capturePlot = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
    const engine = { runJson, capturePlot } as unknown as Engine

    const result = await runCbSem(engine, data, modSetup)
    const [source, env] = runJson.mock.calls[0] as [string, Record<string, unknown>]

    // (a) the bootstrap gate is off: env + result both say so, and the R text carries the NA guard
    // on BOTH moderation read sites (mod_rows' [mb] and slope_rows' [ib]) -- without the guard, this
    // run would read pe_bc (= pe aliased) Wald CIs and mislabel them as bootstrap-BC intervals.
    expect(env.has_indirect).toBe(false)
    expect(result.bootstrapped).toBe(false)
    expect(source).toContain('ciBcLower = if (has_indirect) as.numeric(pe_bc$ci.lower[mb]) else NA_real_')
    expect(source).toContain('ciBcLower = if (has_indirect) as.numeric(pe_bc$ci.lower[ib]) else NA_real_')

    // (b) the TS shaping passes the NA-shaped (null) BC CIs through untouched -- same pass-through
    // convention as struct_rows' bootstrapped:false path; percentile (Wald) CIs stay real numbers.
    expect(result.moderation!.rows).toHaveLength(1)
    expect(result.moderation!.rows[0].ciBcLower).toBeNull()
    expect(result.moderation!.rows[0].ciBcUpper).toBeNull()
    expect(result.moderation!.rows[0].ciPercLower).toBe(-0.1)
    expect(result.moderation!.slopes).toHaveLength(3)
    for (const slope of result.moderation!.slopes) {
      expect(slope.ciBcLower).toBeNull()
      expect(slope.ciBcUpper).toBeNull()
    }

    // (c) the CI-honesty disclosure fields
    expect(result.ciMethod).toBe('delta')
    expect(result.estimator).toBe('MLR')
  })
})

// H1 known-answer matrix (Task 5, docs/superpowers/sdd/task-5-brief.md + controller amendments): the
// real-WebR counterpart to the mocked-engine wiring tests above -- 7 cells (ML x {listwise,fiml,
// pairwise}, MLR x {listwise,fiml}, WLSMV x {listwise,pairwise}; MLR+pairwise is lavaan-invalid and is
// not a cell at all, see semFitArgs.ts's guard) run against the REAL engine and compared to h1Pins.ts's
// native-R 4.6.0/lavaan 0.6-21 pins at toBeCloseTo(pin, 7) -- except the two WLSMV cells at 5dp -- and
// NEVER byte/string equality (h1Pins.ts's module doc comment is the single source of truth for both
// rules and the cross-engine-drift rationale, incl. the ruled WLSMV exception).
// Excluded from test:fast by convention (same real-engine describe-block style as the rest of this
// file); minutes not seconds -- run directly via `npx vitest run src/lib/stats/runCbSem.test.ts`.
describe('runCbSem - H1 known-answer matrix (real WebR, 7 cells vs native-R pins)', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  // Cells 1-5: Bollen PoliticalDemocracy, the 2-construct/1-path subset the pins were fit against
  // (ind60=~x1+x2+x3; dem60=~y1+y2+y3+y4; dem60~ind60 -- NOT the 3-construct dem65 chain the top-of-file
  // SETUP builds), fixture WITH seeded NA holes in y1..y4 (politicalDemocracy-missing.csv, Task 4's
  // reformatted CSV). A single direct path has no mediator, so hasIndirect is false and wantsBootstrap
  // is false regardless of estimator -- every cell's ciMethod is 'delta' and bootstrapped is false
  // (semFitArgs.ts), matching the controller amendment's "expect needsBootstrap false and plain CIs".
  const PD_SETUP: TestSetup = {
    roles: {}, options: { estimator: 'ML', nboot: 200, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
    ],
    paths: [{ from: 1, to: 2 }],
  }
  const pdData = () => loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/politicalDemocracy-missing.csv'))

  // Cells 6-7: the spike's mixed ordinal/continuous model (A=~a1+a2+a3; C=~cont1+cont2; B=~b1+b2+b3;
  // B~A+C), fixture WITH seeded NA holes in a1..b3 ONLY (likert5-missing.csv, Task 4's reconditioned
  // 1%-hole PROPER-solution fixture -- cont1/cont2 untouched). columnLevels marks exactly the six
  // ordinal indicators; cont1/cont2 fall through to the runner's own 'scale' default.
  const WLSMV_SETUP: TestSetup = {
    roles: {}, options: { estimator: 'WLSMV', nboot: 200, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'A', items: ['a1', 'a2', 'a3'] },
      { id: 2, name: 'C', items: ['cont1', 'cont2'] },
      { id: 3, name: 'B', items: ['b1', 'b2', 'b3'] },
    ],
    paths: [{ from: 1, to: 3 }, { from: 2, to: 3 }],
  }
  const WLSMV_COLUMN_LEVELS: Record<string, string> = {
    a1: 'ordinal', a2: 'ordinal', a3: 'ordinal', b1: 'ordinal', b2: 'ordinal', b3: 'ordinal',
    cont1: 'scale', cont2: 'scale',
  }
  const likertData = () => loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/likert5-missing.csv'))

  // Maps this cell's h1Pins.ts fit keys (native lavaan::fitMeasures() names, e.g. 'cfi.robust' under
  // MLR or 'cfi.scaled' under WLSMV) onto the runner's OWN stable fit_list keys (chisq/df/pvalue/cfi/
  // tli/rmsea/srmr, uniform across every estimator -- runCbSem.ts's fitListBlock doc comment). ML
  // requests the plain names directly; MLR/WLSMV request the .robust/.scaled family and remap it back
  // onto the same stable keys, so this map is the inverse of that remapping, per estimator.
  const FIT_KEY_MAP: Record<H1PinCell['estimator'], Record<string, string>> = {
    ML: { chisq: 'chisq', df: 'df', pvalue: 'pvalue', cfi: 'cfi', tli: 'tli', rmsea: 'rmsea', srmr: 'srmr' },
    MLR: { chisq: 'chisq.scaled', df: 'df.scaled', pvalue: 'pvalue.scaled', cfi: 'cfi.robust', tli: 'tli.robust', rmsea: 'rmsea.robust', srmr: 'srmr' },
    WLSMV: { chisq: 'chisq.scaled', df: 'df.scaled', pvalue: 'pvalue.scaled', cfi: 'cfi.scaled', tli: 'tli.scaled', rmsea: 'rmsea.scaled', srmr: 'srmr' },
  }

  /** Compares a real-WebR CbSemResult against one h1Pins.ts cell at `precision` decimal places (7 by
   *  default, the module's documented comparison rule; the two WLSMV cells pass 5 per h1Pins.ts's
   *  "WLSMV EXCEPTION" ruling paragraph). Structural rows are matched by fromName/toName parsed off
   *  the pin's "toName ~ fromName" param string; est/se compare against the row's unstandardized b/se,
   *  and ciLower/ciUpper (when the pin carries them) compare against ciPercLower/ciPercUpper -- the
   *  Wald (delta-method) CI parameterEstimates() returns for a non-bootstrapped fit, which every cell
   *  here is (see PD_SETUP/WLSMV_SETUP doc comments above: neither model has an indirect chain). */
  function assertCell(result: CbSemResult, cell: H1PinCell, precision = 7) {
    const map = FIT_KEY_MAP[cell.estimator]
    for (const [appKey, pinKey] of Object.entries(map)) {
      const pinVal = cell.fit[pinKey]
      if (pinVal === undefined) continue
      expect(result.fit![appKey], `fit.${appKey} (pin key ${pinKey})`).toBeCloseTo(pinVal, precision)
    }
    const s = result.structural!
    for (const row of cell.structural) {
      const [toName, fromName] = row.param.split(' ~ ')
      const actual = s.find((r) => r.fromName === fromName && r.toName === toName)
      expect(actual, `structural row "${row.param}" not found`).toBeDefined()
      expect(Number(actual!.b), `${row.param} est`).toBeCloseTo(row.est, precision)
      expect(Number(actual!.se), `${row.param} se`).toBeCloseTo(row.se, precision)
      if (row.ciLower !== undefined) expect(Number(actual!.ciPercLower), `${row.param} ciLower`).toBeCloseTo(row.ciLower, precision)
      if (row.ciUpper !== undefined) expect(Number(actual!.ciPercUpper), `${row.param} ciUpper`).toBeCloseTo(row.ciUpper, precision)
    }
    expect(result.estimator).toBe(cell.estimator)
    expect(result.bootstrapped).toBe(false)
    expect(result.ciMethod).toBe('delta')
  }

  it('Cell 1: ML / listwise', async () => {
    const result = await runCbSem(engine, pdData(), PD_SETUP)
    assertCell(result, CELL_1_ML_LISTWISE)
  }, 600_000)

  it('Cell 2: ML / fiml (lavaan missing = "ml")', async () => {
    const setup: TestSetup = { ...PD_SETUP, options: { ...PD_SETUP.options, missing: 'fiml' } }
    const result = await runCbSem(engine, pdData(), setup)
    assertCell(result, CELL_2_ML_FIML)
  }, 600_000)

  it('Cell 3: ML / pairwise', async () => {
    const setup: TestSetup = { ...PD_SETUP, options: { ...PD_SETUP.options, missing: 'pairwise' } }
    const result = await runCbSem(engine, pdData(), setup)
    assertCell(result, CELL_3_ML_PAIRWISE)
  }, 600_000)

  it('Cell 4: MLR / listwise', async () => {
    const setup: TestSetup = { ...PD_SETUP, options: { ...PD_SETUP.options, estimator: 'MLR' } }
    const result = await runCbSem(engine, pdData(), setup)
    assertCell(result, CELL_4_MLR_LISTWISE)
  }, 600_000)

  it('Cell 5: MLR / fiml (lavaan missing = "ml")', async () => {
    const setup: TestSetup = { ...PD_SETUP, options: { ...PD_SETUP.options, estimator: 'MLR', missing: 'fiml' } }
    const result = await runCbSem(engine, pdData(), setup)
    assertCell(result, CELL_5_MLR_FIML)
  }, 600_000)

  it('Cell 6: WLSMV / listwise', async () => {
    const setup: TestSetup = { ...WLSMV_SETUP, options: { ...WLSMV_SETUP.options, missing: 'listwise' } }
    const result = await runCbSem(engine, likertData(), setup, undefined, WLSMV_COLUMN_LEVELS)
    // 5dp (ruled): WLSMV's DWLS robust-covariance path shows measured 1e-7..6e-7 cross-engine drift
    // on chisq.scaled + structural est/se (task-5 report Finding B; h1Pins.ts "WLSMV EXCEPTION").
    assertCell(result, CELL_6_WLSMV_LISTWISE, 5)
    expect(result.orderedItems).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'b3'])
  }, 600_000)

  it('Cell 7: WLSMV / pairwise', async () => {
    const setup: TestSetup = { ...WLSMV_SETUP, options: { ...WLSMV_SETUP.options, missing: 'pairwise' } }
    const result = await runCbSem(engine, likertData(), setup, undefined, WLSMV_COLUMN_LEVELS)
    // 5dp (ruled): same measured WLSMV cross-engine drift class as Cell 6 above.
    assertCell(result, CELL_7_WLSMV_PAIRWISE, 5)
    expect(result.orderedItems).toEqual(['a1', 'a2', 'a3', 'b1', 'b2', 'b3'])
  }, 600_000)
})
