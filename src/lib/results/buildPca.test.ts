import { describe, it, expect } from 'vitest'
import { buildPca } from './buildPca'
import type { PcaResult } from '../stats/pca'
import { PCA } from '../registry/pca'

// Audit gap (2026-07-06 completeness audit, pca row): "correlation matrix; parallel analysis" was
// hardcoded in the APA sentence -- wrong when standardize is off (covariance matrix) or retention isn't
// parallel analysis. The template now reads both live off the run.
const base: PcaResult = {
  retain: 2,
  varianceExplained: [
    { component: 'PC1', eigenvalue: 2.1, pctVar: 42.0, cumPct: 42.0 },
    { component: 'PC2', eigenvalue: 1.3, pctVar: 26.0, cumPct: 68.0 },
  ],
  loadings: [{ variable: 'x1', loadings: [0.8, 0.1] }],
  figScreePng: new Uint8Array(),
  nCases: 150,
  standardize: true,
  retention: 'parallel',
}

describe('buildPca — APA sentence reflects the actual matrix type + retention method', () => {
  it('names the correlation matrix + parallel analysis for the default (standardize on, retention parallel)', () => {
    const c = buildPca(PCA, base)
    expect(c.apa).toContain('correlation matrix')
    expect(c.apa).toContain('parallel analysis')
  })

  it('names the covariance matrix when standardize is off', () => {
    const c = buildPca(PCA, { ...base, standardize: false })
    expect(c.apa).toContain('covariance matrix')
    expect(c.apa).not.toContain('correlation matrix')
  })

  it('names the Kaiser rule when retention = kaiser', () => {
    const c = buildPca(PCA, { ...base, retention: 'kaiser' })
    expect(c.apa).not.toContain('parallel analysis')
    expect(c.apa.toLowerCase()).toContain('kaiser')
  })

  it('names a fixed-component criterion when retention = fixed', () => {
    const c = buildPca(PCA, { ...base, retention: 'fixed' })
    expect(c.apa).not.toContain('parallel analysis')
    expect(c.apa).toContain('fixed')
  })

  it('every {token} in the template resolves to a live value (no literal braces survive)', () => {
    const c = buildPca(PCA, base)
    expect(c.apa).not.toMatch(/\{[a-zA-Z]+\}/)
  })
})
