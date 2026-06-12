import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runChiSquareGof } from './chiSquareGof'
import { loadAssociationFixture } from './fixtures/association'

describe('runChiSquareGof', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — equal proportions on method', async () => {
    const r = await runChiSquareGof(engine, loadAssociationFixture(), 'method', null)
    expect(r.chisq).toBeCloseTo(0.95, 6)
    expect(r.df).toBe(2)
    expect(r.p).toBeCloseTo(0.6218850565, 6)
    expect(r.w).toBeCloseTo(0.1541103501, 6)
    expect(r.rows.map((x) => x.category)).toEqual(['discussion', 'lecture', 'seminar']) // alphabetical = R table() order
    expect(r.rows[0].stdRes).toBeCloseTo(0.894427191, 6)
    expect(r.rows[1].stdRes).toBeCloseTo(-0.1118033989, 6)
    expect(r.rows[2].stdRes).toBeCloseTo(-0.7826237921, 6)
    expect(r.n).toBe(40)
  }, 900_000)

  it('spike known answers — custom proportions 0.5/0.3/0.2 (w computed against the same split)', async () => {
    const r = await runChiSquareGof(engine, loadAssociationFixture(), 'method', [0.5, 0.3, 0.2])
    expect(r.chisq).toBeCloseTo(2.008333333, 6)
    expect(r.p).toBeCloseTo(0.3663497991, 6)
    expect(r.w).toBeCloseTo(0.224072161, 6)
    expect(r.rows[0].expected).toBeCloseTo(20, 6) // 0.5 × 40
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
})
