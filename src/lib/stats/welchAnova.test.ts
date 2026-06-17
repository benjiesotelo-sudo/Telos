import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { runWelchAnova } from './welchAnova'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe("Welch's ANOVA stats engine (spike known answers)", () => {
  it('matches native R 4.6.0 known answers', async () => {
    const res = await runWelchAnova(engine, loadAnovaFixture(), 'outcome', 'group')

    // Main test result
    expect(res.f).toBeCloseTo(2.57990466333335, 6)
    expect(res.df1).toBe(2)
    expect(res.df2).toBeCloseTo(37.9023295774865, 6)
    expect(res.p).toBeCloseTo(0.0890313047549131, 6)

    // Descriptives
    expect(res.desc).toHaveLength(3)
    expect(res.desc.find((d) => d.group === 'control')?.n).toBe(20)

    // Games-Howell post-hoc (rstatix rounds p.adj — assert rounded value)
    // diff = -(group2 − group1) = group1 − group2 to match pair label "control - drug_a"
    const gh = res.posthoc.find((x) => x.pair === 'control - drug_a')!
    expect(gh).toBeDefined()
    expect(gh.diff).toBeCloseTo(-1.37, 6)
    expect(gh.ciLo).toBeCloseTo(-6.9179984409316, 6)
    expect(gh.ciHi).toBeCloseTo(4.1779984409316, 6)
    expect(gh.pAdj).toBeCloseTo(0.82, 2) // rstatix returns rounded p.adj

    // Within-group normality: Shapiro-Wilk per group (native R 4.6.0 on anova.csv outcome ~ group)
    expect(res.shapiro).toHaveLength(3)
    const shControl = res.shapiro.find((s) => s.group === 'control')!
    expect(shControl.W!).toBeCloseTo(0.9668813597, 6)
    expect(shControl.p!).toBeCloseTo(0.6881436515, 6)
    const shDrugA = res.shapiro.find((s) => s.group === 'drug_a')!
    expect(shDrugA.W!).toBeCloseTo(0.9046305145, 6)
    expect(shDrugA.p!).toBeCloseTo(0.0504050340, 6)
    const shDrugB = res.shapiro.find((s) => s.group === 'drug_b')!
    expect(shDrugB.W!).toBeCloseTo(0.9228936756, 6)
    expect(shDrugB.p!).toBeCloseTo(0.1126539309, 6)

    // Listwise
    expect(res.nExcluded).toBe(0)

    // Figure rendered
    expect(res.figurePng.length).toBeGreaterThan(1000)
  }, 900_000)
})
