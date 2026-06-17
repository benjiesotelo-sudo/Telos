import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runChiSquareIndependence } from './chiSquareIndependence'
import { loadAssociationFixture } from './fixtures/association'

describe('runChiSquareIndependence', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — 2×2 passed × gender, correction ON (Yates default)', async () => {
    const r = await runChiSquareIndependence(engine, loadAssociationFixture(), 'passed', 'gender', true)
    expect(r.chisq).toBeCloseTo(3.609022556, 6)
    expect(r.df).toBe(1)
    expect(r.p).toBeCloseTo(0.05746688583, 6)
    expect(r.v).toBeCloseTo(0.350438322, 6) // effectsize::cramers_v(adjust=FALSE) ≡ hand V on UNCORRECTED χ² ≡ rcompanion native default
    expect(r.vLow).toBeCloseTo(0.0858147466, 3)  // cramers_v(adjust=FALSE, ci=0.95)$CI_low — native R ≡ WebR
    expect(r.vHigh).toBeCloseTo(1, 3)            // one-sided CI: upper bound pinned at 1.00
    expect(r.rowCats).toEqual(['no', 'yes'])
    expect(r.colCats).toEqual(['female', 'male'])
    expect(r.counts.at(-1)!.at(-1)).toBe(40) // grand total margin
    expect(r.n).toBe(40)
    // chisq.test(tab)$stdres — native-R ground truth (unaffected by Yates correction). rows no/yes × cols female/male.
    expect(r.stdRes[0][0]).toBeCloseTo(2.216367, 6)
    expect(r.stdRes[0][1]).toBeCloseTo(-2.216367, 6)
    expect(r.stdRes[1][0]).toBeCloseTo(-2.216367, 6)
    expect(r.stdRes[1][1]).toBeCloseTo(2.216367, 6)
  }, 900_000)

  it('spike known answers — 2×2 correction OFF', async () => {
    const r = await runChiSquareIndependence(engine, loadAssociationFixture(), 'passed', 'gender', false)
    expect(r.chisq).toBeCloseTo(4.912280702, 6)
    expect(r.p).toBeCloseTo(0.02666640835, 6)
  }, 300_000)

  it('spike known answers — 3×2 method × passed (correction inert for non-2×2)', async () => {
    const r = await runChiSquareIndependence(engine, loadAssociationFixture(), 'method', 'passed', true)
    expect(r.chisq).toBeCloseTo(4.903517535, 6)
    expect(r.df).toBe(2)
    expect(r.p).toBeCloseTo(0.08614194953, 6)
    expect(r.v).toBeCloseTo(0.3501256037, 6)
    expect(r.vLow).toBeCloseTo(0, 3)    // cramers_v(adjust=FALSE, ci=0.95)$CI_low — native R ≡ WebR
    expect(r.vHigh).toBeCloseTo(1, 3)   // one-sided CI: upper bound pinned at 1.00
    expect(r.minExpected).toBeCloseTo(5.225, 6)
    // chisq.test(tab)$stdres — native-R ground truth. rows discussion/lecture/seminar × cols no/yes.
    expect(r.stdRes[0][0]).toBeCloseTo(2.197439, 6)
    expect(r.stdRes[0][1]).toBeCloseTo(-2.197439, 6)
    expect(r.stdRes[1][0]).toBeCloseTo(-1.470311, 6)
    expect(r.stdRes[1][1]).toBeCloseTo(1.470311, 6)
    expect(r.stdRes[2][0]).toBeCloseTo(-0.868649, 6)
    expect(r.stdRes[2][1]).toBeCloseTo(0.868649, 6)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
})
