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

describe('buildStationarityTests - APA line surfaces all three tests (ADF, KPSS, PP)', () => {
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

  it('A5: values carries the term-led explainer lookup (ADF row stands in for the 3-row table)', () => {
    expect(buildStationarityTests(STATIONARITY_TESTS, res).values).toEqual({
      test: 'ADF, KPSS, PP', statistic: '−8.38', lag: '4', p: '< .010', conclusion: 'stationary',
      standIn: 'ADF', statLabel: 'τ',
    })
  })

  it("R3 disclosure: the 'both' run names all three tests in howToRead", () => {
    const c = buildStationarityTests(STATIONARITY_TESTS, res)
    expect(c.howToRead).toContain('Tests run: ADF, KPSS, and Phillips–Perron.')
  })
})

// R3 (board-clearing T3): the 'test' selector genuinely subsets what renders - the builder must
// degrade sensibly when the runner reports only ADF or only KPSS (no non-null crash, verdict from
// the tests that ran, disclosure line naming them).
describe('buildStationarityTests - subset choices (R3)', () => {
  const adfOnly: StationarityResult = { ...res, rows: [res.rows[0]] }
  const kpssOnly: StationarityResult = { ...res, rows: [res.rows[1]] }

  it('ADF only: single table row, ADF-only APA verdict, disclosure line', () => {
    const c = buildStationarityTests(STATIONARITY_TESTS, adfOnly)
    expect(c.tables[0].rows.map((r) => r.test)).toEqual(['ADF'])
    expect(c.apa).toBe('ADF gave τ=−8.38, p < .010 (α=0.05).')
    expect(c.apa).not.toContain('KPSS')
    expect(c.apa).not.toContain('Phillips–Perron')
    expect(c.howToRead).toContain('Tests run: ADF only.')
    expect(c.values).toEqual({
      test: 'ADF', statistic: '−8.38', lag: '4', p: '< .010', conclusion: 'stationary',
      standIn: 'ADF', statLabel: 'τ',
    })
  })

  it('KPSS only: single table row, KPSS-only APA verdict, disclosure line, KPSS stands in for values', () => {
    const c = buildStationarityTests(STATIONARITY_TESTS, kpssOnly)
    expect(c.tables[0].rows.map((r) => r.test)).toEqual(['KPSS'])
    expect(c.apa).toBe('KPSS gave LM=1.81, p < .010 (α=0.05).')
    expect(c.apa).not.toContain('ADF')
    expect(c.apa).not.toContain('Phillips–Perron')
    expect(c.howToRead).toContain('Tests run: KPSS only.')
    expect(c.values).toEqual({
      test: 'KPSS', statistic: '1.81', lag: '3', p: '< .010', conclusion: 'non-stationary',
      standIn: 'KPSS', statLabel: 'LM',
    })
  })

  it('subset figures and note are unchanged (structure plots and the drawn-card note stay)', () => {
    const c = buildStationarityTests(STATIONARITY_TESTS, adfOnly)
    expect(c.figures).toHaveLength(2)
    expect(c.note).toBe(STATIONARITY_TESTS.tableNote)
  })
})
