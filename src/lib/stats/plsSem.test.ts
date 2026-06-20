import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runPlsSem } from './plsSem'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'
import type { TestSetup } from '../../state/session'

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
})
