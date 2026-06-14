import { describe, it, expect } from 'vitest'
import { buildPairedTTest } from './buildPairedTTest'
import { PAIRED_T_TEST as spec } from '../registry/pairedTTest'
import type { PairedTTestResult } from '../stats/pairedTTest'

const r: PairedTTestResult = {
  conditions: [
    { condition: 'pre', n: 6, mean: 70.33333, sd: 3.14113 },
    { condition: 'post', n: 6, mean: 82.33333, sd: 3.77712 },
  ],
  pair: 'pre − post',
  t: -10.39230, df: 5, p: 0.000142, meanDiff: -12, ci: [-14.96825, -9.03175], dz: -4.24264,
  ciLevel: 0.95, alpha: 0.05, tails: 'two.sided', nExcluded: 2, figurePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
}

describe('buildPairedTTest', () => {
  const c = buildPairedTTest(spec, r)
  it('Table 1: one row per condition, 4 columns (no SE), 2-dp strings', () => {
    expect(c.tables[0].spec.id).toBe('paired-descriptives')
    expect(c.tables[0].rows).toEqual([
      { condition: 'pre', n: 6, mean: '70.33', sd: '3.14' },
      { condition: 'post', n: 6, mean: '82.33', sd: '3.78' },
    ])
  })
  it('Table 2: the pair row with M_diff, difference CI and d_z', () => {
    expect(c.tables[1].rows).toEqual([
      { pair: 'pre − post', t: '−10.39', df: '5', p: '<.001', mdiff: '−12.00', ci: '[−14.97, −9.03]', d: '−4.24' },
    ])
  })
  it('carries the card note verbatim and the excluded-pairs count', () => {
    expect(c.note).toEqual({ kind: 'assume', text: 'assumption check: normality of the difference scores.' })
    expect(c.nExcluded).toBe(2)
  })
  it('fills the APA sentence with the p-clause rule and 1-dp change', () => {
    expect(c.apa).toBe('A paired-samples t-test gave M=−12.0, t(5)=−10.39, p < .001, dz=−4.24.')
  })
  it('p ≥ .001 renders as p = … (the other p-clause branch)', () => {
    expect(buildPairedTTest(spec, { ...r, p: 0.042 }).apa).toContain('p = .042')
  })
  it('carries the figure with its type for alt-text and export naming', () => {
    expect(c.figures).toEqual([{ caption: 'Change per case', type: 'difference', png: r.figurePng }])
  })
})
