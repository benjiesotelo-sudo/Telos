import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runLogisticRegression } from './logisticRegression'
import { loadRegressionFixture } from './fixtures/regression'

describe('runLogisticRegression', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — event = yes (passed ~ pre_score + age + group): fit, profile-OR CIs, classification, AUC', async () => {
    const r = await runLogisticRegression(engine, loadRegressionFixture(), 'passed', ['pre_score', 'age', 'group'], 'yes', true)
    expect(r.m2ll).toBeCloseTo(45.908685210, 5)
    expect(r.aic).toBeCloseTo(53.908685210, 5)
    expect(r.nagelkerke).toBeCloseTo(0.283002870, 6)
    expect(r.omnibusChisq).toBeCloseTo(9.543089235, 6)
    expect(r.omnibusDf).toBe(3)
    expect(r.omnibusP).toBeCloseTo(0.022877354, 6)
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'pre_score', 'age', 'group: b'])
    const [, pre, age, grp] = r.terms
    expect(pre.b).toBeCloseTo(0.079190519, 6)
    expect(pre.se).toBeCloseTo(0.037506735, 6)
    expect(pre.z).toBeCloseTo(2.111367978, 6)
    expect(pre.p).toBeCloseTo(0.034740695, 6)
    expect(pre.or).toBeCloseTo(1.082410522, 6)
    expect(pre.orLow).toBeCloseTo(1.012732368, 6)   // profile-likelihood (suppressMessages), NOT Wald
    expect(pre.orHigh).toBeCloseTo(1.176927471, 6)
    expect(age.b).toBeCloseTo(0.031993651, 6)
    expect(age.p).toBeCloseTo(0.239276896, 6)
    expect(grp.b).toBeCloseTo(1.240356431, 6)
    expect(grp.or).toBeCloseTo(3.456845371, 5)
    expect(grp.orLow).toBeCloseTo(0.866707308, 6)
    expect(grp.orHigh).toBeCloseTo(15.442995620, 4)
    // Classification (convention 8): rows = PREDICTED levels in factor order [other, event] = [no, yes].
    expect(r.levels).toEqual(['no', 'yes'])
    expect(r.classCounts).toEqual([[13, 7], [7, 13]])
    expect(r.pctCorrect).toEqual([65, 65])
    expect(r.auc).toBeCloseTo(0.76, 9)
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figRocPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('event = no — B sign-flips and ORs invert EXACTLY; fit rows and AUC are INVARIANT (spike-pinned symmetry)', async () => {
    const r = await runLogisticRegression(engine, loadRegressionFixture(), 'passed', ['pre_score', 'age', 'group'], 'no', true)
    expect(r.levels).toEqual(['yes', 'no']) // releveled: chosen event is glm's second level
    const [, pre, , grp] = r.terms
    expect(pre.b).toBeCloseTo(-0.079190519, 6)      // exact sign flip
    expect(pre.or).toBeCloseTo(0.923863894, 6)      // exact inversion: 1/1.082410522
    expect(pre.orLow).toBeCloseTo(0.849670031, 6)   // bounds swap AND invert
    expect(pre.orHigh).toBeCloseTo(0.987427707, 6)
    expect(grp.or).toBeCloseTo(0.289281091, 6)      // 1/3.456845371
    expect(grp.orLow).toBeCloseTo(0.064754276, 6)   // = 1/orHigh(yes)
    expect(grp.orHigh).toBeCloseTo(1.153792048, 6)
    expect(r.m2ll).toBeCloseTo(45.908685210, 5)     // invariant
    expect(r.aic).toBeCloseTo(53.908685210, 5)      // invariant
    expect(r.nagelkerke).toBeCloseTo(0.283002870, 6) // invariant
    expect(r.auc).toBeCloseTo(0.76, 9)              // INVARIANT — not 1 − AUC (spike surprise 4)
    expect(r.classCounts).toEqual([[13, 7], [7, 13]]) // mirrored table (symmetric here), rows now predicted yes/no
    expect(r.pctCorrect).toEqual([65, 65])
  }, 300_000)
})
