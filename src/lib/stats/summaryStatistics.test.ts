import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runSummaryStatistics } from './summaryStatistics'
import type { Dataset } from './types'

const long12: Dataset = { columns: ['group', 'score', 'age'], rows: [
  { group: 'control', score: 72, age: 31 }, { group: 'control', score: 68, age: 24 }, { group: 'control', score: 75, age: 29 },
  { group: 'control', score: 70, age: null }, { group: 'control', score: 66, age: 35 }, { group: 'control', score: 71, age: 27 },
  { group: 'treatment', score: 81, age: 22 }, { group: 'treatment', score: 79, age: 30 }, { group: 'treatment', score: 85, age: 26 },
  { group: 'treatment', score: 83, age: 33 }, { group: 'treatment', score: 78, age: 28 }, { group: 'treatment', score: 88, age: 25 },
] }

describe('runSummaryStatistics', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('overall: one row per variable, per-variable N, psych type-3 skew/excess kurtosis, a histogram per variable', async () => {
    const r = await runSummaryStatistics(engine, long12, ['score', 'age'])
    expect(r.grouped).toBe(false)
    expect(r.nExcluded).toBe(0) // per-variable N carries the missing-data story; nothing extra to report
    expect(r.rows.map((x) => x.variable)).toEqual(['score', 'age']) // drag order, one row each
    const s = r.rows[0]
    expect(s.n).toBe(12)
    expect(s.mean).toBeCloseTo(76.3333, 4)
    expect(s.sd).toBeCloseTo(7.0882, 4)
    expect(s.min).toBe(66); expect(s.max).toBe(88)
    expect(s.median).toBe(76.5)
    expect(s.skew).toBeCloseTo(0.1144, 4)      // describe type-3 b1 — NOT SPSS G1 (spike fact 3)
    expect(s.kurtosis).toBeCloseTo(-1.4922, 4) // EXCESS kurtosis b2−3
    expect(r.rows[1].n).toBe(11)               // age drops ITS OWN null only — per-variable N
    expect(r.histograms.map((h) => h.variable)).toEqual(['score', 'age'])
    for (const h of r.histograms) expect(Array.from(h.png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('group-by: stats repeat per group, groups alphabetical; the histogram stays one per variable', async () => {
    const r = await runSummaryStatistics(engine, long12, ['score'], 'group')
    expect(r.grouped).toBe(true)
    expect(r.rows.map((x) => [x.variable, x.group])).toEqual([['score', 'control'], ['score', 'treatment']])
    const [c, t] = r.rows
    expect(c.n).toBe(6)
    expect(c.mean).toBeCloseTo(70.3333, 4); expect(c.sd).toBeCloseTo(3.1411, 4)
    expect(c.min).toBe(66); expect(c.max).toBe(75); expect(c.median).toBe(70.5)
    expect(c.skew).toBeCloseTo(0.0669, 4); expect(c.kurtosis).toBeCloseTo(-1.5201, 4)
    expect(t.n).toBe(6)
    expect(t.mean).toBeCloseTo(82.3333, 4); expect(t.sd).toBeCloseTo(3.7771, 4)
    expect(t.min).toBe(78); expect(t.max).toBe(88); expect(t.median).toBe(82)
    expect(t.skew).toBeCloseTo(0.2488, 4); expect(t.kurtosis).toBeCloseTo(-1.7217, 4)
    expect(r.histograms).toHaveLength(1)
    expect(Array.from(r.histograms[0].png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
