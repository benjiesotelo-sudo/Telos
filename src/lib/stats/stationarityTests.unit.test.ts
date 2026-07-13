import { describe, it, expect } from 'vitest'
import type { Engine } from '../webr/engine'
import { runStationarityTests, stationarityTestChoice } from './stationarityTests'
import { RUNNERS } from '../results/builders'
import type { StationarityResult } from './stationarityTests'
import type { Dataset } from './types'
import type { TestSetup } from '../../state/session'

// R3 (board-clearing T3): the registry 'test' select genuinely subsets which tests the runner
// reports. Mocked-engine unit - the WebR spike suite (stationarityTests.test.ts) stays the
// numeric ground-truth gate; this file pins the subsetting contract without an R session.

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Fixed payload standing in for the R side (shape = R_TESTS list())
const RAW = {
  adf: { statistic: -3.4, lag: 4, p: 0.03, pBounded: null },
  kpss: { statistic: 0.5, lag: 4, p: 0.01, pBounded: 'less' },
  pp: { statistic: -20.1, lag: 3, p: 0.01, pBounded: 'less' },
  n: 25,
}

const fakeEngine = {
  runJson: async () => RAW,
  capturePlot: async () => png,
} as unknown as Engine

const ds: Dataset = {
  columns: ['t', 'v'],
  rows: Array.from({ length: 25 }, (_, i) => ({ t: i + 1, v: Math.sin(i * 0.3) })),
}

describe('stationarityTestChoice - registry select string -> runner choice', () => {
  it('maps the three owner-visible choice strings', () => {
    expect(stationarityTestChoice('both · ADF + KPSS')).toBe('both')
    expect(stationarityTestChoice('ADF only')).toBe('adf')
    expect(stationarityTestChoice('KPSS only')).toBe('kpss')
  })
  it('defaults to both when the option is absent', () => {
    expect(stationarityTestChoice(undefined)).toBe('both')
  })
})

describe('runStationarityTests - the tests option subsets the reported rows (R3)', () => {
  it("'both' (and default) reports ADF, KPSS and PP", async () => {
    const r = await runStationarityTests(fakeEngine, ds, 't', 'v', { alpha: 0.05 })
    expect(r.rows.map((x) => x.test)).toEqual(['ADF', 'KPSS', 'PP'])
    const both = await runStationarityTests(fakeEngine, ds, 't', 'v', { alpha: 0.05, tests: 'both' })
    expect(both.rows.map((x) => x.test)).toEqual(['ADF', 'KPSS', 'PP'])
  })

  it("'adf' reports the ADF row only (PP accompanies 'both' only)", async () => {
    const r = await runStationarityTests(fakeEngine, ds, 't', 'v', { alpha: 0.05, tests: 'adf' })
    expect(r.rows.map((x) => x.test)).toEqual(['ADF'])
    expect(r.rows[0].statistic).toBe(-3.4)
    expect(r.rows[0].conclusion).toBe('stationary') // ADF null = unit root; p=.03 < α -> stationary
  })

  it("'kpss' reports the KPSS row only", async () => {
    const r = await runStationarityTests(fakeEngine, ds, 't', 'v', { alpha: 0.05, tests: 'kpss' })
    expect(r.rows.map((x) => x.test)).toEqual(['KPSS'])
    expect(r.rows[0].statistic).toBe(0.5)
    expect(r.rows[0].pBounded).toBe('less')
    expect(r.rows[0].conclusion).toBe('non-stationary') // KPSS null = stationary; p=.01 < α -> non-stationary
  })

  it('figures are still produced for a subset choice (level/ACF structure plots are choice-independent)', async () => {
    const r = await runStationarityTests(fakeEngine, ds, 't', 'v', { tests: 'adf' })
    expect(Array.from(r.figSeriesPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(r.figAcfPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})

describe("builders.ts RUNNERS threading - options['test'] reaches the runner (R3)", () => {
  const setupWith = (test?: string): TestSetup => ({
    roles: { time: ['t'], series: ['v'] },
    options: test === undefined ? { alpha: 0.05 } : { alpha: 0.05, test },
    props: {},
    blocked: null,
  })

  it("'ADF only' -> only the ADF row comes back through the app runner", async () => {
    const r = (await RUNNERS['stationarity-tests'](fakeEngine, ds, setupWith('ADF only'))) as StationarityResult
    expect(r.rows.map((x) => x.test)).toEqual(['ADF'])
  })
  it("'KPSS only' -> only the KPSS row", async () => {
    const r = (await RUNNERS['stationarity-tests'](fakeEngine, ds, setupWith('KPSS only'))) as StationarityResult
    expect(r.rows.map((x) => x.test)).toEqual(['KPSS'])
  })
  it("'both · ADF + KPSS' (the default) -> all three rows, exactly today's behavior", async () => {
    const r = (await RUNNERS['stationarity-tests'](fakeEngine, ds, setupWith('both · ADF + KPSS'))) as StationarityResult
    expect(r.rows.map((x) => x.test)).toEqual(['ADF', 'KPSS', 'PP'])
    const absent = (await RUNNERS['stationarity-tests'](fakeEngine, ds, setupWith(undefined))) as StationarityResult
    expect(absent.rows.map((x) => x.test)).toEqual(['ADF', 'KPSS', 'PP'])
  })
})
