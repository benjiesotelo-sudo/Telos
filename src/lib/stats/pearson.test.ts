import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runPearson } from './pearson'
import { loadAssociationFixture } from './fixtures/association'
import type { Dataset } from './types'

describe('runPearson', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers (hours_studied × exam_score)', async () => {
    const r = await runPearson(engine, loadAssociationFixture(), 'hours_studied', 'exam_score')
    expect(r.r).toBeCloseTo(0.7016484693, 6)
    expect(r.t).toBeCloseTo(6.070330284, 6)
    expect(r.df).toBe(38)
    expect(r.p).toBeCloseTo(4.558820127e-07, 9)
    expect(r.ciLow).toBeCloseTo(0.4992630807, 6)
    expect(r.ciHigh).toBeCloseTo(0.8314317357, 6)
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('listwise: excludes rows missing either variable', async () => {
    const ds: Dataset = { columns: ['a', 'b'], rows: [
      { a: 1, b: 2 }, { a: 2, b: 4 }, { a: 3, b: 5 }, { a: 4, b: 9 },
      { a: null, b: 1 }, { a: 5, b: null },
    ] }
    const r = await runPearson(engine, ds, 'a', 'b')
    expect(r.n).toBe(4)
    expect(r.nExcluded).toBe(2)
  }, 300_000)

  it('alternative=greater yields ~half the two-tailed p for a positive correlation', async () => {
    // hours_studied × exam_score: r=0.70 (positive), so 'greater' (positive association) is in the predicted direction.
    const twoTailed = await runPearson(engine, loadAssociationFixture(), 'hours_studied', 'exam_score', 0.95, 0.05, 'two.sided')
    const greater   = await runPearson(engine, loadAssociationFixture(), 'hours_studied', 'exam_score', 0.95, 0.05, 'greater')
    const less      = await runPearson(engine, loadAssociationFixture(), 'hours_studied', 'exam_score', 0.95, 0.05, 'less')
    // Positive t: greater ≈ two-sided/2; less ≈ 1 − two-sided/2
    expect(greater.p).toBeCloseTo(twoTailed.p / 2, 9)
    expect(less.p).toBeCloseTo(1 - twoTailed.p / 2, 9)
    // Confirm tails field flows through
    expect(twoTailed.tails).toBe('two.sided')
    expect(greater.tails).toBe('greater')
    expect(less.tails).toBe('less')
  }, 900_000)
})
