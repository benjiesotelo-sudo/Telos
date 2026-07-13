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

// R3 (board-clearing T3): the stationarity 'test' selector subsets what ran, so the interpret()
// lines weave the stand-in test's own name and statistic symbol instead of hardcoding ADF/τ.
describe('explainers - stationarity stand-in follows the tests that ran (R3)', () => {
  const vBoth = { test: 'ADF, KPSS, PP', statistic: '−8.38', lag: '4', p: '< .010', conclusion: 'stationary', standIn: 'ADF', statLabel: 'τ' }
  const vKpss = { test: 'KPSS', statistic: '1.81', lag: '3', p: '< .010', conclusion: 'non-stationary', standIn: 'KPSS', statLabel: 'LM' }
  const ex = (key: string) => EXPLAINERS['stationarity-tests'].find((e) => e.key === key)!

  it("'both' keeps today's ADF-led wording byte for byte", () => {
    expect(ex('statistic').interpret(vBoth)).toBe('Here, the ADF statistic is τ = −8.38.')
    expect(ex('lag').interpret(vBoth)).toBe('Here, ADF used lag = 4.')
    expect(ex('p').interpret(vBoth)).toBe('Here, ADF gives p < .010.')
    expect(ex('conclusion').interpret(vBoth)).toBe('Here, the ADF row\'s conclusion is "stationary".')
  })

  it('KPSS-only run speaks about KPSS and its LM statistic, never ADF', () => {
    expect(ex('statistic').interpret(vKpss)).toBe('Here, the KPSS statistic is LM = 1.81.')
    expect(ex('lag').interpret(vKpss)).toBe('Here, KPSS used lag = 3.')
    expect(ex('p').interpret(vKpss)).toBe('Here, KPSS gives p < .010.')
    expect(ex('conclusion').interpret(vKpss)).toContain('KPSS')
    for (const k of ['statistic', 'lag', 'p', 'conclusion']) expect(ex(k).interpret(vKpss)).not.toContain('ADF')
  })
})
