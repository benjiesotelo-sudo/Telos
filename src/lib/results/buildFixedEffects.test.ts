import { describe, it, expect } from 'vitest'
import { buildFixedEffects } from './buildFixedEffects'
import { FIXED_EFFECTS } from '../registry/fixedEffects'
import type { FixedEffectsResult } from '../stats/fixedEffects'

const mock = (over: Partial<FixedEffectsResult> = {}): FixedEffectsResult => ({
  coefRows: [
    { term: 'leverage', b: -5.574297, se: 1.466992, t: -3.799815, p: 0.000279, ciLow: -8.493151, ciHigh: -2.655444 },
    { term: 'rd_spend', b: 1.888007, se: 0.743427, t: 2.539599, p: 0.01301, ciLow: 0.40882, ciHigh: 3.367193 },
    { term: 'size', b: 0.140074, se: 0.42702, t: 0.328027, p: 0.743738, ciLow: -0.709563, ciHigh: 0.989711 },
  ],
  withinR2: 0.9144979, adjR2: 0.8997198, fStat: 288.7818, fDf1: 3, fDf2: 81, fP: 3.86e-43,
  nObs: 96, nEntities: 12, poolF: 1.291747, poolP: 0.2442503,
  effect: 'entity', seType: 'clustered', ciLevel: 0.95, alpha: 0.05, nExcluded: 0,
  figCoefPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildFixedEffects', () => {
  it('stacks B / (clustered SE) / [CI] per term in the merged coef table', () => {
    const c = buildFixedEffects(FIXED_EFFECTS, mock())
    expect(c.tables).toHaveLength(1) // Coefficients + Model fit merged into one
    expect(c.tables[0].rows.slice(0, 3)).toEqual([
      { _kind: 'coef', term: 'leverage', est: '−5.57' },
      { _kind: 'se', term: '', est: '(1.47)' },
      { _kind: 'ci', term: '', est: '[−8.49, −2.66]' },
    ])
  })

  it('merges Model fit into the GOF footer (Num.Obs., N entities, within/adj-within R², F) — no AIC/BIC/Log.Lik', () => {
    const c = buildFixedEffects(FIXED_EFFECTS, mock())
    const rows = c.tables[0].rows
    expect(rows.find((x) => x._kind === 'rule')).toBeDefined()
    const gof = rows.filter((x) => x._kind === 'gof')
    expect(gof).toEqual([
      { _kind: 'gof', term: 'Num.Obs.', est: '96' },
      { _kind: 'gof', term: 'N entities', est: '12' },
      { _kind: 'gof', term: 'Within R²', est: '.91' },
      { _kind: 'gof', term: 'Adj. within R²', est: '.90' }, // audit fix: adj within R² is now surfaced
      // Theme-4: the overall model F renders as F(df1, df2) = stat, p — not a bare number (native-R: F(3, 81) = 288.78, p = 3.86e-43)
      { _kind: 'gof', term: 'F-test', est: 'F(3, 81) = 288.78, p < .001' },
    ])
  })

  it('renders the overall model F with its df and p in the GOF footer (Theme-4), em-dash NA when missing', () => {
    expect(buildFixedEffects(FIXED_EFFECTS, mock()).tables[0].rows
      .find((x) => x._kind === 'gof' && x.term === 'F-test')!.est)
      .toBe('F(3, 81) = 288.78, p < .001')
    // a larger (non-<.001) p uses the spaced "= .nnn" report-only form
    expect(buildFixedEffects(FIXED_EFFECTS, mock({ fP: 0.0123 })).tables[0].rows
      .find((x) => x._kind === 'gof' && x.term === 'F-test')!.est)
      .toBe('F(3, 81) = 288.78, p = .012')
    // guard: an NA F-statistic collapses the whole footer cell to an em-dash (no "F(NaN, …)")
    expect(buildFixedEffects(FIXED_EFFECTS, mock({ fStat: NaN })).tables[0].rows
      .find((x) => x._kind === 'gof' && x.term === 'F-test')!.est)
      .toBe('—')
  })

  it('APA is report-only (states the estimate, no verdict) and names the first predictor', () => {
    expect(buildFixedEffects(FIXED_EFFECTS, mock()).apa)
      .toBe('In a fixed-effects model, predictor leverage gave B=−5.57, p < .001 (clustered SE).')
  })

  it('threads the CI level into the note (no CI column header survives)', () => {
    expect(buildFixedEffects(FIXED_EFFECTS, mock({ ciLevel: 0.9 })).note!.text).toContain('the bracketed line is the 90% CI')
    expect(buildFixedEffects(FIXED_EFFECTS, mock()).note!.text).toContain('the bracketed line is the 95% CI')
  })

  it('renders the drawn within-variation note + the SE-type wording + the §2.8 poolability F + the α to how-to-read', () => {
    const c = buildFixedEffects(FIXED_EFFECTS, mock())
    expect(c.note!.text).toContain('time-invariant predictors are absorbed by the entity effects')
    expect(c.note!.text).toContain('Standard errors in parentheses are clustered by entity')
    expect(c.note!.text).toContain('poolability): F = 1.29, p = .244')
    expect(c.howToRead).toContain('Your significance threshold (α) is 0.05.')
  })

  it('reflects classical SEs in the note + APA when chosen (not hardcoded "clustered")', () => {
    const c = buildFixedEffects(FIXED_EFFECTS, mock({ seType: 'classical' }))
    expect(c.note!.text).toContain('Standard errors in parentheses are classical')
    expect(c.note!.text).not.toContain('clustered by entity')
    expect(c.apa).toContain('(classical SE)')
    expect(c.apa).not.toContain('(clustered SE)')
  })
})
