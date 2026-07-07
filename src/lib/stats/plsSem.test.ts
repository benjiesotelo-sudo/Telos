import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runPlsSem } from './plsSem'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'
import type { TestSetup } from '../../state/session'
import type { Dataset } from './types'

// Reference values: native R 4.6.0, AUTHORITATIVE seminr::mobi example (tests/e2e/fixtures/mobi.csv,
// regenerated 2026-06-21 via `write.csv(seminr::mobi, ...)`). 3-construct sub-model so the test stays fast:
//   Image        = composite reflective IMAG1..IMAG5   (id 1)
//   Expectation  = composite reflective CUEX1..CUEX3   (id 2)
//   Satisfaction = composite reflective CUSA1..CUSA3   (id 3)
//   paths: Image->Expectation, Image->Satisfaction, Expectation->Satisfaction
// estimate_pls(data=mobi, mm, sm); summary(pls):
//   reliability rows (alpha / rhoC / AVE / rhoA), R^2/AdjR^2 from $paths, htmt from $validity$htmt.
//
// NOTE (Task-25): the Task brief's reference values were STALE (Image alpha=0.7693, R^2 Sat=0.6155,
// path Image->Expectation=0.3035, htmt Image-Expectation=0.4106, ...) — they did NOT reproduce against
// authoritative seminr::mobi for THIS 3-construct sub-model (they appear to be from a different/full
// model). The values below were CONFIRMED by running the exact sub-model under native R 4.6.0
// (seed 20260620, nboot=300, cores=1):
//   Image:        alpha=0.7228 rhoC=0.8188 AVE=0.4781 rhoA=0.7385
//   Satisfaction: rhoC=0.8714 AVE=0.6932
//   R^2:  Satisfaction=0.5172      AdjR^2: Satisfaction=0.5133
//   (all unrounded native values matched WebR to 10 dp — byte-identical serial-shim bootstrap parity)
//   path Image->Expectation beta=0.5095 ; Expectation->Satisfaction beta=0.2167 ; Image->Satisfaction beta=0.5841
//   htmt Expectation-Image=0.8880 ; Satisfaction-Image=0.9097 ; Satisfaction-Expectation=0.8650
//   f2  Image->Expectation=0.3506 ; Image->Satisfaction=0.5129 ; Expectation->Satisfaction=0.0706
//   indirect Image->Expectation->Satisfaction: est=0.110409 ci=[0.050992, 0.176165] t=3.3587
//     (specific_effect_significance is a 1×7 MATRIX → index sig[1,"Original Est."]; sig["..."] is all-NA)
//   BC CI (U6-T3, hand-rolled bc_ci() on bo$boot_paths["Image","Expectation",] — the same [from,to,boot]
//     3D array this test's structural[0] now reads): beta=0.5094926, perc CI=[0.407967, 0.625370],
//     BC CI=[0.329951, 0.604472] (native R 4.6.0, seed 20260620, nboot=300).
//   Q²_predict (PLSpredict, set.seed(20260620) before predict_pls; mean over a construct's indicators):
//     Expectation=0.030362  Satisfaction=0.031243  (derived for THIS 3-construct sub-model — NOT the
//     spike's full-model 0.043/0.039). Image is exogenous → no out-of-sample column → no Q² (not in table).
// Mixed fixture (reflective Image + FORMATIVE Expectation): suppresses AVE/HTMT row for Expectation,
//   reports outer WEIGHTS for its indicators, indicator VIF, weight significance.

const REFLECTIVE_SETUP: TestSetup = {
  roles: {},
  options: { nboot: 300, missing: 'mean-replacement' },
  props: {},
  blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'Image', mode: 'reflective', items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
    { id: 2, name: 'Expectation', mode: 'reflective', items: ['CUEX1', 'CUEX2', 'CUEX3'] },
    { id: 3, name: 'Satisfaction', mode: 'reflective', items: ['CUSA1', 'CUSA2', 'CUSA3'] },
  ],
  paths: [
    { from: 1, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 3 },
  ],
}

