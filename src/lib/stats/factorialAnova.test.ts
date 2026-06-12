import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { runFactorialAnova } from './factorialAnova'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('runFactorialAnova (afex Type III, spike known answers)', () => {
  it('outcome ~ group * gender: ANOVA rows, descriptives, simple effects, levene, shapiro, figure', async () => {
    const res = await runFactorialAnova(engine, loadAnovaFixture(), 'outcome', ['group', 'gender'], true)

    // ANOVA table rows (3 terms: group, gender, group × gender)
    expect(res.rows).toHaveLength(3)

    const groupRow = res.rows.find((r) => r.source === 'group')!
    expect(groupRow).toBeDefined()
    expect(groupRow.f).toBeCloseTo(3.04188224848381, 6)
    expect(groupRow.df).toBe(2)
    expect(groupRow.p).toBeCloseTo(0.0560001080368759, 6)
    expect(groupRow.pes).toBeCloseTo(0.101254715777249, 6)
    expect(groupRow.ms).toBeCloseTo(groupRow.ss / groupRow.df, 6)
    expect(groupRow.ss).toBeGreaterThan(0)

    const genderRow = res.rows.find((r) => r.source === 'gender')!
    expect(genderRow).toBeDefined()
    expect(genderRow.f).toBeCloseTo(2.84368260584025, 6)
    expect(genderRow.df).toBe(1)
    expect(genderRow.p).toBeCloseTo(0.097503832286258, 6)
    expect(genderRow.pes).toBeCloseTo(0.050026361338315, 6)

    const interactionRow = res.rows.find((r) => r.source === 'group × gender')!
    expect(interactionRow).toBeDefined()
    expect(interactionRow.f).toBeCloseTo(2.48491031233834, 6)
    expect(interactionRow.df).toBe(2)
    expect(interactionRow.p).toBeCloseTo(0.0928168303408816, 6)
    expect(interactionRow.pes).toBeCloseTo(0.0842773569943164, 6)
    // All 3 rows share denominator df=54 (verify via pes ~ ss/(ss+ssr))
    expect(interactionRow.ms).toBeCloseTo(interactionRow.ss / interactionRow.df, 6)
    expect(interactionRow.ss).toBeGreaterThan(0)

    // Descriptives: 6 cells (3 group levels × 2 gender levels), each n=10
    expect(res.desc).toHaveLength(6)
    res.desc.forEach((c) => { expect(c.n).toBe(10) })

    // Simple effects: marginal tukey rows (3 group + 1 gender) + interaction bonferroni rows
    // control - drug_a | f spike known answer
    const seRow = res.simpleEffects.find((r) => r.pair === 'control - drug_a | f')!
    expect(seRow).toBeDefined()
    expect(seRow.diff).toBeCloseTo(-3.55000000000001, 4)
    expect(seRow.se).toBeCloseTo(3.17721634512094, 6)
    expect(seRow.pAdj).toBeCloseTo(0.806399369392838, 6)
    expect(seRow.ciLo).toBeCloseTo(-11.4004190074112, 4)
    expect(seRow.ciHi).toBeCloseTo(4.30041900741119, 4)
    expect(seRow.term).toBe('group × gender')

    // Marginal group pairs present (3 pairs) + 1 gender pair + interaction rows
    const groupMarginals = res.simpleEffects.filter((r) => r.term === 'group')
    const genderMarginals = res.simpleEffects.filter((r) => r.term === 'gender')
    expect(groupMarginals).toHaveLength(3)
    expect(genderMarginals).toHaveLength(1)
    groupMarginals.forEach((r) => { expect(Number.isFinite(r.diff)).toBe(true) })

    // Levene (on cells) + Shapiro
    expect(res.levene.F).not.toBeNull()
    expect(res.levene.p).not.toBeNull()
    expect(Number.isFinite(res.levene.F!)).toBe(true)
    expect(Number.isFinite(res.levene.p!)).toBe(true)
    expect(res.shapiro.W).not.toBeNull()
    expect(res.shapiro.W!).toBeGreaterThan(0)
    expect(res.shapiro.W!).toBeLessThanOrEqual(1)

    expect(res.nExcluded).toBe(0)
    expect(res.figurePng.length).toBeGreaterThan(1000)
  }, 900_000)

  it('interactions=false: uses + formula, no interaction rows in simpleEffects', async () => {
    const res = await runFactorialAnova(engine, loadAnovaFixture(), 'outcome', ['group', 'gender'], false)
    // No interaction rows in ANOVA table (only main effects)
    expect(res.rows.every((r) => !r.source.includes('×'))).toBe(true)
    // No interaction term in simpleEffects
    expect(res.simpleEffects.every((r) => !r.term.includes('×'))).toBe(true)
    expect(res.figurePng.length).toBeGreaterThan(1000)
  }, 900_000)
})
