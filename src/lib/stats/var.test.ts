import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runVar } from './var'
import type { Dataset } from './types'

// ── Spike dataset: Canada[,1:2] from the vars package (n=84 quarterly) ────────
// vars::Canada columns: e (employment), prod (productivity), rw (real wage), U (unemployment)
// The spec spike: VAR(Canada[,1:2], p=1) eqn-1 coef[1] = 0.94789631
// We force p=1 by passing lagMax=1 so VARselect can only choose lag=1.
//
// Native R 4.6.0 ground truth (all computed with the flat column-major reconstruction):
//   VAR(Canada[,1:2], p=1) — equation 'e': e.l1 coef = 0.94789631 (spike anchor)
//   VAR(Canada[,1:2], p=1) — FEVD at h=10: e→e=0.5518642, prod→e=0.4481358
//                                            e→prod=0.07046635, prod→prod=0.9295336
//   VAR(Canada[,1:2], p=2) — VARselect with lagMax=2 picks p=2 (AIC)
//     FEVD at h=10: e→e=0.6635492, prod→e=0.3364508, e→prod=0.1520734, prod→prod=0.8479266
//     Max root modulus = 0.9961645 → stable = true

// Canada 'e' column (n=84 quarterly observations, Q1 1980 – Q4 2000)
const CANADA_E = [
  929.610514, 929.803985, 930.318388, 931.427687, 932.662006, 933.550940, 933.531526, 933.076879,
  932.123753, 930.635939, 929.097060, 928.563336, 929.069380, 930.265516, 931.677032, 932.138968,
  932.276686, 932.832783, 933.733419, 934.177206, 934.592840, 935.606710, 936.511086, 937.420090,
  938.415922, 938.999170, 939.235355, 939.679504, 940.249674, 941.435819, 942.298096, 943.532223,
  944.348970, 944.821489, 945.067137, 945.806726, 946.869662, 946.876612, 947.249692, 947.651276,
  948.183971, 948.349239, 948.032171, 947.106483, 946.079554, 946.183812, 946.225795, 945.997784,
  945.518279, 945.351398, 945.291786, 945.400786, 945.905810, 945.903470, 946.319029, 946.579621,
  946.780032, 947.628284, 948.622058, 949.399183, 949.948138, 949.794494, 949.953380, 950.250239,
  950.538031, 950.787128, 950.869529, 950.928132, 951.845722, 952.600476, 953.597553, 954.143388,
  954.542593, 955.263136, 956.056053, 956.796586, 957.386480, 958.063416, 958.716592, 959.488142,
  960.362493, 960.783379, 961.029030, 961.765710,
]

// Canada 'prod' column (productivity)
const CANADA_PROD = [
  405.366466, 404.639834, 403.814883, 404.215773, 405.046714, 404.416739, 402.819127, 401.977335,
  402.089725, 401.306688, 401.630171, 401.563755, 402.815699, 403.142108, 403.078619, 403.718786,
  404.866799, 405.636187, 405.136285, 406.024640, 406.412270, 406.300933, 406.335352, 406.773695,
  405.152548, 404.929831, 404.576546, 404.199493, 405.949856, 405.822092, 406.446283, 407.051248,
  407.946024, 408.179585, 408.599813, 409.090561, 408.704215, 408.980275, 408.328690, 407.885697,
  407.260532, 406.775151, 406.179414, 405.439793, 403.279971, 403.364856, 403.380680, 404.003183,
  404.477398, 404.786783, 405.271004, 405.382993, 405.156416, 406.470043, 406.229309, 406.726484,
  408.578505, 409.676710, 410.385763, 410.539524, 410.445258, 410.625605, 410.867240, 411.235918,
  410.663655, 410.808508, 412.115962, 412.999407, 412.955057, 412.824133, 413.048875, 413.611018,
  413.604782, 412.968388, 412.265887, 412.910594, 413.829416, 414.224152, 415.167771, 415.701580,
  416.867407, 417.610399, 418.002980, 417.266680,
]

