import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { runMixedAnova } from './mixedAnova'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('runMixedAnova (spike known answers, GG correction)', () => {
  it('between-group row: F, df, p, pes match native R', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)

    // Between row (title-cased)
    const btwn = res.anovaRows[0]
    expect(btwn.source).toBe('Group (between)')
    expect(btwn.f).toBeCloseTo(0.24690089648661, 6)
    expect(btwn.p).toBeCloseTo(0.782049251682351, 6)
    expect(btwn.pes).toBeCloseTo(0.00858878309615581, 6)
    // partial-η² one-sided CI: effectsize::eta_squared(partial=TRUE, ci=0.95)$CI_low/$CI_high (native R ≡ WebR)
    expect(btwn.pesLow).toBeCloseTo(0, 3)
    expect(btwn.pesHigh).toBeCloseTo(1, 3)
    expect(btwn.df1).toBe(2)
    expect(btwn.df2).toBe(57)
  }, 900_000)

  it('within-condition row: GG-corrected df/F/p/pes match native R', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)

    const within = res.anovaRows[1]
    expect(within.source).toBe('Condition (within)')
    expect(within.f).toBeCloseTo(82.5610819498742, 6)
    expect(within.p).toBeCloseTo(1.51705412973608e-19, 6)
    expect(within.pes).toBeCloseTo(0.591576683100862, 6)
    expect(within.pesLow).toBeCloseTo(0.4975677831, 3)   // effectsize::eta_squared(ci=0.95)$CI_low
    expect(within.pesHigh).toBeCloseTo(1, 3)             // one-sided: upper pinned at 1.00
    // GG-corrected displayed dfs
    expect(within.df1).toBeCloseTo(1.67166869889464, 5)
    expect(within.df2).toBeCloseTo(95.2851158369946, 4)
  }, 900_000)

  it('interaction row: GG-corrected F/p/pes match native R', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)

    const inter = res.anovaRows[2]
    expect(inter.source).toBe('Group × Condition')
    expect(inter.f).toBeCloseTo(2.52167386781147, 6)
    expect(inter.p).toBeCloseTo(0.0561473099306867, 6)
    expect(inter.pes).toBeCloseTo(0.0812874855998016, 6)
    expect(inter.pesLow).toBeCloseTo(0.0010147975, 3)   // effectsize::eta_squared(ci=0.95)$CI_low
    expect(inter.pesHigh).toBeCloseTo(1, 3)             // one-sided: upper pinned at 1.00
    expect(inter.df1).toBeCloseTo(3.34333739778929, 5)
    expect(inter.df2).toBeCloseTo(95.2851158369946, 4)
  }, 900_000)

  it('sphericity: Mauchly W/p + GG ε match native R', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)

    expect(res.sphericity).toHaveLength(2)  // condition + interaction
    const condRow = res.sphericity.find((r) => r.effect === 'condition')!
    expect(condRow.w).toBeCloseTo(0.803590686765588, 6)
    expect(condRow.p).toBeCloseTo(0.00219268908877968, 6)
    expect(condRow.ggEps).toBeCloseTo(0.835834349447321, 6)
  }, 900_000)

  it('posthoc score_t1 - score_t2 pair matches native R', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)

    const ph = res.posthoc.find((r) => r.pair === 'score_t1 - score_t2')!
    expect(ph).toBeDefined()
    expect(ph.diff).toBeCloseTo(-2.86333333333332, 6)
    expect(ph.se).toBeCloseTo(0.420150001061303, 6)
    expect(ph.pAdj).toBeCloseTo(1.9397562305748e-08, 6)
    expect(ph.ciLo).toBeCloseTo(-3.89971187769057, 5)
    expect(ph.ciHi).toBeCloseTo(-1.82695478897608, 5)
  }, 900_000)

  it('descriptives: 9 cells (3 groups × 3 conditions), n=20 each', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)

    expect(res.desc).toHaveLength(9)
    expect(res.desc.every((d) => d.n === 20)).toBe(true)
  }, 900_000)

  it('levene F/p are finite numbers', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)

    expect(res.levene.F).not.toBeNull()
    expect(Number.isFinite(res.levene.F!)).toBe(true)
    expect(res.levene.p).not.toBeNull()
    expect(Number.isFinite(res.levene.p!)).toBe(true)
  }, 900_000)

  it('no rows excluded from the clean fixture', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)
    expect(res.nExcluded).toBe(0)
  }, 900_000)

  it('figure PNG has reasonable byte length', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)
    expect(res.figurePng.length).toBeGreaterThan(1000)
  }, 900_000)

  it('2-measure run: sphericity array is empty (builder omits the sphericity table)', async () => {
    const ds = loadAnovaFixture()
    const res = await runMixedAnova(engine, ds, 'subject_id', 'group', ['score_t1', 'score_t2'], 'GG correction', true)
    expect(res.sphericity).toEqual([])
  }, 900_000)
})
