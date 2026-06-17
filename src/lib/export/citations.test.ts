import { describe, it, expect } from 'vitest'
import { citationsText } from './citations'

describe('citationsText', () => {
  const t = citationsText()
  it('cites the R version', () => {
    expect(t).toContain('R 4.6.0')
  })
  it('states APA-7 formatting + per-package method references', () => {
    expect(t).toContain('APA-7')
    expect(t).toMatch(/Tables are formatted per APA-7 \(7th ed\.\); econometric methods follow each package cited reference\./)
  })
  it('includes a citation()-style reference for key emitted packages', () => {
    // sampled from the union of every emitter *Packages map; modelsummary is now emitted (datasummary)
    for (const pkg of ['modelsummary', 'effectsize', 'plm', 'ggplot2', 'forecast', 'vars']) {
      expect(t).toContain(pkg)
    }
  })
  it('does not cite a package no emitter references', () => {
    expect(t).not.toContain('urca')
  })
})
