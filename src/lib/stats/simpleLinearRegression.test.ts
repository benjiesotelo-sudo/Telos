import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runSimpleLinearRegression } from './simpleLinearRegression'
import { loadRegressionFixture } from './fixtures/regression'
import type { Dataset } from './types'

describe('runSimpleLinearRegression', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — post_score ~ pre_score (fit, coefficients, t-CIs, β refit, sigma)', async () => {
    const r = await runSimpleLinearRegression(engine, loadRegressionFixture(), 'post_score', 'pre_score')
    expect(r.r2).toBeCloseTo(0.659416639, 6)
    expect(r.adjR2).toBeCloseTo(0.650453919, 6)
    expect(r.f).toBeCloseTo(73.573272020, 5)
    expect(r.df1).toBe(1)
    expect(r.df2).toBe(38)
    expect(r.p).toBeCloseTo(2.024931906e-10, 9)
    expect(r.sigma).toBeCloseTo(5.605309647, 6)
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'pre_score'])
    const [int, pre] = r.terms
    expect(int.b).toBeCloseTo(20.070279220, 5)
    expect(int.se).toBeCloseTo(4.539674859, 6)
    expect(int.beta).toBeNull() // standardized intercept ≈ 0 (≤1e-17 in the spike) → NA_real_ → null → blank cell
    expect(int.t).toBeCloseTo(4.421082972, 6)
    expect(int.p).toBeCloseTo(7.946544031e-5, 9)
    expect(int.ciLow).toBeCloseTo(10.880187930, 5)
    expect(int.ciHigh).toBeCloseTo(29.260370510, 5)
    expect(pre.b).toBeCloseTo(0.641817080, 6)
    expect(pre.se).toBeCloseTo(0.074825777, 6)
    expect(pre.beta).toBeCloseTo(0.812044727, 6) // refit β ≡ hand B·SD(x)/SD(y)
    expect(pre.t).toBeCloseTo(8.577486346, 6)
    expect(pre.p).toBeCloseTo(2.024931906e-10, 9)
    expect(pre.ciLow).toBeCloseTo(0.490340214, 6)
    expect(pre.ciHigh).toBeCloseTo(0.793293946, 6)
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figFitPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(r.figResidualsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('categorical predictor — factor path, "<column>: <level>" naming, points-only figure (structure, not spike-pinned)', async () => {
    const r = await runSimpleLinearRegression(engine, loadRegressionFixture(), 'post_score', 'group')
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'group: b']) // reference 'a' first-alphabetical
    expect(r.terms[1].beta).not.toBeNull()
    expect(r.n).toBe(40)
    expect(Array.from(r.figFitPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)

  it('listwise: drops rows missing either column, own N (convention 15)', async () => {
    const ds: Dataset = { columns: ['a', 'b'], rows: [
      { a: 1, b: 2 }, { a: 2, b: 4 }, { a: 3, b: 5 }, { a: 4, b: 9 },
      { a: null, b: 1 }, { a: 5, b: null },
    ] }
    const r = await runSimpleLinearRegression(engine, ds, 'b', 'a')
    expect(r.n).toBe(4)
    expect(r.nExcluded).toBe(2)
  }, 300_000)
})
