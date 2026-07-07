// Audit fix (U8-T4 fix round): regression coverage for the unicode-minus parsing bug. Display strings
// format negatives with U+2212 (format/apa.ts's `minus`), which plain Number() cannot parse -
// Number('−0.32') is NaN. Before the fix, pearson's and spearman's magnitude ternary fell through to
// 'large' (and the sign check always read 'negative') for every negative r/rho, regardless of true
// magnitude or sign. These tests use the real U+2212 character, as the app's own formatters produce.
import { describe, it, expect } from 'vitest'
import { EXPLAINERS } from './explainers'

describe('explainers - unicode-minus display-value parsing (audit fix)', () => {
  it('spearman: a medium negative rho ("−0.32") is classified medium, not large', () => {
    const rho = EXPLAINERS.spearman.find((e) => e.key === 'rho')!
    const text = rho.interpret({ rho: '−0.32', rhoLow: '−0.50', rhoHigh: '−0.10' })
    expect(text).toContain('medium')
    expect(text).not.toContain('large')
    expect(text).toContain('negative')
  })

  it('pearson: a medium negative r ("−0.32") is classified medium, not large', () => {
    const r = EXPLAINERS.pearson.find((e) => e.key === 'r')!
    const text = r.interpret({ df: 18, r: '−0.32', ciLow: '−0.60', ciHigh: '−0.05' })
    expect(text).toContain('medium')
    expect(text).not.toContain('large')
    expect(text).toContain('negative')
  })

  it('pearson: a genuinely large negative r ("−0.72") still reports large', () => {
    const r = EXPLAINERS.pearson.find((e) => e.key === 'r')!
    const text = r.interpret({ df: 18, r: '−0.72', ciLow: '−0.85', ciHigh: '−0.50' })
    expect(text).toContain('large')
    expect(text).toContain('negative')
  })

  it('pearson/spearman: a positive value still reports "positive"', () => {
    const r = EXPLAINERS.pearson.find((e) => e.key === 'r')!
    expect(r.interpret({ df: 18, r: '.32', ciLow: '.05', ciHigh: '.60' })).toContain('positive')
  })
})
