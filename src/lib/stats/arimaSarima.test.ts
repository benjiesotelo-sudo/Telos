import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runArimaSarima } from './arimaSarima'
import type { Dataset } from './types'

// ── Spike dataset ─────────────────────────────────────────────────────────────
// R's built-in `lh` dataset (luteinizing hormone, n=48, equally spaced).
// Native R: auto.arima(lh) = ARIMA(1,0,0) — the spike anchor (AIC 64.758325).
// We build a Dataset with an integer time index so the runner's sort-by-time path is exercised.
const LH_SERIES = [
  2.4, 2.4, 2.4, 2.2, 2.1, 1.5, 2.3, 2.3, 2.5, 2, 1.9, 1.7,
  2.2, 1.8, 3.2, 3.2, 2.7, 2.2, 2.2, 1.9, 1.9, 1.8, 2.7, 3,
  2.3, 2, 2, 2.9, 2.9, 2.7, 2.7, 2.3, 2.6, 2.4, 1.8, 1.7,
  1.5, 1.4, 2.1, 3.3, 3.5, 3.5, 3.1, 2.6, 2.1, 3.4, 3, 2.9,
]

function makeLhDataset(): Dataset {
  const rows = LH_SERIES.map((v, i) => ({ t: i + 1, lh: v }))
  return { columns: ['t', 'lh'], rows }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('runArimaSarima', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike — auto.arima(lh) = ARIMA(1,0,0); matches native R to ≥5 sig figs', async () => {
    const r = await runArimaSarima(engine, makeLhDataset(), 't', 'lh', {
      auto: true, seasonalPeriod: 1, horizon: 3,
    })

    // Model order
    expect(r.p).toBe(1); expect(r.d).toBe(0); expect(r.q).toBe(0)
    expect(r.P).toBe(0); expect(r.D).toBe(0); expect(r.Q).toBe(0)
    expect(r.autoSelected).toBe(true)

    // Table 2 — fit & diagnostics (native R 4.6.0 spike values)
    expect(r.aic).toBeCloseTo(64.75832, 4)
    expect(r.bic).toBeCloseTo(70.37193, 4)
    expect(r.loglik).toBeCloseTo(-29.37916, 4)
    expect(r.sigma2).toBeCloseTo(0.206076, 5)
    expect(r.ljungboxP).toBeCloseTo(0.3325718, 5)

    // Table 1 — coefficients: ar1 + intercept
    expect(r.coefs).toHaveLength(2)
    const [ar1, intercept] = r.coefs
    expect(ar1.term).toBe('ar1')
    expect(ar1.estimate).toBeCloseTo(0.5739296, 5)
    expect(ar1.se).toBeCloseTo(0.1161393, 5)
    expect(ar1.ciLow).toBeCloseTo(0.3463007, 5)
    expect(ar1.ciHigh).toBeCloseTo(0.8015585, 5)
    expect(intercept.term).toBe('intercept')
    expect(intercept.estimate).toBeCloseTo(2.413288, 5)
    expect(intercept.se).toBeCloseTo(0.1466135, 5)
    expect(intercept.ciLow).toBeCloseTo(2.125931, 5)
    expect(intercept.ciHigh).toBeCloseTo(2.700645, 5)

    // Table 3 — forecast (h=1,2)
    expect(r.forecastRows).toHaveLength(3)
    const fc1 = r.forecastRows[0]
    expect(fc1.period).toBe(1)
    expect(fc1.forecast).toBeCloseTo(2.692626, 5)
    expect(fc1.lo80).toBeCloseTo(2.110858, 4)
    expect(fc1.hi80).toBeCloseTo(3.274394, 4)
    expect(fc1.lo95).toBeCloseTo(1.802889, 4)
    expect(fc1.hi95).toBeCloseTo(3.582364, 4)
    const fc2 = r.forecastRows[1]
    expect(fc2.forecast).toBeCloseTo(2.573609, 5)

    // Metadata
    expect(r.n).toBe(48)
    expect(r.nExcluded).toBe(0)

    // Figures: valid PNG bytes
    expect(Array.from(r.figForecastPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(r.figResidualsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('manual order ARIMA(1,0,0) matches auto on lh (same numbers)', async () => {
    const r = await runArimaSarima(engine, makeLhDataset(), 't', 'lh', {
      auto: false, p: 1, d: 0, q: 0, P: 0, D: 0, Q: 0, seasonalPeriod: 1, horizon: 2,
    })
    expect(r.autoSelected).toBe(false)
    expect(r.p).toBe(1); expect(r.d).toBe(0); expect(r.q).toBe(0)
    // AIC and coef ar1 match — arima() and auto.arima() with same spec give same result
    expect(r.aic).toBeCloseTo(64.75832, 4)
    expect(r.coefs[0].estimate).toBeCloseTo(0.5739296, 5)
    expect(r.n).toBe(48)
  }, 300_000)

  it('listwise: drops rows missing time or series value', async () => {
    const ds: Dataset = {
      columns: ['t', 'val'],
      rows: [
        ...LH_SERIES.slice(0, 25).map((v, i) => ({ t: i + 1, val: v })),
        { t: 26, val: null },   // missing series
        { t: null, val: 2.5 },  // missing time
        ...LH_SERIES.slice(26, 48).map((v, i) => ({ t: i + 27, val: v })),
      ],
    }
    const r = await runArimaSarima(engine, ds, 't', 'val', { auto: true, seasonalPeriod: 1, horizon: 2 })
    expect(r.nExcluded).toBe(2)
    // 25 + 22 = 47 complete rows (the { t:26, val:null } and { t:null, val:2.5 } rows are dropped)
    expect(r.n).toBe(47)
  }, 300_000)

  it('sort-by-time: shuffled rows produce same result as sorted', async () => {
    // Reverse the rows and confirm auto.arima gives the same aic (runner sorts)
    const shuffled: Dataset = {
      columns: ['t', 'lh'],
      rows: [...LH_SERIES.map((v, i) => ({ t: i + 1, lh: v }))].reverse(),
    }
    const r = await runArimaSarima(engine, shuffled, 't', 'lh', { auto: true, seasonalPeriod: 1, horizon: 1 })
    expect(r.aic).toBeCloseTo(64.75832, 4)
  }, 300_000)
})
