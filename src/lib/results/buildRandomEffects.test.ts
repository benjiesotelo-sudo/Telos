import { describe, it, expect } from 'vitest'
import { buildRandomEffects } from './buildRandomEffects'
import { RANDOM_EFFECTS } from '../registry/randomEffects'
import type { RandomEffectsResult } from '../stats/randomEffects'

const mock = (over: Partial<RandomEffectsResult> = {}): RandomEffectsResult => ({
  coefRows: [
    { term: '(Intercept)', b: -0.76547, se: 0.276531, t: -2.768113, p: 0.006818, ciLow: -1.314685, ciHigh: -0.216255 },
    { term: 'leverage', b: -4.053601, se: 1.289718, t: -3.143013, p: 0.002251, ciLow: -6.615093, ciHigh: -1.49211 },
    { term: 'rd_spend', b: 0.547641, se: 0.155511, t: 3.52156, p: 0.00067, ciLow: 0.238783, ciHigh: 0.856499 },
    { term: 'size', b: 0.956744, se: 0.047436, t: 20.169133, p: 1e-9, ciLow: 0.862532, ciHigh: 1.050956 },
  ],
  r2: 0.98005, adjR2: 0.9793994, nObs: 96, nEntities: 12,
  seType: 'clustered', ciLevel: 0.95, alpha: 0.05, nExcluded: 0,
  figCoefPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildRandomEffects', () => {
  it('renders coefficients (incl. intercept) + R²/Adj.R² model fit', () => {
    const c = buildRandomEffects(RANDOM_EFFECTS, mock())
    expect(c.tables[0].rows[0]).toEqual({ term: '(Intercept)', b: '−0.77', se: '0.28', t: '−2.77', p: '.007', ci: '[−1.31, −0.22]' })
    expect(c.tables[1].rows[0]).toEqual({ r2: '.98', adjR2: '.98', nObs: '96', nEntities: '12' })
  })
  it('APA names the first SLOPE (not the intercept), report-only', () => {
    expect(buildRandomEffects(RANDOM_EFFECTS, mock()).apa)
      .toBe('In a random-effects model, predictor leverage gave B=−4.05, p = .002.')
  })
  it('threads CI level into the coefficient header', () => {
    expect(buildRandomEffects(RANDOM_EFFECTS, mock({ ciLevel: 0.99 })).tables[0].spec.columns.find((c) => c.key === 'ci')!.label).toBe('99% CI')
  })
})
