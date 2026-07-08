import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runPoissonNegativeBinomial } from './poissonNegativeBinomial'
import { loadRegressionFixture } from './fixtures/regression'

describe('runPoissonNegativeBinomial', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — Poisson, no exposure (complaints ~ age + group): fit, dispersion ratio, profile IRR CIs', async () => {
    const r = await runPoissonNegativeBinomial(engine, loadRegressionFixture(), 'complaints', ['age', 'group'], null, 'Poisson')
    expect(r.aic).toBeCloseTo(222.367487400, 5)
    expect(r.deviance).toBeCloseTo(87.564440000, 4)
    expect(r.dfResid).toBe(37)
    expect(r.dispersion).toBeCloseTo(2.107972385, 6) // check_overdispersion $dispersion_ratio ≡ hand Pearson χ²/df
    // R1 gap-fix: the overdispersion-test verdict/p was computed by check_overdispersion but discarded — native R verified.
    expect(r.dispersionP).toBeCloseTo(9.454383e-05, 8)
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'age', 'group: b'])
    const [, age, grp] = r.terms
    expect(age.b).toBeCloseTo(0.010598371, 6)
    expect(age.se).toBeCloseTo(0.004845496, 6)
    expect(age.z).toBeCloseTo(2.187262248, 6)
    expect(age.p).toBeCloseTo(0.028723385, 6)
    expect(age.irr).toBeCloseTo(1.010654733, 6)
    expect(age.irrLow).toBeCloseTo(1.001083633, 6)   // profile (suppressMessages), NOT Wald
    expect(age.irrHigh).toBeCloseTo(1.020301670, 6)
    expect(grp.irr).toBeCloseTo(1.062525031, 6)
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figResidualsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('spike known answers — Poisson WITH exposure offset (offset(log(months_observed)) in-formula)', async () => {
    const r = await runPoissonNegativeBinomial(engine, loadRegressionFixture(), 'complaints', ['age', 'group'], 'months_observed', 'Poisson')
    expect(r.aic).toBeCloseTo(202.368510500, 5)
    expect(r.bic).toBeCloseTo(207.435148800, 5)       // native-R BIC(glm) — modelsummary GOF row (3 params)
    expect(r.logLik).toBeCloseTo(-98.184255230, 5)    // native-R as.numeric(logLik(m))
    expect(r.deviance).toBeCloseTo(67.565463040, 5)
    expect(r.dispersion).toBeCloseTo(1.686886555, 6)
    const age = r.terms[1]
    expect(age.b).toBeCloseTo(0.013258484, 6)
    expect(age.p).toBeCloseTo(0.007042652, 6)
    expect(age.irr).toBeCloseTo(1.013346767, 6)
  }, 300_000)

  it('spike known answers — negative binomial, no exposure: dispersion cell = theta (convention 10)', async () => {
    const r = await runPoissonNegativeBinomial(engine, loadRegressionFixture(), 'complaints', ['age', 'group'], null, 'negative binomial')
    expect(r.aic).toBeCloseTo(211.223026200, 5)
    expect(r.deviance).toBeCloseTo(45.150147170, 5)
    expect(r.dfResid).toBe(37)
    expect(r.dispersion).toBeCloseTo(4.474253358, 6) // m$theta
    expect(r.terms[1].irr).toBeCloseTo(1.010798495, 6)
    expect(r.model).toBe('negative binomial')
    // R1 gap-fix: the overdispersion TEST doesn't apply to NB (theta already models it) — no verdict/p.
    expect(r.dispersionP).toBeNull()
  }, 300_000)

  it('spike known answers — negative binomial WITH exposure: theta + profile IRR CIs (glm.nb in-formula offset)', async () => {
    const r = await runPoissonNegativeBinomial(engine, loadRegressionFixture(), 'complaints', ['age', 'group'], 'months_observed', 'negative binomial')
    expect(r.aic).toBeCloseTo(200.096113400, 5)
    expect(r.bic).toBeCloseTo(206.851631200, 5)       // native-R BIC(glm.nb) — counts theta as a 4th param
    expect(r.logLik).toBeCloseTo(-96.048056710, 5)    // native-R as.numeric(logLik(m))
    expect(r.deviance).toBeCloseTo(45.810830490, 5)
    expect(r.dispersion).toBeCloseTo(9.000773027, 5) // theta
    const age = r.terms[1]
    expect(age.p).toBeCloseTo(0.034619623, 6)
    expect(age.irr).toBeCloseTo(1.013285719, 6)
    expect(age.irrLow).toBeCloseTo(1.001024427, 6)
    expect(age.irrHigh).toBeCloseTo(1.025753033, 6)
  }, 300_000)

  // Regression guard (docs-v2 sweep, 2026-07-08): with EVERY predictor categorical the runner passes
  // numnames: [] / nums_flat: [] — webr 0.6.0's fromD3 crashed on empty JS arrays ("Cannot convert
  // undefined or null to object") until the Engine's empty-array→NULL binding. Native-R-pinned.
  it('all-categorical predictors (complaints ~ group + method): no numeric column in env', async () => {
    const r = await runPoissonNegativeBinomial(engine, loadRegressionFixture(), 'complaints', ['group', 'method'], null, 'Poisson')
    expect(r.aic).toBeCloseTo(216.426619422, 5)
    expect(r.deviance).toBeCloseTo(79.623572004, 5)
    expect(r.dfResid).toBe(36)
    expect(r.dispersion).toBeCloseTo(2.022546874, 6)
    expect(r.dispersionP).toBeCloseTo(0.000272122828, 8)
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'group: b', 'method: online', 'method: workshop'])
    const online = r.terms[2]
    expect(online.b).toBeCloseTo(0.592670754, 6)
    expect(online.irr).toBeCloseTo(1.808812864, 6)
    expect(online.irrLow).toBeCloseTo(1.294831824, 6)  // profile CI
    expect(online.irrHigh).toBeCloseTo(2.564348629, 6)
    expect(r.n).toBe(40)
    expect(Array.from(r.figResidualsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
})
