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
  it('credits the key emitted R packages (union of every emitter package record)', () => {
    // sampled from the union of regression/group/assocDesc *Packages maps; MASS is the
    // glm.nb dependency that was previously uncredited
    for (const pkg of ['modelsummary', 'ggplot2', 'plm', 'sandwich', 'lmtest', 'ivreg', 'rdrobust', 'MatchIt', 'MASS', 'forecast', 'tseries', 'vars']) {
      expect(t).toContain(pkg)
    }
  })
  it('does not credit urca — no emitter installs or references it', () => {
    expect(t).not.toContain('urca')
  })
  it('gives a URL for each credited item', () => {
    expect(t).toMatch(/https?:\/\//)
    expect(t).toContain('scripts.sil.org/OFL')
  })
})
