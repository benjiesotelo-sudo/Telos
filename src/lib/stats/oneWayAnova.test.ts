import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { runOneWayAnova } from './oneWayAnova'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('runOneWayAnova (spike known answers)', () => {
  it('Tukey HSD: F, df, p, eta2, levene, shapiro, desc, posthoc, nExcluded, figurePng', async () => {
    const res = await runOneWayAnova(engine, loadAnovaFixture(), 'outcome', 'group', 'Tukey HSD')
    expect(res.f).toBeCloseTo(2.80500665877123, 6)
    expect(res.dfB).toBe(2)
    expect(res.dfW).toBe(57)
    expect(res.p).toBeCloseTo(0.0688787403297547, 6)
    expect(res.eta2).toBeCloseTo(0.0896024935993843, 6)
    expect(res.levene.F!).toBeCloseTo(0.0224210736545674, 6)
    expect(res.levene.p!).toBeCloseTo(0.977837029926746, 6)
    expect(res.shapiro.W).not.toBeNull()
    expect(res.shapiro.W).toBeGreaterThan(0)
    expect(res.shapiro.W).toBeLessThanOrEqual(1)
    expect(res.desc).toHaveLength(3)
    expect(res.desc[0]).toMatchObject({ group: 'control', n: 20 })
    const ph = res.posthoc.find((x) => x.pair === 'control - drug_a')!
    expect(ph).toBeDefined()
    expect(ph.pAdj).toBeCloseTo(0.828376280197589, 6)
    expect(res.nExcluded).toBe(0)
    expect(res.figurePng.length).toBeGreaterThan(1000)
  }, 300_000)

  it("Scheffé: control-drug_a pAdj matches spike ground truth", async () => {
    const res = await runOneWayAnova(engine, loadAnovaFixture(), 'outcome', 'group', 'Scheffé')
    const ph = res.posthoc.find((x) => x.pair === 'control - drug_a')!
    expect(ph).toBeDefined()
    expect(ph.pAdj).toBeCloseTo(0.842874697999946, 6)
  }, 300_000)
})
