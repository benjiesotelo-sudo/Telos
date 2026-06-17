import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runPairedTTest } from './pairedTTest'
import type { Dataset } from './types'

// pre6/post6 — the cross-verified paired fixture (WebR R 4.6.0 ≡ native R 4.6.0), row-paired in this order.
const data: Dataset = { columns: ['pre', 'post'], rows: [
  { pre: 72, post: 81 }, { pre: 68, post: 79 }, { pre: 75, post: 85 },
  { pre: 70, post: 83 }, { pre: 66, post: 78 }, { pre: 71, post: 88 },
  { pre: 70, post: null }, { pre: null, post: 80 }, // complete-pairs listwise: both rows EXCLUDED, never coerced
] }

describe('runPairedTTest', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('cross-verified numbers: per-condition describe, t/df/p, difference CI, dz, listwise pairs, figure', async () => {
    const r = await runPairedTTest(engine, data, 'pre', 'post')
    expect(r.nExcluded).toBe(2)
    expect(r.conditions.map((c) => c.condition)).toEqual(['pre', 'post'])
    expect(r.conditions[0].n).toBe(6)
    expect(r.conditions[0].mean).toBeCloseTo(70.333, 3)
    expect(r.conditions[0].sd).toBeCloseTo(3.141, 3)
    expect(r.conditions[1].mean).toBeCloseTo(82.333, 3)
    expect(r.conditions[1].sd).toBeCloseTo(3.777, 3)
    expect(r.pair).toBe('pre − post')               // U+2212, A − B subtraction order
    expect(r.t).toBeCloseTo(-10.392, 3)
    expect(r.df).toBe(5)
    expect(r.p).toBeCloseTo(0.000142, 5)
    expect(r.meanDiff).toBeCloseTo(-12, 6)
    expect(r.ci[0]).toBeCloseTo(-14.968, 3)
    expect(r.ci[1]).toBeCloseTo(-9.032, 3)
    expect(r.dz).toBeCloseTo(-4.243, 3)              // = mean(diff)/sd(diff), effectsize agrees to all digits
    expect(r.dzLow).toBeCloseTo(-6.903, 3)           // two-sided dz CI — native R effectsize::cohens_d(paired=TRUE, ci=0.95)
    expect(r.dzHigh).toBeCloseTo(-1.582, 3)
    // Shapiro-Wilk on the difference scores (pre − post): native R 4.6.0 shapiro.test(d$pre - d$post) on paired.csv
    expect(r.shapiro.W).toBeCloseTo(0.9223854, 5)
    expect(r.shapiro.p).toBeCloseTo(0.5227052, 5)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
