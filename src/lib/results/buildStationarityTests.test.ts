import { describe, it, expect } from 'vitest'
import { buildStationarityTests } from './buildStationarityTests'
import { STATIONARITY_TESTS } from '../registry/stationarityTests'
import type { StationarityResult } from '../stats/stationarityTests'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Mock = native-R 4.6.0 ground truth for the card's documented fixture:
//   docs/test-documentation/31_stationarity-tests — timeseries.csv, month→time, sales→series, α 0.05.
// Verified with Rscript (tseries) on ts(sales, frequency=1), n=72:
//   ADF:  statistic = -8.38196248614,  lag = 4, p = 0.01 (bounded: < .01)
//   KPSS: statistic =  1.80886737322,  lag = 3, p = 0.01 (bounded: < .01)
//   PP:   statistic = -26.9267552193,  lag = 3, p = 0.01 (bounded: < .01)
const res: StationarityResult = {
  rows: [
    { test: 'ADF',  statistic: -8.38196248614, lag: 4, p: 0.01, pBounded: 'less', conclusion: 'stationary' },
    { test: 'KPSS', statistic:  1.80886737322, lag: 3, p: 0.01, pBounded: 'less', conclusion: 'non-stationary' },
    { test: 'PP',   statistic: -26.9267552193, lag: 3, p: 0.01, pBounded: 'less', conclusion: 'stationary' },
  ],
  alpha: 0.05,
  n: 72,
  nExcluded: 0,
  figSeriesPng: png,
  figAcfPng: png,
}

describe('buildStationarityTests — APA line surfaces all three tests (ADF, KPSS, PP)', () => {
  it('APA sentence includes the Phillips–Perron clause with its Z statistic and p', () => {
    const c = buildStationarityTests(STATIONARITY_TESTS, res)
    // §2.5 econometrics-grade: PP was in the table but had been dropped from the APA line — now restored.
    expect(c.apa).toBe(
      'ADF gave τ=−8.38, p < .010; KPSS gave LM=1.81, p < .010; Phillips–Perron gave Z=−26.93, p < .010 (α=0.05).',
    )
    // PP clause is present (regression guard against it being dropped again)
    expect(c.apa).toContain('Phillips–Perron gave Z=−26.93, p < .010')
    // no unresolved placeholders remain
    expect(c.apa).not.toMatch(/\{[a-z]+\}/)
  })

  it('table still renders all three test rows with the bounded p operator', () => {
    const c = buildStationarityTests(STATIONARITY_TESTS, res)
    const rows = c.tables[0].rows
    expect(rows.map((r) => r.test)).toEqual(['ADF', 'KPSS', 'PP'])
    expect(rows.map((r) => r.p)).toEqual(['< .010', '< .010', '< .010'])
    expect(rows.map((r) => r.statistic)).toEqual(['−8.38', '1.81', '−26.93'])
  })

  it('an exact (unbounded) PP p renders with the APA "= .nnn" operator', () => {
    const exact: StationarityResult = {
      ...res,
      rows: [
        res.rows[0],
        res.rows[1],
        { test: 'PP', statistic: -3.5, lag: 2, p: 0.0312, pBounded: null, conclusion: 'stationary' },
      ],
    }
    const c = buildStationarityTests(STATIONARITY_TESTS, exact)
    expect(c.apa).toContain('Phillips–Perron gave Z=−3.50, p = .031')
  })
})