function makeCanada2Dataset(): Dataset {
  const rows = CANADA_E.map((e, i) => ({ t: i + 1, e, prod: CANADA_PROD[i] }))
  return { columns: ['t', 'e', 'prod'], rows }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('runVar', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike anchor — Canada[,1:2] p=1 eqn-e coef[1] (e.l1) = 0.94789631 vs native R 4.6.0', async () => {
    // lagMax=1 forces VARselect to pick lag=1, reproducing the spec spike exactly
    const r = await runVar(engine, makeCanada2Dataset(), 't', ['e', 'prod'], { lagMax: 1 })

    expect(r.n).toBe(84)
    expect(r.nExcluded).toBe(0)
    expect(r.selectedLag).toBe(1)
    expect(r.seriesNames).toEqual(['e', 'prod'])

    // Equation 'e', first lagged term (e.l1): the spec spike anchor
    const eqE = r.coefRows.filter((row) => row.equation === 'e')
    const el1 = eqE.find((row) => row.term === 'e.l1')
    expect(el1).toBeDefined()
    expect(el1!.estimate).toBeCloseTo(0.94789631, 5)       // spike anchor: ≥5 sig figs
    expect(el1!.se).toBeCloseTo(0.01245409, 5)
    expect(el1!.t).toBeCloseTo(76.111218, 3)
    expect(el1!.p).toBeCloseTo(2.095977e-76, 5)

    // Equation 'e', second term (prod.l1)
    const prodl1 = eqE.find((row) => row.term === 'prod.l1')
    expect(prodl1).toBeDefined()
    expect(prodl1!.estimate).toBeCloseTo(0.1442094, 5)

    // Lag table should have 1 row (lagMax=1)
    expect(r.lagRows).toHaveLength(1)
    expect(r.lagRows[0].lag).toBe(1)
    expect(r.lagRows[0].aic).toBeCloseTo(-1.9739700, 5)

    // §2.5: FEVD at h=10 for p=1 — native R values
    const eShock_e = r.fevdRows.find((row) => row.variable === 'e' && row.impulse === 'e')
    const eShock_prod = r.fevdRows.find((row) => row.variable === 'e' && row.impulse === 'prod')
    const prodShock_e = r.fevdRows.find((row) => row.variable === 'prod' && row.impulse === 'e')
    const prodShock_prod = r.fevdRows.find((row) => row.variable === 'prod' && row.impulse === 'prod')
    expect(eShock_e!.share).toBeCloseTo(0.5518642, 5)
    expect(eShock_prod!.share).toBeCloseTo(0.4481358, 5)
    expect(prodShock_e!.share).toBeCloseTo(0.07046635, 5)
    expect(prodShock_prod!.share).toBeCloseTo(0.9295336, 5)

    // modelsummary footer: per-equation GOF (each equation is an lm) + per-coef 95% CI via confint().
    // Native R 4.6.0 (VAR(Canada[,1:2], p=1)): eq 'e' R²=0.996941 RMSE=0.498534 logLik=−59.997016 N=83.
    const gofE = r.eqGof.find((g) => g.equation === 'e')
    expect(gofE).toBeDefined()
    expect(gofE!.r2).toBeCloseTo(0.996941, 5)
    expect(gofE!.adjR2).toBeCloseTo(0.996865, 5)
    expect(gofE!.rmse).toBeCloseTo(0.498534, 5)
    expect(gofE!.logLik).toBeCloseTo(-59.997016, 4)
    expect(gofE!.nobs).toBe(83)
    expect(el1!.ciLow).toBeCloseTo(0.923112, 5)   // confint(eq e)[e.l1,]
    expect(el1!.ciHigh).toBeCloseTo(0.972681, 5)
    expect(r.ciLevel).toBe(0.95)

    // IRF figure: valid PNG bytes
    expect(Array.from(r.figIrfPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('stability — Canada[,1:2] lagMax=2 picks p=2, max root modulus < 1 (stable)', async () => {
    // With lagMax=2, VARselect AIC picks p=2 → Canada[,1:2] p=2 is stable (modulus ≈ 0.9962 < 1)
    const r = await runVar(engine, makeCanada2Dataset(), 't', ['e', 'prod'], { lagMax: 2 })

    expect(r.selectedLag).toBe(2)
    expect(r.maxRootModulus).toBeCloseTo(0.9961645, 5)
    expect(r.stable).toBe(true)

    // FEVD at h=10 for stable p=2 fit — native R values
    const eShock_e = r.fevdRows.find((row) => row.variable === 'e' && row.impulse === 'e')
    const eShock_prod = r.fevdRows.find((row) => row.variable === 'e' && row.impulse === 'prod')
    expect(eShock_e!.share).toBeCloseTo(0.6635492, 5)
    expect(eShock_prod!.share).toBeCloseTo(0.3364508, 5)

    // Lag table should have 2 rows
    expect(r.lagRows).toHaveLength(2)
    expect(r.lagRows[1].lag).toBe(2)
    expect(r.lagRows[1].aic).toBeCloseTo(-2.5629342, 5)
    expect(r.lagRows[1].bic).toBeCloseTo(-2.2694319, 5)  // SC(n)=BIC — guards the VARselect row mapping (criteria[3,])
    expect(r.lagRows[1].hq).toBeCloseTo(-2.4450975, 5)   // HQ(n) — criteria[2,]
  }, 300_000)

  it('listwise: drops rows with missing time or any series column', async () => {
    const base = makeCanada2Dataset()
    const ds: Dataset = {
      columns: ['t', 'e', 'prod'],
      rows: [
        ...base.rows.slice(0, 30),
        { t: 31, e: null, prod: CANADA_PROD[30] },       // missing e
        { t: 32, e: CANADA_E[31], prod: null },           // missing prod
        { t: null, e: CANADA_E[32], prod: CANADA_PROD[32] }, // missing time
        ...base.rows.slice(33),
      ],
    }
    const r = await runVar(engine, ds, 't', ['e', 'prod'], { lagMax: 1 })
    expect(r.nExcluded).toBe(3)
    expect(r.n).toBe(81)
  }, 300_000)

  it('sort-by-time: shuffled rows produce the same spike coef as sorted', async () => {
    const base = makeCanada2Dataset()
    const shuffled: Dataset = {
      columns: ['t', 'e', 'prod'],
      rows: [...base.rows].reverse(),
    }
    const r = await runVar(engine, shuffled, 't', ['e', 'prod'], { lagMax: 1 })
    const el1 = r.coefRows.find((row) => row.equation === 'e' && row.term === 'e.l1')
    expect(el1!.estimate).toBeCloseTo(0.94789631, 5)
  }, 300_000)
})
