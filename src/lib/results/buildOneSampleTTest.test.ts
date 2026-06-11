import { describe, it, expect } from 'vitest'
import { buildOneSampleTTest } from './buildOneSampleTTest'
import { ONE_SAMPLE_T_TEST as spec } from '../registry/oneSampleTTest'
import type { OneSampleTTestResult } from '../stats/oneSampleTTest'

// Archived cross-verified numbers: post6 vs μ0 = 70 (the difference CI is already μ0-shifted by the stats module).
const r: OneSampleTTestResult = {
  variable: 'post_score', n: 6, mean: 82.33333, sd: 3.77712, se: 1.542,
  mu0: 70, t: 7.99825, df: 5, p: 0.000493, meanDiff: 12.33333, ci: [8.36948, 16.29718], cohensD: 3.26527,
  shapiro: { W: 0.96354, p: 0.84654 }, nExcluded: 2,
  figurePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
}

describe('buildOneSampleTTest', () => {
  const c = buildOneSampleTTest(spec, r)
  it("shapes both tables — Table 2's Test value cell shows the user's μ0", () => {
    expect(c.tables[0].rows[0]).toEqual({ variable: 'post_score', n: 6, mean: '82.33', sd: '3.78', se: '1.54' })
    expect(c.tables[1].rows[0]).toEqual({ mu0: '70', t: '8.00', df: '5', p: '<.001', mdiff: '12.33', ci: '[8.37, 16.30]', d: '3.27' })
  })
  it('appends the Shapiro-Wilk values to the assume note', () => {
    expect(c.note).toEqual({ kind: 'assume', text: `${spec.tableNote!.text} (Shapiro-Wilk W=0.96, p=.847)` })
  })
  it('fills the APA sentence as a p-clause with a 1-dp M', () => {
    expect(c.apa).toBe('A one-sample t-test showed M=82.3 differed from 70, t(5)=8.00, p<.001, d=3.27.')
  })
  it('carries the distribution figure with its type, plus the exclusion count', () => {
    expect(c.figures).toEqual([{ caption: 'Value vs. test value', type: 'distribution', png: r.figurePng }])
    expect(c.nExcluded).toBe(2)
    expect(c.howToRead).toBe(spec.howToRead)
  })
  it('branches: Shapiro null → em-dashes; p ≥ .001 stays a p= clause; negatives typeset U+2212', () => {
    // μ0 = 90 derivation pinned in native R: t = −4.971884, p = 0.004205, diff CI [−11.630515, −3.702818], d = −2.029763.
    const v = buildOneSampleTTest(spec, { ...r, mu0: 90, t: -4.971884, p: 0.004205, meanDiff: -7.66667, ci: [-11.630515, -3.702818], cohensD: -2.029763, shapiro: { W: null, p: null } })
    expect(v.note!.text).toBe(`${spec.tableNote!.text} (Shapiro-Wilk W=—, p=—)`)
    expect(v.tables[1].rows[0]).toEqual({ mu0: '90', t: '−4.97', df: '5', p: '.004', mdiff: '−7.67', ci: '[−11.63, −3.70]', d: '−2.03' })
    expect(v.apa).toBe('A one-sample t-test showed M=82.3 differed from 90, t(5)=−4.97, p=.004, d=−2.03.')
  })
})
