import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runFishersExact } from './fishersExact'
import { loadAssociationFixture } from './fixtures/association'

describe('runFishersExact', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — 2×2 passed × gender (p, OR, CI)', async () => {
    const r = await runFishersExact(engine, loadAssociationFixture(), 'passed', 'gender')
    expect(r.p).toBeCloseTo(0.05616092643, 6)
    expect(r.is2x2).toBe(true)
    expect(r.or).toBeCloseTo(4.163405972, 6)
    expect(r.ciLow).toBeCloseTo(0.9694478355, 6)
    expect(r.ciHigh).toBeCloseTo(20.18251251, 5)
    expect(r.counts.at(-1)!.at(-1)).toBe(40)
    expect(r.n).toBe(40)
  }, 900_000)

  it('spike known answers — 3×3 method × grade_band (exact p + Cramér V vs native-R)', async () => {
    const r = await runFishersExact(engine, loadAssociationFixture(), 'method', 'grade_band')
    expect(r.p).toBeCloseTo(0.5354022782, 6)
    expect(r.is2x2).toBe(false)
    expect(r.or).toBeUndefined()
    // larger-than-2×2: OR is undefined → effectsize::cramers_v(adjust=FALSE, ci=0.95) is the association effect size.
    // native-R ground truth: V=0.198644856473, CI [0, 1] (one-sided, upper bound pinned at 1.00).
    expect(r.v).toBeCloseTo(0.198644856473, 6)
    expect(r.vLow).toBeCloseTo(0, 6)
    expect(r.vHigh).toBeCloseTo(1, 6)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)

  it('2×2 has no Cramér V (OR is the effect size there)', async () => {
    const r = await runFishersExact(engine, loadAssociationFixture(), 'passed', 'gender')
    // fisher.test returns the CONDITIONAL MLE odds ratio, not the sample cross-product (4.33…).
    expect(r.or).toBeCloseTo(4.16340597179, 6)
    expect(r.v).toBeUndefined()
    expect(r.vLow).toBeUndefined()
    expect(r.vHigh).toBeUndefined()
  }, 300_000)
})
