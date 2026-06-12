import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { runManova } from './manova'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('runManova (spike known answers: outcome+outcome2 ~ group)', () => {
  it('Pillai statistic: multivariate row, follow-ups, figure', async () => {
    const ds = loadAnovaFixture()
    const r = await runManova(engine, ds, ['outcome', 'outcome2'], ['group'], 'Pillai', true)

    // Multivariate row (single factor)
    expect(r.multivariate).toHaveLength(1)
    const mv = r.multivariate[0]
    expect(mv.effect).toBe('group')

    // Pillai stat (primary statistic = Pillai)
    expect(mv.stat).toBeCloseTo(0.285431562210818, 6)
    expect(mv.f).toBeCloseTo(4.74451724627428, 6)
    expect(mv.df1).toBe(4)
    expect(mv.df2).toBe(114)
    expect(mv.p).toBeCloseTo(0.00140868628003122, 6)

    // Pillai fields always computed (recorded decision 1)
    expect(mv.pillai).toBeCloseTo(0.285431562210818, 6)
    expect(mv.pillaiF).toBeCloseTo(4.74451724627428, 6)
    expect(mv.pillaiDf1).toBe(4)
    expect(mv.pillaiDf2).toBe(114)
    expect(mv.pillaiP).toBeCloseTo(0.00140868628003122, 6)

    // Follow-ups
    expect(r.followups).toHaveLength(2)
    const fu1 = r.followups.find((x) => x.dv === 'outcome')!
    expect(fu1.f).toBeCloseTo(2.80500665877123, 6)
    expect(fu1.df1).toBe(2)
    expect(fu1.df2).toBe(57)
    expect(fu1.p).toBeCloseTo(0.0688787403297547, 6)
    expect(fu1.pes).toBeCloseTo(0.0896024935993843, 6)

    const fu2 = r.followups.find((x) => x.dv === 'outcome2')!
    expect(fu2.f).toBeCloseTo(7.71055236740481, 6)
    expect(fu2.p).toBeCloseTo(0.00108711814052799, 6)

    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('Wilks statistic: stat differs; Pillai fields still carry Pillai numbers', async () => {
    const ds = loadAnovaFixture()
    const r = await runManova(engine, ds, ['outcome', 'outcome2'], ['group'], 'Wilks', true)

    const mv = r.multivariate[0]
    // Wilks value
    expect(mv.stat).toBeCloseTo(0.715289868403666, 6)
    // Pillai fields still report Pillai (recorded decision 1)
    expect(mv.pillai).toBeCloseTo(0.285431562210818, 6)
    expect(mv.pillaiF).toBeCloseTo(4.74451724627428, 6)
    expect(mv.pillaiP).toBeCloseTo(0.00140868628003122, 6)
  }, 900_000)

  it('followups=false → empty followup list', async () => {
    const ds = loadAnovaFixture()
    const r = await runManova(engine, ds, ['outcome', 'outcome2'], ['group'], 'Pillai', false)
    expect(r.followups).toHaveLength(0)
  }, 900_000)
})