const MIXED_SETUP: TestSetup = {
  ...REFLECTIVE_SETUP,
  constructs: [
    { id: 1, name: 'Image', mode: 'reflective', items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
    { id: 2, name: 'Expectation', mode: 'formative', items: ['CUEX1', 'CUEX2', 'CUEX3'] },
    { id: 3, name: 'Satisfaction', mode: 'reflective', items: ['CUSA1', 'CUSA2', 'CUSA3'] },
  ],
}

describe('plsSem', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('3-construct reflective PLS on mobi matches native-R reference values', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const r = await runPlsSem(engine, data, REFLECTIVE_SETUP)

    // reliability (reordered to display tuple α / ρ_A / CR / AVE)
    const byName = Object.fromEntries(r.reliability.map((row) => [row.construct, row]))
    expect(Number(byName['Image'].alpha)).toBeCloseTo(0.7228, 3)
    expect(Number(byName['Image'].rhoA)).toBeCloseTo(0.7385, 3)
    expect(Number(byName['Image'].cr)).toBeCloseTo(0.8188, 3)
    expect(Number(byName['Image'].ave)).toBeCloseTo(0.4781, 3)
    expect(Number(byName['Satisfaction'].cr)).toBeCloseTo(0.8714, 3)
    expect(Number(byName['Satisfaction'].ave)).toBeCloseTo(0.6932, 3)

    // structural quality R²/adj
    const q = Object.fromEntries(r.quality.map((row) => [row.construct, row]))
    expect(Number(q['Satisfaction'].r2)).toBeCloseTo(0.5172, 3)
    expect(Number(q['Satisfaction'].r2adj)).toBeCloseTo(0.5133, 3)

    // structural paths (beta) + estimates mirror
    const pImEx = r.estimates.paths.find((p) => p.from === 1 && p.to === 2)!
    const pExSa = r.estimates.paths.find((p) => p.from === 2 && p.to === 3)!
    const pImSa = r.estimates.paths.find((p) => p.from === 1 && p.to === 3)!
    expect(pImEx.beta).toBeCloseTo(0.5095, 2)
    expect(pExSa.beta).toBeCloseTo(0.2167, 2)
    expect(pImSa.beta).toBeCloseTo(0.5841, 2)

    // HTMT matrix (labels in construct order; lower triangle populated)
    expect(r.htmt.labels).toEqual(['Image', 'Expectation', 'Satisfaction'])
    expect(r.htmt.cells[1][0]).toBeCloseTo(0.8880, 2)   // Expectation-Image
    expect(r.htmt.cells[2][0]).toBeCloseTo(0.9097, 2)   // Satisfaction-Image
    expect(r.htmt.cells[2][1]).toBeCloseTo(0.8650, 2)   // Satisfaction-Expectation

    // outer model carries one row per indicator with a loading and a t/p
    expect(r.outer.length).toBe(11)
    expect(typeof r.outer[0].loading).toBe('number')

    // f² present on structural rows; r2 keyed by numeric id in estimates
    expect(typeof r.structural[0].fSquare).toBe('number')
    expect(typeof r.estimates.r2[3]).toBe('number')

    // BC CI (U6-T3) — hand-rolled via plsBcCi.ts's bc_ci() on bo$boot_paths["Image","Expectation",];
    // native-R-verified (see file header): beta=0.5094926, BC CI=[0.329951, 0.604472].
    const pImExRow = r.structural.find((row) => row.path === 'Image → Expectation')!
    expect(Number(pImExRow.ciBcLower)).toBeCloseTo(0.329951, 3)
    expect(Number(pImExRow.ciBcUpper)).toBeCloseTo(0.604472, 3)
    // BC brackets the point estimate, same as the percentile CI
    expect(Number(pImExRow.ciBcLower)).toBeLessThan(Number(pImExRow.beta))
    expect(Number(pImExRow.beta)).toBeLessThan(Number(pImExRow.ciBcUpper))

    // indirect effect Image → Expectation → Satisfaction: matrix-indexing fix → finite + native-matched
    const ind = (r.indirect ?? []).find((row) => row.path === 'Image → Expectation → Satisfaction')!
    expect(ind).toBeDefined()
    expect(Number.isFinite(Number(ind.est))).toBe(true)
    expect(Number(ind.est)).toBeCloseTo(0.1104, 2)
    expect(Number.isFinite(Number(ind.ciLower))).toBe(true)
    expect(Number.isFinite(Number(ind.ciUpper))).toBe(true)
    expect(Number(ind.ciLower)).toBeCloseTo(0.0510, 2)
    expect(Number(ind.ciUpper)).toBeCloseTo(0.1762, 2)
    // CI brackets the point estimate
    expect(Number(ind.ciLower)).toBeLessThan(Number(ind.est))
    expect(Number(ind.est)).toBeLessThan(Number(ind.ciUpper))

    // Q²_predict (PLSpredict): endogenous constructs carry a finite, native-matched q2
    expect(Number.isFinite(Number(q['Expectation'].q2))).toBe(true)
    expect(Number.isFinite(Number(q['Satisfaction'].q2))).toBe(true)
    expect(Number(q['Expectation'].q2)).toBeCloseTo(0.0304, 2)
    expect(Number(q['Satisfaction'].q2)).toBeCloseTo(0.0312, 2)
  }, 600_000)

  // seminr takes construct names as quoted R strings (composite("Name", ...), paths(from = "Name")) and
  // uses them as matrix dimnames — never as bare formula tokens — so spaced display names must work
  // NATIVELY without sanitization. This test PROVES that (same mobi sub-model as above, spaced names;
  // renaming constructs does not change the point estimates, so the reference values are reused).
  const SPACED_SETUP: TestSetup = {
    ...REFLECTIVE_SETUP,
    options: { nboot: 100, missing: 'mean-replacement' },
    constructs: [
      { id: 1, name: 'Brand Image', mode: 'reflective', items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
      { id: 2, name: 'Customer Expectation', mode: 'reflective', items: ['CUEX1', 'CUEX2', 'CUEX3'] },
      { id: 3, name: 'Customer Satisfaction', mode: 'reflective', items: ['CUSA1', 'CUSA2', 'CUSA3'] },
    ],
  }

  it('construct names with spaces run natively through seminr and keep the ORIGINAL spaced names', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const r = await runPlsSem(engine, data, SPACED_SETUP)

    // labels/tables carry the original spaced display names
    expect(r.htmt.labels).toEqual(['Brand Image', 'Customer Expectation', 'Customer Satisfaction'])
    const byName = Object.fromEntries(r.reliability.map((row) => [row.construct, row]))
    expect(Number(byName['Brand Image'].alpha)).toBeCloseTo(0.7228, 3)
    expect(Number(byName['Customer Satisfaction'].cr)).toBeCloseTo(0.8714, 3)

    // estimates unchanged by the rename (bootstrap-independent point estimates)
    const pImEx = r.estimates.paths.find((p) => p.from === 1 && p.to === 2)!
    expect(pImEx.beta).toBeCloseTo(0.5095, 2)
    const q = Object.fromEntries(r.quality.map((row) => [row.construct, row]))
    expect(Number(q['Customer Satisfaction'].r2)).toBeCloseTo(0.5172, 3)

    // structural + indirect path labels use the spaced display names
    expect(r.structural.map((row) => row.path)).toContain('Brand Image → Customer Expectation')
    const ind = (r.indirect ?? []).find(
      (row) => row.path === 'Brand Image → Customer Expectation → Customer Satisfaction',
    )
    expect(ind).toBeDefined()
    expect(Number(ind!.est)).toBeCloseTo(0.1104, 2)
  }, 600_000)

  // seminr's composite()/measurement-model string arguments are quoted R strings, not bare formula
  // tokens, so they never NEEDED sanitization for their own syntax -- but `colnames(d_all)` (built from
  // the SAME `all_items` array) does need to agree with whatever key composite() looks up, and raw
  // spaced names make that a fragile non-syntactic assignment. This proves spaced ITEM (indicator)
  // names run end-to-end and preserve the ORIGINAL display name everywhere the app shows/keys by item.
  const ITEM_RENAME: Record<string, string> = {
    IMAG1: 'brand image q1', IMAG2: 'brand image q2', IMAG3: 'brand image q3',
    IMAG4: 'brand image q4', IMAG5: 'brand image q5',
    CUEX1: 'customer expectation q1', CUEX2: 'customer expectation q2', CUEX3: 'customer expectation q3',
    CUSA1: 'customer satisfaction q1', CUSA2: 'customer satisfaction q2', CUSA3: 'customer satisfaction q3',
  }
  const SPACED_ITEM_SETUP: TestSetup = {
    ...REFLECTIVE_SETUP,
    options: { nboot: 100, missing: 'mean-replacement' },
    constructs: [
      { id: 1, name: 'Image', mode: 'reflective', items: ['brand image q1', 'brand image q2', 'brand image q3', 'brand image q4', 'brand image q5'] },
      { id: 2, name: 'Expectation', mode: 'reflective', items: ['customer expectation q1', 'customer expectation q2', 'customer expectation q3'] },
      { id: 3, name: 'Satisfaction', mode: 'reflective', items: ['customer satisfaction q1', 'customer satisfaction q2', 'customer satisfaction q3'] },
    ],
  }

  it('spaced item (indicator) names run natively through seminr and preserve display names in outer/estimates.loadings', async () => {
    const raw = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const spacedData: Dataset = {
      columns: raw.columns.map((c) => ITEM_RENAME[c] ?? c),
      rows: raw.rows.map((r) => {
        const row: Dataset['rows'][number] = {}
        for (const [k, v] of Object.entries(r)) row[ITEM_RENAME[k] ?? k] = v
        return row
      }),
    }
    const r = await runPlsSem(engine, spacedData, SPACED_ITEM_SETUP)

    // reliability unaffected by renaming items (bootstrap-independent point estimates)
    const byName = Object.fromEntries(r.reliability.map((row) => [row.construct, row]))
    expect(Number(byName['Image'].alpha)).toBeCloseTo(0.7228, 3)

    // outer table's displayed `item` carries the ORIGINAL spaced name, never the sanitized R token
    const row = r.outer.find((row) => row.item === 'brand image q1')!
    expect(row).toBeDefined()
    expect(row.construct).toBe('Image')
    expect(Number(row.mean)).toBeCloseTo(7.64, 2)
    expect(Number(row.sd)).toBeCloseTo(1.69999, 3)

    // canvas overlay (estimates.loadings) is keyed by the RAW display item name -- SemCanvas looks it
    // up via Construct.items, which never gets sanitized
    expect(r.estimates.loadings['brand image q1']).toBeCloseTo(Number(row.loading), 6)

    // structural paths/estimates unaffected (PLS construct names, unlike items, were never sanitized)
    const pImEx = r.estimates.paths.find((p) => p.from === 1 && p.to === 2)!
    expect(pImEx.beta).toBeCloseTo(0.5095, 2)
  }, 600_000)

  it('outer rows carry item mean/sd computed on the listwise sample', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const r = await runPlsSem(engine, data, REFLECTIVE_SETUP)
    // native R 4.6.0: mean(mobi$IMAG1)=7.64, sd(mobi$IMAG1)=1.6999881880 (N=250, no NAs, seminr::mobi)
    const row = r.outer.find((row) => row.item === 'IMAG1')!
    expect(Number(row.mean)).toBeCloseTo(7.64, 2)
    expect(Number(row.sd)).toBeCloseTo(1.69999, 3)
  }, 600_000)

  it('mixed reflective/formative model suppresses AVE for the formative construct and reports weights', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const r = await runPlsSem(engine, data, MIXED_SETUP)

    const byName = Object.fromEntries(r.reliability.map((row) => [row.construct, row]))
    // formative Expectation: AVE suppressed (null), reflective constructs keep AVE
    expect(byName['Expectation'].ave).toBeNull()
    expect(Number(byName['Image'].ave)).toBeGreaterThan(0)

    // formative indicators carry a WEIGHT and a VIF; reflective carry a loading
    const expRows = r.outer.filter((row) => row.construct === 'Expectation')
    expect(expRows.length).toBe(3)
    expect(typeof expRows[0].weight).toBe('number')
    expect(typeof expRows[0].vif).toBe('number')
  }, 600_000)

  // U6-T4 - interaction_term two_stage moderation (Henseler & Chin, 2010), native-R-verified: full
  // 7-construct mobi model per the moderation spike (docs/superpowers/reviews/2026-07-06-moderation-spike.md
  // §3), Expectation moderates Image -> Satisfaction. Point estimate beta=-0.016341 and Satisfaction
  // R²=0.681492/AdjR²=0.674965 are seed-independent and equal the spike's numbers EXACTLY. The bootstrap
  // t/CI references are re-derived under native R 4.6.0 at the RUNNER'S pinned seed 20260620 (the spike
  // used 20260706; the app pins one deterministic seed for every PLS run, so the spike's CI digits cannot
  // reproduce through the app path): t=-0.5706614046, perc CI=[-0.0737725875, 0.0397582893] - WebR matched
  // these native values to every printed digit (the same byte-identical parity the spike proved at its seed).
  const MOBI_MOD_SETUP: TestSetup = {
    roles: {}, options: { nboot: 500 }, props: {}, blocked: null, modelKind: 'latent',
    constructs: [
      { id: 1, name: 'Image', items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
      { id: 2, name: 'Expectation', items: ['CUEX1', 'CUEX2', 'CUEX3'] },
      { id: 3, name: 'Quality', items: ['PERQ1', 'PERQ2', 'PERQ3', 'PERQ4', 'PERQ5', 'PERQ6', 'PERQ7'] },
      { id: 4, name: 'Value', items: ['PERV1', 'PERV2'] },
      { id: 5, name: 'Satisfaction', items: ['CUSA1', 'CUSA2', 'CUSA3'] },
      { id: 6, name: 'Complaints', items: ['CUSCO'] },
      { id: 7, name: 'Loyalty', items: ['CUSL1', 'CUSL2', 'CUSL3'] },
    ],
    paths: [
      { from: 1, to: 2 }, { from: 1, to: 5 }, { from: 1, to: 7 },
      { from: 2, to: 3 }, { from: 2, to: 4 }, { from: 2, to: 5 },
      { from: 3, to: 4 }, { from: 3, to: 5 },
      { from: 4, to: 5 },
      { from: 5, to: 6 }, { from: 5, to: 7 },
      { from: 6, to: 7 },
    ],
    moderations: [{ id: 1, moderatorId: 2, pathIndex: 1 }], // Expectation moderates Image -> Satisfaction (path index 1)
  }

  it('interaction_term (Image*Expectation -> Satisfaction) matches the native-R reference values exactly', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const result = await runPlsSem(engine, data, MOBI_MOD_SETUP)
    const row = result.structural.find((r) => r.path === 'Image*Expectation → Satisfaction')!
    expect(row.beta).toBeCloseTo(-0.016341, 5)
    expect(row.ciLower).toBeCloseTo(-0.073773, 5)
    expect(row.ciUpper).toBeCloseTo(0.039758, 5)
    expect(row.t).toBeCloseTo(-0.570661, 5)
  }, 600_000)

  it('Satisfaction R²/AdjR² match the spike reference values with the interaction path present', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const result = await runPlsSem(engine, data, MOBI_MOD_SETUP)
    const q = result.quality.find((r) => r.construct === 'Satisfaction')!
    expect(q.r2).toBeCloseTo(0.681492, 4)
    expect(q.r2adj).toBeCloseTo(0.674965, 4)
  }, 600_000)

  // U6-T5: simple slopes at -1SD/mean/+1SD, derived from the SAME bootstrap draws as the interaction
  // path's own CI (bo$boot_paths), using the moderator's OBSERVED composite-score SD (Aiken & West, 1991
  // applied to the composite/summed-indicator metric - PLS has no latent-variance label to scale by).
  // The spike did not compute PLS simple slopes, so this arithmetic is new: reference values were derived
  // by running the EXACT same model/seed/nboot under native R 4.6.0 (seminr installed locally) -
  //   mod_sd = sd(pls$construct_scores[, "Expectation"]) = 1 (PLS-PM standardizes composites to unit
  //   variance by construction); b_main (Image->Satisfaction) = 0.1807884; b_int (interaction) = -0.01634071
  //   lo:   b=0.197129 se=0.061656 ci=[0.095869, 0.324150]
  //   mid:  b=0.180788 se=0.052596 ci=[0.088966, 0.291639]
  //   hi:   b=0.164448 se=0.058062 ci=[0.060079, 0.292747]
  it('simple slopes at -1SD/mean/+1SD match the native-R reference values (Image*Expectation -> Satisfaction)', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const result = await runPlsSem(engine, data, MOBI_MOD_SETUP)
    expect(result.slopes).toHaveLength(3)
    const lo = result.slopes!.find((s) => s.level === '-1SD')!
    const mid = result.slopes!.find((s) => s.level === 'mean')!
    const hi = result.slopes!.find((s) => s.level === '+1SD')!
    expect(lo.b).toBeCloseTo(0.197129, 4)
    expect(lo.se).toBeCloseTo(0.061656, 4)
    expect(lo.ciLower).toBeCloseTo(0.095869, 4)
    expect(lo.ciUpper).toBeCloseTo(0.324150, 4)
    expect(mid.b).toBeCloseTo(0.180788, 4)
    expect(mid.ciLower).toBeCloseTo(0.088966, 4)
    expect(mid.ciUpper).toBeCloseTo(0.291639, 4)
    expect(hi.b).toBeCloseTo(0.164448, 4)
    expect(hi.ciLower).toBeCloseTo(0.060079, 4)
    expect(hi.ciUpper).toBeCloseTo(0.292747, 4)
    // every slope row disambiguates back to its edge with the same modId + a human label
    expect(new Set(result.slopes!.map((s) => s.modId)).size).toBe(1)
    expect(lo.label).toBe('Image → Satisfaction × Expectation')

    // the figure is app-drawn from these SAME rows via the shared simpleSlopesPlot.ts module
    expect(result.figModSlopesPng).toBeDefined()
    expect(result.figModSlopesPng!.length).toBeGreaterThan(0)

    // canvas moderation-arrow overlay (U6-T5): the interaction path's own beta, keyed back to the
    // moderatorId/pathIndex the canvas drew it with - same shape as CbSemResult.estimates.moderation.
    expect(result.estimates.moderation).toEqual([
      { moderatorId: 2, pathIndex: 1, beta: expect.closeTo(-0.016341, 5) },
    ])
  }, 600_000)

  it('no-moderation runs leave slopes/figModSlopesPng/estimates.moderation undefined', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const result = await runPlsSem(engine, data, REFLECTIVE_SETUP)
    expect(result.slopes).toBeUndefined()
    expect(result.figModSlopesPng).toBeUndefined()
    expect(result.estimates.moderation).toBeUndefined()
  }, 600_000)
})
