import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runOneSampleTTest } from './oneSampleTTest'
import type { Dataset } from './types'

// post6 = the archive's treatment scores (TEST 1). Two junk rows exercise the single-column drop:
// null and a non-numeric string must be EXCLUDED, never coerced to 0.
const data: Dataset = { columns: ['post_score'], rows: [
  { post_score: 81 }, { post_score: 79 }, { post_score: 85 }, { post_score: 83 }, { post_score: 78 }, { post_score: 88 },
  { post_score: null }, { post_score: 'n/a' },
] }

describe('runOneSampleTTest', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('μ0 = 70: descriptives, t/df/p, DIFFERENCE CI (conf.int − μ0), d, Shapiro-Wilk, exclusions, PNG', async () => {
    const r = await runOneSampleTTest(engine, data, 'post_score', 70)
    expect(r.nExcluded).toBe(2)
    expect(r.variable).toBe('post_score')
    expect(r.n).toBe(6)
    expect(r.mean).toBeCloseTo(82.3333, 3)
    expect(r.sd).toBeCloseTo(3.7771, 3)
    expect(r.se).toBeCloseTo(1.542, 3)
    expect(r.mu0).toBe(70)
    expect(r.t).toBeCloseTo(7.9982, 3)
    expect(r.df).toBe(5)
    expect(r.p).toBeCloseTo(0.000493, 5)
    expect(r.meanDiff).toBeCloseTo(12.3333, 3)
    expect(r.ci[0]).toBeCloseTo(8.3695, 3)   // 78.3694847 − 70: the rendered CI is the DIFFERENCE CI
    expect(r.ci[1]).toBeCloseTo(16.2972, 3)  // 86.2971820 − 70
    expect(r.cohensD).toBeCloseTo(3.2653, 3)
    expect(r.cohensDLow).toBeCloseTo(1.1437, 3)   // effectsize::cohens_d(ci=0.95)$CI_low  (Task-1 spike: native R ≡ WebR)
    expect(r.cohensDHigh).toBeCloseTo(5.3681, 3)  // effectsize::cohens_d(ci=0.95)$CI_high
    expect(r.shapiro.W).toBeCloseTo(0.9635, 3)
    expect(r.shapiro.p).toBeCloseTo(0.8465, 3)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('μ0 = 0 (the drawn default): t/p/meanDiff/d move, the difference CI coincides with the mean CI', async () => {
    const r = await runOneSampleTTest(engine, data, 'post_score', 0)
    expect(r.t).toBeCloseTo(53.3937, 3)
    expect(r.df).toBe(5)
    expect(r.p).toBeLessThan(1e-6)           // archived: 4.357e-08
    expect(r.meanDiff).toBeCloseTo(82.3333, 3)
    expect(r.ci[0]).toBeCloseTo(78.3695, 3)  // − 0: identical to the mean CI (archived fact)
    expect(r.ci[1]).toBeCloseTo(86.2972, 3)
    expect(r.cohensD).toBeCloseTo(21.7979, 3)
  })
})
