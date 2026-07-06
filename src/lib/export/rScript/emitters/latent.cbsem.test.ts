import { describe, it, expect } from 'vitest'
import { latentEmitters, latentPackages } from './latent'
import type { TestSetup } from '../../../../state/session'

const SETUP: TestSetup = {
  roles: {},
  options: { estimator: 'ML', nboot: 5000, ciType: 'percentile' },
  props: {},
  blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
    { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
    { id: 3, name: 'dem65', items: ['y5', 'y6', 'y7', 'y8'] },
  ],
  paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }],
}

describe("latentEmitters['cb-sem']", () => {
  const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, SETUP, { columns: [], rows: [] } as never)

  it('builds the lavaan measurement + structural + indirect model', () => {
    expect(r).toContain('ind60 =~ x1 + x2 + x3')
    expect(r).toContain('dem60 =~ y1 + y2 + y3 + y4')
    expect(r).toContain('dem65 ~ ') // dem65 regressed on dem60 + ind60
    expect(r).toContain(':=')        // auto indirect def for ind60 -> dem60 -> dem65
  })

  it('uses lavaan::sem with bootstrap percentile CI and gc() around it', () => {
    expect(r).toContain('lavaan::sem(')
    expect(r).toContain('se = "bootstrap"')
    expect(r).toContain('bootstrap = 5000')
    expect(r).toContain('boot.ci.type = "perc"')
    expect(r).toMatch(/gc\(\)/)
  })

  it('suppresses the fit table when df==0 (shared predicate inline)', () => {
    expect(r).toContain('fitMeasures(fit, "df")')
    expect(r).toContain('== 0') // saturation branch keyed strictly on df==0
  })

  it('draws the diagram via semPlot::semPaths', () => {
    expect(r).toContain('semPlot::semPaths(')
  })

  it('registers its packages', () => {
    expect(latentPackages['cb-sem']).toEqual(
      expect.arrayContaining(['lavaan', 'semTools', 'psych', 'semPlot']),
    )
  })
})

describe("latentEmitters['cb-sem'] — construct names with spaces", () => {
  // Display names with spaces are illegal lavaan `=~`/`~` tokens; the emitter must emit the SAME
  // sanitized identifiers the app runner uses (export ≡ app), never the raw display names.
  const SPACED_SETUP: TestSetup = {
    ...SETUP,
    constructs: [
      { id: 1, name: 'Industrialization 1960', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'Democracy 1960', items: ['y1', 'y2', 'y3', 'y4'] },
      { id: 3, name: 'Democracy 1965', items: ['y5', 'y6', 'y7', 'y8'] },
    ],
  }
  const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, SPACED_SETUP, { columns: [], rows: [] } as never)

  it('emits sanitized latent identifiers in the lavaan model', () => {
    expect(r).toContain('Industrialization_1960 =~ x1 + x2 + x3')
    expect(r).toContain('Democracy_1960 =~ y1 + y2 + y3 + y4')
    expect(r).toContain('Democracy_1960 ~ p_1_2*Industrialization_1960')
    expect(r).toContain('Democracy_1965 ~ p_2_3*Democracy_1960 + p_1_3*Industrialization_1960')
  })

  it('never emits a raw spaced name into the model string', () => {
    expect(r).not.toContain('Industrialization 1960 =~')
    expect(r).not.toContain('Democracy 1960 ~')
    expect(r).not.toContain('*Industrialization 1960')
  })
})

describe("latentEmitters['ave'] / ['composite-reliability'] — construct names with spaces", () => {
  const SPACED_CFA: TestSetup = {
    roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent',
    constructs: [
      { id: 1, name: 'Visual Perception', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'Verbal Ability', items: ['x4', 'x5', 'x6'] },
    ],
    paths: [],
  }

  it('ave emits sanitized names in the model AND the construct_names indexing vector', () => {
    const r = latentEmitters['ave']({ id: 'ave' } as never, SPACED_CFA, { columns: [], rows: [] } as never)
    expect(r).toContain('Visual_Perception =~ x1 + x2 + x3')
    expect(r).toContain('construct_names <- c("Visual_Perception", "Verbal_Ability")')
    expect(r).not.toContain('Visual Perception =~')
  })

  it('composite-reliability emits sanitized names in the model AND the construct_names indexing vector', () => {
    const r = latentEmitters['composite-reliability'](
      { id: 'composite-reliability' } as never, SPACED_CFA, { columns: [], rows: [] } as never)
    expect(r).toContain('Visual_Perception =~ x1 + x2 + x3')
    expect(r).toContain('construct_names <- c("Visual_Perception", "Verbal_Ability")')
    expect(r).not.toContain('Visual Perception =~')
  })
})
