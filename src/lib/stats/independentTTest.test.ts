import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runIndependentTTest } from './independentTTest'
import type { Dataset } from './types'

const data: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'A', score: 10 }, { group: 'A', score: 12 }, { group: 'A', score: 11 }, { group: 'A', score: 13 },
  { group: 'B', score: 15 }, { group: 'B', score: 17 }, { group: 'B', score: 16 }, { group: 'B', score: 18 },
  { group: 'A', score: null }, { group: null, score: 14 }, // listwise: both rows must be EXCLUDED, never coerced to 0
] }

// Same numbers as Task 7's SAMPLE (unequal SDs: 3.14 vs 3.78) — inlined because sample.ts lands in Task 7.
const unequal: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 }, { group: 'control', score: 70 }, { group: 'control', score: 66 }, { group: 'control', score: 71 },
  { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 }, { group: 'treatment', score: 83 }, { group: 'treatment', score: 78 }, { group: 'treatment', score: 88 },
] }

describe('runIndependentTTest', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('equal variance ON → pooled row; spec tables, listwise exclusion, Levene, Cohen d, boxplot', async () => {
    const r = await runIndependentTTest(engine, data, 'score', 'group', true)
    expect(r.nExcluded).toBe(2)
    expect(r.groupStats.map((g) => g.group)).toEqual(['A', 'B'])
    expect(r.groupStats[0].n).toBe(4)
    expect(r.groupStats[0].se).toBeCloseTo(0.6455, 3)
    expect(r.test).toBe('pooled')
    expect(r.df).toBe(6)
    expect(r.t).toBeCloseTo(-5.477, 2)
    expect(r.p).toBeLessThan(0.01)
    expect(r.cohensD).toBeCloseTo(-3.873, 2)
    // effectsize::cohens_d(score ~ group, ci=0.95, pooled_sd=TRUE) — native R ≡ WebR (pooled CI when equal-variance ON)
    expect(r.cohensDLow).toBeCloseTo(-6.3785, 3)
    expect(r.cohensDHigh).toBeCloseTo(-1.2891, 3)
    expect(r.contrast).toBe('A − B')
    expect(r.levene.F).toBe(0) // equal SDs
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('equal variance OFF (the drawn default) → Welch row: fractional df, Welch CI', async () => {
    const r = await runIndependentTTest(engine, unequal, 'score', 'group', false)
    expect(r.test).toBe('welch')
    expect(r.t).toBeCloseTo(-5.983, 2)
    expect(r.df).toBeCloseTo(9.678, 2)   // Welch–Satterthwaite (pooled would be exactly 10)
    expect(r.ci[0]).toBeCloseTo(-16.489, 2)
    expect(r.ci[1]).toBeCloseTo(-7.511, 2)
    // effectsize::cohens_d(score ~ group, ci=0.95, pooled_sd=FALSE) — Welch default → un-pooled/Hedges CI
    expect(r.cohensDLow).toBeCloseTo(-5.3154, 3)
    expect(r.cohensDHigh).toBeCloseTo(-1.5329, 3)
    expect(r.nExcluded).toBe(0)
    // Within-group normality: Shapiro-Wilk per group ≡ native R `shapiro.test(score[group==l])` on study.csv (the doc config)
    // control: W=0.992631, p=0.994608 · treatment: W=0.963536, p=0.846537
    expect(r.shapiroByGroup.map((s) => s.group)).toEqual(['control', 'treatment'])
    expect(r.shapiroByGroup[0].W).toBeCloseTo(0.992631, 4)
    expect(r.shapiroByGroup[0].p).toBeCloseTo(0.994608, 4)
    expect(r.shapiroByGroup[1].W).toBeCloseTo(0.963536, 4)
    expect(r.shapiroByGroup[1].p).toBeCloseTo(0.846537, 4)
  })

  it("Cohen's d point estimate is the prior pooled value regardless of the toggle; only its CI shifts pooled↔un-pooled", async () => {
    // effectsize's cohens_d uses the pooled standardizer for the POINT estimate either way; the toggle only re-derives the CI.
    const on  = await runIndependentTTest(engine, unequal, 'score', 'group', true)   // equal variance ON  → pooled CI
    const off = await runIndependentTTest(engine, unequal, 'score', 'group', false)  // Welch default      → un-pooled CI
    expect(on.cohensD).toBeCloseTo(-3.4545, 3)        // == the prior hand-rolled pooled d
    expect(off.cohensD).toBeCloseTo(on.cohensD, 6)    // point estimate unchanged by the toggle
    expect(on.cohensDLow).toBeCloseTo(-5.2966, 3)     // pooled_sd=TRUE  CI
    expect(on.cohensDHigh).toBeCloseTo(-1.5521, 3)
    expect(off.cohensDLow).toBeCloseTo(-5.3154, 3)    // pooled_sd=FALSE CI (un-pooled), strictly wider on the low side
    expect(off.cohensDHigh).toBeCloseTo(-1.5329, 3)
  })

  it('alternative=greater yields ~half the two-tailed p when effect is in that direction (control<treatment)', async () => {
    // The unequal dataset has control mean 70.3 < treatment mean 82.3; contrast is control−treatment (negative t).
    // alternative='greater' means μ_first − μ_second > 0 (control > treatment), which is AGAINST the observed direction.
    // So p(greater) ≈ 1 − p(two-sided)/2, and p(less) ≈ p(two-sided)/2.
    const twoTailed = await runIndependentTTest(engine, unequal, 'score', 'group', false, 0.95, 0.05, 'two.sided')
    const greater   = await runIndependentTTest(engine, unequal, 'score', 'group', false, 0.95, 0.05, 'greater')
    const less      = await runIndependentTTest(engine, unequal, 'score', 'group', false, 0.95, 0.05, 'less')
    // t is negative (control below treatment), so:
    //   less (predicted control < treatment): p ≈ two-tailed / 2
    //   greater (opposite direction): p ≈ 1 - two-tailed / 2
    expect(less.p).toBeCloseTo(twoTailed.p / 2, 6)
    expect(greater.p).toBeCloseTo(1 - twoTailed.p / 2, 6)
    // Confirm tails field flows through
    expect(twoTailed.tails).toBe('two.sided')
    expect(greater.tails).toBe('greater')
    expect(less.tails).toBe('less')
  })
})
