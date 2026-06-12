import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runMultipleLinearRegression } from './multipleLinearRegression'
import { loadRegressionFixture } from './fixtures/regression'

describe('runMultipleLinearRegression', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — post_score ~ pre_score + age + group + method (fit, B/SE/t/p/CI, refit β, GVIF convention)', async () => {
    const r = await runMultipleLinearRegression(engine, loadRegressionFixture(), 'post_score', ['pre_score', 'age', 'group', 'method'], false)
    expect(r.r2).toBeCloseTo(0.750223512, 6)
    expect(r.adjR2).toBeCloseTo(0.713491675, 6)
    expect(r.f).toBeCloseTo(20.424339860, 5)
    expect(r.df1).toBe(5)
    expect(r.df2).toBe(34)
    expect(r.p).toBeCloseTo(2.245462388e-9, 9)
    // Term order = drag order; dummy rows '<column>: <level>' (R-glued names mapped; references a / lecture).
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'pre_score', 'age', 'group: b', 'method: online', 'method: workshop'])
    const [int, pre, age, grp, onl, wks] = r.terms
    expect(int.b).toBeCloseTo(20.361340940, 5)
    expect(int.se).toBeCloseTo(6.030400820, 5)
    expect(int.beta).toBeNull()
    expect(int.vif).toBeNull()
    expect(pre.b).toBeCloseTo(0.612871402, 6)
    expect(pre.se).toBeCloseTo(0.075712457, 6)
    expect(pre.t).toBeCloseTo(8.094723475, 5)
    expect(pre.p).toBeCloseTo(1.941055777e-9, 9)
    expect(pre.ciLow).toBeCloseTo(0.459005177, 6)
    expect(pre.ciHigh).toBeCloseTo(0.766737627, 6)
    expect(pre.beta).toBeCloseTo(0.775421855, 6)   // numeric refit β ≡ hand B·SD(x)/SD(y)
    expect(pre.vif).toBeCloseTo(1.249106308, 6)
    expect(age.b).toBeCloseTo(0.018242579, 6)
    expect(age.p).toBeCloseTo(0.788294904, 6)
    expect(age.beta).toBeCloseTo(0.027593357, 6)
    expect(age.vif).toBeCloseTo(1.414860417, 6)
    expect(grp.b).toBeCloseTo(5.353172626, 5)
    expect(grp.t).toBeCloseTo(3.258776701, 6)
    expect(grp.p).toBeCloseTo(0.002542392, 6)
    expect(grp.beta).toBeCloseTo(0.564629882, 6)   // dummy refit β ≡ hand B/SD(y) — NOT B·SD(dummy)/SD(y)
    expect(grp.vif).toBeCloseTo(1.037328861, 6)
    expect(onl.b).toBeCloseTo(-2.049172535, 5)
    expect(onl.beta).toBeCloseTo(-0.216138004, 6)
    expect(onl.vif).toBeCloseTo(1.247536921, 6)    // method (Df=2): (GVIF^(1/4))^2 = 1.116931923^2
    expect(wks.b).toBeCloseTo(-3.247840455, 5)
    expect(wks.p).toBeCloseTo(0.162160847, 6)
    expect(wks.ciLow).toBeCloseTo(-7.867110628, 5)
    expect(wks.ciHigh).toBeCloseTo(1.371429717, 5)
    expect(wks.beta).toBeCloseTo(-0.342568398, 6)
    expect(wks.vif).toBeCloseTo(1.247536921, 6)    // both method dummy rows share the parent term's value
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figResidualsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('k = 1 predictor — VIF undefined (car::vif would error "fewer than 2 terms") → null; fit ≡ the simple-linear spike', async () => {
    const r = await runMultipleLinearRegression(engine, loadRegressionFixture(), 'post_score', ['pre_score'], true)
    expect(r.r2).toBeCloseTo(0.659416639, 6)       // cross-check against simple-linear ground truth
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'pre_score'])
    expect(r.terms[1].vif).toBeNull()
    expect(r.terms[1].beta).toBeCloseTo(0.812044727, 6)
    expect(r.standardize).toBe(true)
  }, 300_000)
})
