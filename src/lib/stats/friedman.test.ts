import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { runFriedman } from './friedman'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('friedman stats engine (spike known answers)', () => {
  it('χ², df, p, Kendall\'s W, mean ranks, Nemenyi posthoc', async () => {
    const ds = loadAnovaFixture()
    const res = await runFriedman(engine, ds, 'subject_id', ['score_t1', 'score_t2', 'score_t3'])

    // Main test statistics
    expect(res.chi2).toBeCloseTo(67.1882845188285, 6)
    expect(res.df).toBe(2)
    expect(res.p).toBeCloseTo(2.57187224967219e-15, 6)
    expect(res.w).toBeCloseTo(0.559902370990237, 6)
    // Kendall's W CI — effectsize::kendalls_w(ci=0.95) with set.seed(42); native R ≡ WebR.
    // One-sided CI: upper bound pinned at 1.00 (APA convention for variance-explained sizes).
    expect(res.wLow).toBeCloseTo(0.4786111, 3)
    expect(res.wHigh).toBeCloseTo(1, 3)

    // Mean ranks — strictly increasing t1 < t2 < t3, sum per condition = n * k*(k+1)/2 / n = 6 / 3 ≈ 2
    // Actually mean rank per condition sums to (k+1)/2 * k / k = (k+1)/2 * ... let me just check ordering
    expect(res.ranks).toHaveLength(3)
    expect(res.ranks[0].condition).toBe('score_t1')
    expect(res.ranks[1].condition).toBe('score_t2')
    expect(res.ranks[2].condition).toBe('score_t3')
    // Strictly increasing
    expect(res.ranks[0].meanRank).toBeLessThan(res.ranks[1].meanRank)
    expect(res.ranks[1].meanRank).toBeLessThan(res.ranks[2].meanRank)
    // Mean ranks sum to (k+1)/2 * k = 6 total across k=3, so avg per condition = 2, sum = 6
    const rankSum = res.ranks.reduce((s, r) => s + r.meanRank, 0)
    expect(rankSum).toBeCloseTo(6, 10) // n * k*(k+1)/2 / n = k*(k+1)/2 = 6 for k=3

    // Nemenyi posthoc: score_t1 - score_t2 (spike-validated ≡ PMCMRplus)
    const ph12 = res.posthoc.find((r) => r.pair === 'score_t1 - score_t2')!
    expect(ph12).toBeDefined()
    expect(ph12.pAdj).toBeCloseTo(2.83863931227479e-05, 6)

    // Other posthoc pairs present (3 total for k=3: t1-t2, t1-t3, t2-t3)
    expect(res.posthoc).toHaveLength(3)
    const ph13 = res.posthoc.find((r) => r.pair === 'score_t1 - score_t3')!
    expect(ph13).toBeDefined()
    expect(ph13.pAdj).toBeGreaterThan(0)
    expect(ph13.pAdj).toBeLessThanOrEqual(1)

    // Listwise: all 60 rows complete
    expect(res.nExcluded).toBe(0)

    // Figure rendered
    expect(res.figurePng.length).toBeGreaterThan(1000)
  }, 900_000)
})
