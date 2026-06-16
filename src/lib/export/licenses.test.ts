import { describe, it, expect } from 'vitest'
import { licensesText } from './licenses'

describe('licensesText', () => {
  const t = licensesText()
  it('credits the two OFL fonts', () => {
    expect(t).toContain('Crimson Pro')
    expect(t).toContain('Atkinson Hyperlegible')
    expect(t).toMatch(/Open Font License|OFL/)
  })
  it('credits the R / WebR runtime', () => {
    expect(t).toMatch(/WebR|webr/)
    expect(t).toContain('GPL')
  })
  it('credits the key emitted R packages (preloaded set + modelsummary/ggplot2)', () => {
    for (const pkg of ['modelsummary', 'ggplot2', 'plm', 'sandwich', 'lmtest', 'ivreg', 'rdrobust', 'MatchIt', 'forecast', 'tseries', 'urca', 'vars']) {
      expect(t).toContain(pkg)
    }
  })
  it('gives a URL for each credited item', () => {
    expect(t).toMatch(/https?:\/\//)
    expect(t).toContain('scripts.sil.org/OFL')
  })
})
