import { describe, it, expect } from 'vitest'
import { buildIndependentTTest } from './buildIndependentTTest'
import { INDEPENDENT_T_TEST as spec } from '../registry/independentTTest'
import type { TTestResult } from '../stats/types'

const r: TTestResult = {
  groupStats: [
    { group: 'control', n: 6, mean: 70.33333, sd: 3.14113, se: 1.28236 },
    { group: 'treatment', n: 6, mean: 82.33333, sd: 3.77712, se: 1.54200 },
  ],
  contrast: 'control − treatment', test: 'welch',
  t: -5.98340, df: 9.67829, p: 0.00015, meanDiff: -12, ci: [-16.48886, -7.51114], cohensD: -3.45452,
  cohensDLow: -5.31539, cohensDHigh: -1.53292, // effectsize::cohens_d(score~group, ci=0.95, pooled_sd=FALSE) — Welch default; native R ≡ WebR
  levene: { F: null, p: null }, ciLevel: 0.95, alpha: 0.05, tails: 'two.sided', nExcluded: 0, figurePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
}

describe('buildIndependentTTest', () => {
  const c = buildIndependentTTest(spec, r)
  it('shapes both tables with the locked formatting', () => {
    expect(c.tables[0].rows[0]).toEqual({ group: 'control', n: 6, mean: '70.33', sd: '3.14', se: '1.28' })
    expect(c.tables[1].rows[0]).toMatchObject({ t: '−5.98', df: '9.68', p: '<.001', mdiff: '−12.00', ci: '[−16.49, −7.51]', d: '−3.45 [−5.32, −1.53]' })
  })
  it('renders the assumption note with em-dashes for the degenerate Levene, and capitalizes Welch', () => {
    expect(c.note).toEqual({ kind: 'assume', text: `${spec.assumptionNote} (Levene F=—, p=— · Welch test)` })
  })
  it('fills the APA sentence as a p-clause with 1-dp M/SD, spaced p-operator, and the d effect-size CI', () => {
    expect(c.apa).toContain('control (M=70.3, SD=3.1)')
    expect(c.apa).toContain('p < .001')
    expect(c.apa).toContain('d=−3.45 [−5.32, −1.53]')
  })
  it('carries the figure with its type for alt-text and export naming', () => {
    expect(c.figures).toHaveLength(1)
    expect(c.figures[0].type).toBe('boxplot')
  })
})
