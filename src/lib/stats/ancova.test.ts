import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { runAncova } from './ancova'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('runAncova — spike-known answers (outcome ~ baseline + group)', () => {
  it('ANCOVA table rows, dfRes, partial η², slopes, adjusted means, posthoc, figure', async () => {
    const ds = loadAnovaFixture()
    const r = await runAncova(engine, ds, 'outcome', ['group'], ['baseline'])

    // Known answers from plan spike (native R 4.6.0)
    expect(r.nExcluded).toBe(0)
    expect(r.dfRes).toBe(56)

    // Covariate row (baseline)
    const cov = r.rows.find((x) => x.source === 'baseline')!
    expect(cov).toBeDefined()
    expect(cov.f).toBeCloseTo(72.2282718865225, 6)
    expect(cov.p).toBeCloseTo(1.17661542618733e-11, 6)
    expect(cov.pes).toBeCloseTo(0.563278837216507, 6)
    // partial η² CI (native R: effectsize::eta_squared(partial=TRUE, ci=0.95)); one-sided, upper pinned at 1.00
    expect(cov.pesLow).toBeCloseTo(0.419514961787953, 3)
    expect(cov.pesHigh).toBeCloseTo(1, 3)

    // Factor row (group)
    const grp = r.rows.find((x) => x.source === 'group')!
    expect(grp).toBeDefined()
    expect(grp.df).toBe(2)
    expect(grp.f).toBeCloseTo(8.0678942699764, 6)
    expect(grp.p).toBeCloseTo(0.000833763379568619, 6)
    expect(grp.pes).toBeCloseTo(0.223686312530096, 6)
    expect(grp.pesLow).toBeCloseTo(0.0704829854754854, 3)
    expect(grp.pesHigh).toBeCloseTo(1, 3)

    // Adjusted means: control row
    const ctrl = r.adjusted.find((x) => x.group === 'control')!
    expect(ctrl).toBeDefined()
    expect(ctrl.mean).toBeCloseTo(31.4221627207434, 6)
    expect(ctrl.se).toBeCloseTo(1.10991244962393, 6)
    expect(ctrl.ciLo).toBeCloseTo(29.1987409073006, 5)
    expect(ctrl.ciHi).toBeCloseTo(33.6455845341862, 5)

    // Slopes check: one term, p = 0.875021940147328
    expect(r.slopes).toHaveLength(1)
    expect(r.slopes[0].p).toBeCloseTo(0.875021940147328, 6)

    // Post-hoc control - drug_a pair
    const ph = r.posthoc.find((x) => x.pair === 'control - drug_a')!
    expect(ph).toBeDefined()
    expect(ph.diff).toBeCloseTo(-3.59989132599919, 6)
    expect(ph.se).toBeCloseTo(1.58175880993269, 6)
    expect(ph.pAdj).toBeCloseTo(0.0675916797250294, 6)
    expect(ph.ciLo).toBeCloseTo(-7.40807585588051, 5)
    expect(ph.ciHi).toBeCloseTo(0.208293203882136, 5)

    // Levene: finite values (not spiked — just check defined)
    expect(r.levene.F).not.toBeNull()
    expect(Number.isFinite(r.levene.F!)).toBe(true)
    expect(r.levene.p).not.toBeNull()
    expect(Number.isFinite(r.levene.p!)).toBe(true)

    // Figure is a PNG
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(r.figurePng.length).toBeGreaterThan(1000)
  }, 900_000)
})
