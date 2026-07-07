import { describe, it, expect } from 'vitest'
import { buildEfa } from './buildEfa'
import type { EfaResult } from '../stats/efa'
import { EFA } from '../registry/efa'

// Audit gap (2026-07-06 completeness audit, efa row): "p < .001" and "parallel analysis" were hardcoded
// in the APA sentence -- false when the run's own Bartlett p >= .001 or the retention method is Kaiser
// or a fixed factor count. The template now reads p/retention live off the run.
const base: EfaResult = {
  kmo: 0.87,
  bartlettChisq: 210.3,
  bartlettDf: 45,
  bartlettP: 0.0001,
  retain: 2,
  varianceExplained: [
    { factor: 'F1', eigenvalue: 3.1, pctVar: 31.0, cumPct: 31.0 },
    { factor: 'F2', eigenvalue: 2.4, pctVar: 24.0, cumPct: 55.0 },
  ],
  loadings: [{ item: 'i1', loadings: [0.7, 0.1], communality: 0.5 }],
  phi: [[1, 0.2], [0.2, 1]],
  figScreePng: new Uint8Array(),
  nCases: 200,
  rotation: 'oblimin',
  extraction: 'pa',
  retention: 'parallel',
}

describe('buildEfa — APA sentence reflects the run\'s actual Bartlett p and retention method', () => {
  it('renders "p < .001" and "parallel analysis" for a parallel-analysis run with p < .001 (the common case)', () => {
    const c = buildEfa(EFA, base)
    expect(c.apa).toContain('p < .001')
    expect(c.apa).toContain('with parallel analysis retained')
  })

  it('renders the actual p-value when Bartlett p >= .001 (never claims p < .001 falsely)', () => {
    const c = buildEfa(EFA, { ...base, bartlettP: 0.023 })
    expect(c.apa).toContain('p = .023')
    expect(c.apa).not.toContain('p < .001')
  })

  it('names the Kaiser rule when retention = kaiser (never claims "parallel analysis" when it was not run)', () => {
    const c = buildEfa(EFA, { ...base, retention: 'kaiser' })
    expect(c.apa).not.toContain('parallel analysis')
    expect(c.apa.toLowerCase()).toContain('kaiser')
  })

  it('names a fixed-factor criterion when retention = fixed', () => {
    const c = buildEfa(EFA, { ...base, retention: 'fixed' })
    expect(c.apa).not.toContain('parallel analysis')
    expect(c.apa).toContain('fixed')
  })

  it('every {token} in the template resolves to a live value (no literal braces survive)', () => {
    const c = buildEfa(EFA, base)
    expect(c.apa).not.toMatch(/\{[a-zA-Z]+\}/)
  })
})
