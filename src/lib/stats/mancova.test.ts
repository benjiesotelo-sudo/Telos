import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runMancova } from './mancova'
import { loadAnovaFixture } from './fixtures/anova'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('runMancova (spike known answers — sequential manova, covariates-first)', () => {
  it('group row Pillai, F, p match spike (outcome+outcome2 ~ baseline + group)', async () => {
    const ds = loadAnovaFixture()
    const r = await runMancova(engine, ds, ['outcome', 'outcome2'], ['group'], ['baseline'], 'Pillai')
    // Group row (factor, last term): Pillai spike-proven identical to car::Manova Type II
    const groupRow = r.multivariate.find((m) => m.effect === 'group')!
    expect(groupRow).toBeDefined()
    expect(groupRow.pillai).toBeCloseTo(0.367525003974141, 6)
    expect(groupRow.pillaiF).toBeCloseTo(6.30374133529023, 6)
    expect(groupRow.pillaiDf1).toBe(4)
    expect(groupRow.pillaiDf2).toBe(112)
    expect(groupRow.pillaiP).toBeCloseTo(0.000130150921618041, 6)
    // Pillai selected: stat field = pillai
    expect(groupRow.stat).toBeCloseTo(0.367525003974141, 6)
    expect(groupRow.f).toBeCloseTo(6.30374133529023, 6)
    expect(groupRow.p).toBeCloseTo(0.000130150921618041, 6)
    // covariate row present with finite values
    const covRow = r.multivariate.find((m) => m.effect === 'baseline')!
    expect(covRow).toBeDefined()
    expect(Number.isFinite(covRow.stat)).toBe(true)
    expect(Number.isFinite(covRow.f)).toBe(true)
    // follow-ups
    const ouFu = r.followups.find((u) => u.dv === 'outcome')!
    expect(ouFu).toBeDefined()
    expect(ouFu.f).toBeCloseTo(8.0678942699764, 6)
    expect(ouFu.p).toBeCloseTo(0.000833763379568619, 6)
    expect(ouFu.df1).toBe(2)
    expect(ouFu.df2).toBe(56)
    const ou2Fu = r.followups.find((u) => u.dv === 'outcome2')!
    expect(ou2Fu).toBeDefined()
    expect(ou2Fu.f).toBeCloseTo(7.47387842662194, 6)
    expect(ou2Fu.p).toBeCloseTo(0.00132733951909915, 6)
    // slopes
    expect(r.slopes.length).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(r.slopes[0].p)).toBe(true)
    // listwise
    expect(r.nExcluded).toBe(0)
    expect(r.figurePng.length).toBeGreaterThan(1000)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('Wilks-selected: stat field = Wilks value; pillai fields still carry Pillai numbers', async () => {
    const ds = loadAnovaFixture()
    const r = await runMancova(engine, ds, ['outcome', 'outcome2'], ['group'], ['baseline'], 'Wilks')
    const groupRow = r.multivariate.find((m) => m.effect === 'group')!
    // Wilks stat
    expect(groupRow.stat).toBeCloseTo(0.634151614316368, 6)
    // Pillai fields still present and correct
    expect(groupRow.pillai).toBeCloseTo(0.367525003974141, 6)
    expect(groupRow.pillaiF).toBeCloseTo(6.30374133529023, 6)
  }, 900_000)
})
