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
