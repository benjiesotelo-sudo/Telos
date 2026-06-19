import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runParallelAnalysis } from './parallelAnalysis'
import { orderFactors } from './factorOrder'

// Reference values: native R 4.6.0, HolzingerSwineford1939[, c("x1".."x9")].
// Observed eigenvalues are eigen(cor(x))$values — deterministic, no simulation.
// retain=3 matches psych::fa.parallel(x, fa="pc") with Horn's (1965) parallel analysis.
// Simulated 95th-percentile threshold: seeded (seed=20260619, nsim=500) so retain is stable.
const HS_OBSERVED = [3.216, 1.639, 1.365, 0.699, 0.584, 0.500, 0.473, 0.286, 0.238]

describe('parallelAnalysis', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('retain=3 and observed eigenvalues match native-R on HolzingerSwineford1939 x1–x9 (kind=pca)', async () => {
    const result = await runParallelAnalysis(engine, 'pca')
    expect(result.retain).toBe(3)
    expect(result.observed).toHaveLength(9)
    for (let i = 0; i < 9; i++) {
      expect(result.observed[i]).toBeCloseTo(HS_OBSERVED[i], 2)
    }
    expect(result.simP95).toHaveLength(9)
    // simP95 must be < observed[0] for component 0, and > observed for retained+1
    // (retain=3 means observed[2] > simP95[2] and observed[3] <= simP95[3])
    expect(result.observed[2]).toBeGreaterThan(result.simP95[2])
    expect(result.observed[3]).toBeLessThanOrEqual(result.simP95[3])
  }, 600_000)

  it('retain is 2 or 3 and eigenvalues are finite/real on HolzingerSwineford1939 x1–x9 (kind=fa)', async () => {
    const result = await runParallelAnalysis(engine, 'fa')
    // psych::fa.parallel on HS x1–x9 with fa="fa" typically retains 2–3 factors
    expect(result.retain).toBeGreaterThanOrEqual(2)
    expect(result.retain).toBeLessThanOrEqual(3)
    expect(result.observed).toHaveLength(9)
    expect(result.simP95).toHaveLength(9)
    // The clamp guarantees no NaN or eigenvalue corruption from out-of-range smc() values
    for (let i = 0; i < 9; i++) {
      expect(Number.isFinite(result.observed[i])).toBe(true)
      expect(Number.isFinite(result.simP95[i])).toBe(true)
    }
  }, 600_000)
})

describe('orderFactors', () => {
  it('sorts by descending SS-loadings, returns column-index permutation', () => {
    // orderFactors([1, 3, 2]) → factor 1 (SS=3) first, factor 2 (SS=2) second, factor 0 (SS=1) third
    expect(orderFactors([1, 3, 2])).toEqual([1, 2, 0])
  })

  it('ties broken by original (lower) index', () => {
    // orderFactors([2, 2, 1]) → tie between 0 and 1 — 0 first (lower index)
    expect(orderFactors([2, 2, 1])).toEqual([0, 1, 2])
  })

  it('single factor returns [0]', () => {
    expect(orderFactors([5])).toEqual([0])
  })

  it('already sorted returns identity permutation', () => {
    expect(orderFactors([5, 3, 1])).toEqual([0, 1, 2])
  })
})
