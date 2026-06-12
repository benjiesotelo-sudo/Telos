import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { runRepeatedMeasuresAnova } from './repeatedMeasuresAnova'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('runRepeatedMeasuresAnova (spike known answers)', () => {
  it('3-measure GG correction: F, corrected df, p, pes, sphericity, posthoc', async () => {
    const ds = loadAnovaFixture()
    const r = await runRepeatedMeasuresAnova(engine, ds, 'subject_id', ['score_t1', 'score_t2', 'score_t3'], 'GG correction', true)

    // ANOVA row
    expect(r.anova.f).toBeCloseTo(78.5112991613406, 6)
    expect(r.anova.df1).toBeCloseTo(1.77543544965388, 6) // corrected by GG
    expect(r.anova.df2).toBeCloseTo(104.750691529579, 6) // corrected by GG
    expect(r.anova.p).toBeCloseTo(3.57330988681511e-20, 6)
    expect(r.anova.pes).toBeCloseTo(0.570944348865645, 6)

    // Sphericity row (3 levels → present)
    expect(r.sphericity).toHaveLength(1)
    expect(r.sphericity[0].w).toBeCloseTo(0.873515789948938, 6)
    expect(r.sphericity[0].p).toBeCloseTo(0.0198085203154266, 6)
    expect(r.sphericity[0].ggEps).toBeCloseTo(0.88771772482694, 6)
    expect(r.sphericity[0].hfEps).toBeCloseTo(0.913297705282412, 6)

    // Descriptives
    expect(r.desc).toHaveLength(3)
    expect(r.desc[0].condition).toBe('score_t1')
    expect(r.desc[0].n).toBe(60)
    expect(r.desc[1].n).toBe(60)
    expect(r.desc[2].n).toBe(60)

    // Post-hoc (bonferroni)
    const ph = r.posthoc.find((x) => x.pair === 'score_t1 - score_t2')!
    expect(ph).toBeDefined()
    expect(ph.diff).toBeCloseTo(-2.86333333333332, 6)
    expect(ph.se).toBeCloseTo(0.419866582701343, 6)
    expect(ph.pAdj).toBeCloseTo(1.63816152413875e-08, 6)
    expect(ph.ciLo).toBeCloseTo(-3.8979494382861, 5)
    expect(ph.ciHi).toBeCloseTo(-1.82871722838054, 5)

    // No exclusions
    expect(r.nExcluded).toBe(0)

    // Figure
    expect(r.figurePng.length).toBeGreaterThan(1000)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]) // PNG magic bytes
  }, 900_000)

  it('3-measure correction=none: uncorrected df = 2/118', async () => {
    const ds = loadAnovaFixture()
    const r = await runRepeatedMeasuresAnova(engine, ds, 'subject_id', ['score_t1', 'score_t2', 'score_t3'], 'none', false)
    expect(r.anova.df1).toBe(2)
    expect(r.anova.df2).toBe(118)
    expect(r.anova.p).toBeCloseTo(2.08115277471139e-22, 6)
    expect(r.posthoc).toHaveLength(0) // posthocOn = false
  }, 900_000)

  it('2-measure run: sphericity array is empty (2 levels, automatically met)', async () => {
    const ds = loadAnovaFixture()
    const r = await runRepeatedMeasuresAnova(engine, ds, 'subject_id', ['score_t1', 'score_t2'], 'GG correction', true)
    expect(r.sphericity).toEqual([])
    expect(r.desc).toHaveLength(2)
  }, 900_000)
})
