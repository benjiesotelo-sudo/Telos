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
  it('renders the coefficient + model-fit tables faithfully', () => {
    const c = buildFixedEffects(FIXED_EFFECTS, mock())
    expect(c.tables[0].rows[0]).toEqual({ term: 'leverage', b: '−5.57', se: '1.47', t: '−3.80', p: '<.001', ci: '[−8.49, −2.66]' })
    expect(c.tables[1].rows[0]).toEqual({ withinR2: '.91', f: '288.78', nObs: '96', nEntities: '12' })
  })

  it('APA is report-only (states the estimate, no verdict) and names the first predictor', () => {
    expect(buildFixedEffects(FIXED_EFFECTS, mock()).apa)
      .toBe('In a fixed-effects model, predictor leverage gave B=−5.57, p < .001 (clustered SE).')
  })

  it('threads the CI level into the coefficient table header', () => {
    expect(buildFixedEffects(FIXED_EFFECTS, mock({ ciLevel: 0.9 })).tables[0].spec.columns.find((c) => c.key === 'ci')!.label).toBe('90% CI')
  })

  it('renders the drawn within-variation note + appends the §2.8 poolability F + the α to how-to-read', () => {
    const c = buildFixedEffects(FIXED_EFFECTS, mock())
    expect(c.note!.text).toContain('time-invariant predictors are absorbed by the entity effects')
    expect(c.note!.text).toContain('poolability): F = 1.29, p = .244')
    expect(c.howToRead).toContain('Your significance threshold (α) is 0.05.')
  })

  it('reflects classical SEs in the header + APA when chosen (not hardcoded "clustered")', () => {
    const c = buildFixedEffects(FIXED_EFFECTS, mock({ seType: 'classical' }))
    expect(c.tables[0].spec.columns.find((col) => col.key === 'se')!.label).toBe('SE')
    expect(c.apa).toContain('(classical SE)')
    expect(c.apa).not.toContain('(clustered SE)')
  })
})
