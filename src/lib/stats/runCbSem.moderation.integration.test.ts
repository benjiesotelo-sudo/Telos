import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runCbSem } from './runCbSem'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'
import type { TestSetup } from '../../state/session'

// Reference values: native R 4.6.0 / lavaan 0.6.21 / semTools, spike-moderation-data.csv (n=400, SN/TA/TI,
// 4/4/3 continuous indicators, real interaction baked in: ti = .5*sn + .3*ta + .15*sn*ta + .7*noise).
// Model (matched, equal 4x4 counts -> match=TRUE): SN=~sn1..4 · TA=~ta1..4 · TI=~ti1..3 ·
//   INT_1=~sn1.ta1+sn2.ta2+sn3.ta3+sn4.ta4 · TI~p_1_3*SN+pmod_1*TA+pint_1*INT_1 · TA~~vmod_1*TA ·
//   slope_lo/mid/hi_1 := p_1_3 -/+/= pint_1*sqrt(vmod_1). set.seed(20260620), bootstrap=500.
// Point estimates reproduce the moderation spike's own headline numbers exactly (seed-independent):
// pint_1 B=0.25819002 (spike: 0.25819002); std beta=0.23155625 (spike: 0.23155625).
//   p_1_3   (SN->TI):  est=0.46586675 se=0.05577359 z=8.35282013 p<.001  percCI=[0.35651075,0.58738458]  bcCI=[0.36050554,0.58815806]
//   pint_1  (INT_1):   est=0.25819002 se=0.06353873 z=4.06350608 p=.0000483  percCI=[0.14047757,0.38982514]  bcCI=[0.14105695,0.39313381]
//     std beta (pint_1) = 0.23155625
//   slope_lo_1 (-1SD): est=0.25882670 percCI=[0.14362545,0.40289849]  bcCI=[0.14797701,0.41184661]
//   slope_mid_1 (mean): est=0.46586675 percCI=[0.35651075,0.58738458]  bcCI=[0.36050554,0.58815806]
//   slope_hi_1 (+1SD): est=0.67290681 percCI=[0.51454643,0.84252335]  bcCI=[0.51799175,0.85224986]
//   R²(TI) = 0.37238998
const SETUP: TestSetup = {
  roles: {}, options: { estimator: 'ML', nboot: 500, ciType: 'percentile' }, props: {}, blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
    { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
    { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
  ],
  paths: [{ from: 1, to: 3 }],
  moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
}

describe('runCbSem — latent moderation (matched, equal indicator counts)', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('matches native-R exactly on the spike-moderation dataset (interaction row + := simple slopes)', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/sem-moderation.csv'))
    const result = await runCbSem(engine, data, SETUP)
    const row = result.moderation!.rows[0]
    expect(row.matched).toBe(true)
    expect(row.disclosure).toBeUndefined()
    expect(row.b).toBeCloseTo(0.25819002, 4)
    expect(row.se).toBeCloseTo(0.06353873, 4)
    expect(row.p).toBeLessThan(0.0001)
    expect(row.stdBeta).toBeCloseTo(0.23155625, 4)
    expect(row.ciPercLower).toBeCloseTo(0.14047757, 2)
    expect(row.ciPercUpper).toBeCloseTo(0.38982514, 2)
    expect(row.ciBcLower).toBeCloseTo(0.14105695, 2)
    expect(row.ciBcUpper).toBeCloseTo(0.39313381, 2)
    expect(result.rsquare![3]).toBeCloseTo(0.37238998, 3)

    const [lo, mid, hi] = result.moderation!.slopes
    expect(lo.level).toBe('-1SD'); expect(lo.b).toBeCloseTo(0.25882670, 3)
    expect(mid.level).toBe('mean'); expect(mid.b).toBeCloseTo(0.46586675, 3)
    expect(hi.level).toBe('+1SD'); expect(hi.b).toBeCloseTo(0.67290681, 3)
    expect(lo.ciPercLower).toBeCloseTo(0.14362545, 2)
    expect(hi.ciBcUpper).toBeCloseTo(0.85224986, 2)

    // Task 5.3: the canvas moderation-arrow overlay carries the SAME standardized interaction beta as
    // row.stdBeta above (0.23155625), keyed by moderatorId/pathIndex instead of the internal moderation
    // edge id -- SemCanvas reads this to label the dashed arrow post-run.
    expect(result.estimates.moderation).toEqual([{ moderatorId: 2, pathIndex: 0, beta: expect.closeTo(0.2316, 3) }])
  }, 600_000)

  // Unequal counts (SN=4 items, TA3=3 items) -> match=FALSE, all-pairs product indicators (12 = 4x3),
  // disclosure expected on the moderation row. Reference values, same seed/bootstrap, 2026-07-06:
  //   p_1_3 (SN->TI):  est=0.46030216 se=0.05600989 z=8.21823001 p<.001  percCI=[0.34215160,0.58120763]
  //   pint_1 (INT_1):  est=0.17599985 se=0.04891316 z=3.59821052 p=.00032041 percCI=[0.08080807,0.27090353]
  //   R²(TI) = 0.34668962
  //   slope_lo_1: est=0.31961391 percCI=[0.19881748,0.45459792] · slope_hi_1: est=0.60099040 percCI=[0.46455810,0.74473831]
  const UNEQUAL_SETUP: TestSetup = {
    ...SETUP,
    constructs: [
      { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
      { id: 2, name: 'TA3', items: ['ta1', 'ta2', 'ta3'] },
      { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
    ],
  }

  it('unequal indicator counts fall back to match=FALSE with a disclosure note on the moderation row', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/sem-moderation.csv'))
    const result = await runCbSem(engine, data, UNEQUAL_SETUP)
    const row = result.moderation!.rows[0]
    expect(row.matched).toBe(false)
    expect(row.disclosure).toMatch(/unequal indicator counts/)
    expect(row.b).toBeCloseTo(0.17599985, 3)
    expect(row.ciPercLower).toBeCloseTo(0.08080807, 2)
    expect(result.rsquare![3]).toBeCloseTo(0.34668962, 3)

    const [lo, , hi] = result.moderation!.slopes
    expect(lo.b).toBeCloseTo(0.31961391, 2)
    expect(hi.b).toBeCloseTo(0.60099040, 2)
  }, 600_000)

  it('rejects WLSMV + moderation before touching the engine', async () => {
    const engine2 = new Engine()
    const bad: TestSetup = { ...SETUP, options: { ...SETUP.options, estimator: 'WLSMV' } }
    // At least one ordinal indicator so semFitArgs's "needs an ordinal indicator" guard doesn't fire
    // first and mask the moderation-specific message this test asserts (H1 wiring: semFitArgs.ts checks
    // the ordinal guard before the moderation guard -- see runCbSem.test.ts's semFitArgs-wiring describe).
    await expect(
      runCbSem(
        engine2,
        loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/sem-moderation.csv')),
        bad,
        undefined,
        { sn1: 'ordinal' },
      ),
    ).rejects.toThrow(/ML-family estimator/)
  })
})
