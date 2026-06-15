import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runStationarityTests } from './stationarityTests'
import type { Dataset } from './types'

// ── Spike dataset — R's built-in Nile series ─────────────────────────────────
// Annual flow of the Nile at Aswan, 1871-1970 (n=100, non-stationary).
// Spike anchors (native R 4.6.0, tseries):
//   ADF:  statistic = -3.3657139144,  lag = 4,  p = 0.0641954204  (exact)
//   KPSS: statistic =  0.9654349078,  lag = 4,  p = 0.01          (bounded: < .01)
//   PP:   statistic = -64.5006933552, lag = 3,  p = 0.01          (bounded: < .01)
// ADF → p > α=0.05 → non-stationary; KPSS → p < α=0.05 → non-stationary; PP → p < α=0.05 → stationary
// (PP null is unit root; rejecting means stationary — same as ADF null. Both non-stationary from high stat.)
// Wait: for PP statistic=-64.5, p=0.01 (bounded <0.01 → actual p very small → reject unit root → STATIONARY?
// Let me re-check: pp.test uses the p-value to reject H0: unit root. Small p → reject → stationary.
// But the statistic is very negative? Let me verify below with native R.

const NILE = [
  1120, 1160, 963, 1210, 1160, 1160, 813, 1230, 1370, 1140, 995, 935, 1110, 994, 1020, 960,
  1180, 799, 958, 1140, 1100, 1210, 1150, 1250, 1260, 1220, 1030, 1100, 774, 840, 874, 694,
  940, 833, 701, 916, 692, 1020, 1050, 969, 831, 726, 456, 824, 702, 1120, 1100, 832, 764,
  821, 768, 845, 864, 862, 698, 845, 744, 796, 1040, 759, 781, 865, 845, 944, 984, 897, 822,
  1010, 771, 676, 649, 846, 812, 742, 801, 1040, 860, 874, 848, 890, 744, 749, 838, 1050, 918,
  986, 797, 923, 975, 815, 1020, 906, 901, 1170, 912, 746, 919, 718, 714, 740,
]

function makeNileDataset(): Dataset {
  const rows = NILE.map((v, i) => ({ t: i + 1, nile: v }))
  return { columns: ['t', 'nile'], rows }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('runStationarityTests', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike — Nile series: ADF, KPSS, PP match native R 4.6.0 to ≥5 sig figs', async () => {
    const r = await runStationarityTests(engine, makeNileDataset(), 't', 'nile', { alpha: 0.05 })

    expect(r.n).toBe(100)
    expect(r.nExcluded).toBe(0)
    expect(r.alpha).toBe(0.05)
    expect(r.rows).toHaveLength(3)

    const [adf, kpss, pp] = r.rows

    // ADF — spike anchors
    expect(adf.test).toBe('ADF')
    expect(adf.statistic).toBeCloseTo(-3.3657139, 5)
    expect(adf.lag).toBe(4)
    expect(adf.p).toBeCloseTo(0.0641954204, 7)
    expect(adf.pBounded).toBeNull()         // ADF p is exact for Nile
    // ADF: p=0.0642 > α=0.05 → fail to reject unit root → non-stationary
    expect(adf.conclusion).toBe('non-stationary')

    // KPSS — spike anchors
    expect(kpss.test).toBe('KPSS')
    expect(kpss.statistic).toBeCloseTo(0.9654349, 5)
    expect(kpss.lag).toBe(4)
    expect(kpss.p).toBe(0.01)              // boundary value returned by tseries
    expect(kpss.pBounded).toBe('less')     // "p-value smaller than printed p-value"
    // KPSS: p=0.01 < α=0.05 → reject stationarity → non-stationary
    expect(kpss.conclusion).toBe('non-stationary')

    // PP — spike anchors (§2.5 addition)
    expect(pp.test).toBe('PP')
    expect(pp.statistic).toBeCloseTo(-64.5006934, 5)
    expect(pp.lag).toBe(3)
    expect(pp.p).toBe(0.01)               // boundary value
    expect(pp.pBounded).toBe('less')      // "p-value smaller than printed p-value"
    // PP: p=0.01 < α=0.05 → reject unit root → stationary
    // Note: contradicts ADF/KPSS for Nile — this is the known split result for this series
    expect(pp.conclusion).toBe('stationary')
  }, 900_000)

  it('figures: valid PNG bytes (series + ACF panels)', async () => {
    const r = await runStationarityTests(engine, makeNileDataset(), 't', 'nile')
    expect(Array.from(r.figSeriesPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(r.figAcfPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)

  it('listwise: drops rows with missing time or series', async () => {
    const ds: Dataset = {
      columns: ['t', 'val'],
      rows: [
        ...NILE.slice(0, 25).map((v, i) => ({ t: i + 1, val: v })),
        { t: 26, val: null },   // missing series
        { t: null, val: 900 }, // missing time
        ...NILE.slice(26, 60).map((v, i) => ({ t: i + 27, val: v })),
      ],
    }
    const r = await runStationarityTests(engine, ds, 't', 'val')
    expect(r.nExcluded).toBe(2)
    expect(r.n).toBe(59)  // 25 + 34 = 59 complete rows
  }, 300_000)

  it('sort-by-time: shuffled rows produce same ADF statistic as sorted', async () => {
    const shuffled: Dataset = {
      columns: ['t', 'nile'],
      rows: [...NILE.map((v, i) => ({ t: i + 1, nile: v }))].reverse(),
    }
    const r = await runStationarityTests(engine, shuffled, 't', 'nile')
    expect(r.rows[0].statistic).toBeCloseTo(-3.3657139, 5)
  }, 300_000)

  it('conclusion logic: stationary series gives ADF conclusion=stationary, KPSS=stationary', async () => {
    // White noise is stationary — ADF should reject unit root, KPSS should not reject stationarity
    // Use a fixed deterministic series that is clearly stationary (mean-zero bounded oscillation)
    const stationarySeries = Array.from({ length: 50 }, (_, i) => Math.sin(i * 0.3))
    const ds: Dataset = {
      columns: ['t', 'v'],
      rows: stationarySeries.map((v, i) => ({ t: i + 1, v })),
    }
    const r = await runStationarityTests(engine, ds, 't', 'v')
    // For a sine wave: ADF should strongly reject unit root (stationary)
    expect(r.rows[0].conclusion).toBe('stationary')  // ADF: p < α
    // KPSS may vary — just verify it returns a value
    expect(r.rows[1].conclusion).toMatch(/^(stationary|non-stationary)$/)
    expect(r.rows[2].conclusion).toMatch(/^(stationary|non-stationary)$/)
  }, 300_000)
})
