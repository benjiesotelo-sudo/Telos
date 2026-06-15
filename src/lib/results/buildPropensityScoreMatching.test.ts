import { describe, it, expect } from 'vitest'
import { buildPropensityScoreMatching } from './buildPropensityScoreMatching'
import { PROPENSITY_SCORE_MATCHING } from '../registry/propensityScoreMatching'
import type { PsmResult } from '../stats/propensityScoreMatching'

const mock = (over: Partial<PsmResult> = {}): PsmResult => ({
  balance: [
    { covariate: 'exper', smdPre: -0.03963, smdPost: -0.001786, varRatio: 1.017459 },
    { covariate: 'age', smdPre: 0.128428, smdPost: 0.069082, varRatio: 0.92852 },
    { covariate: 'ability', smdPre: 1.358679, smdPost: 0.373121, varRatio: 1.298281 },
  ],
  attB: 5.868657, attSe: 0.2277397, attT: 25.76915, attP: 2.37e-53, attLo: 5.418165, attHi: 6.319148,
  matchedN: 134, ciLevel: 0.95, alpha: 0.05, nExcluded: 0,
  figLovePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildPropensityScoreMatching', () => {
  it('balance table (pre/post SMD + variance ratio)', () => {
    expect(buildPropensityScoreMatching(PROPENSITY_SCORE_MATCHING, mock()).tables[0].rows[2])
      .toEqual({ covariate: 'ability', smdPre: '1.36', smdPost: '0.37', varRatio: '1.30' })
  })
  it('ATT table with threaded CI', () => {
    const c = buildPropensityScoreMatching(PROPENSITY_SCORE_MATCHING, mock())
    expect(c.tables[1].rows[0]).toEqual({ estimate: '5.87', se: '0.23', t: '25.77', p: '<.001', ci: '[5.42, 6.32]' })
  })
  it('APA is neutralised — no hardcoded "all SMDs < .1" balance claim', () => {
    const apa = buildPropensityScoreMatching(PROPENSITY_SCORE_MATCHING, mock()).apa
    expect(apa).toBe('After propensity-score matching, the ATT was 5.87, 95% CI [5.42, 6.32], p < .001.')
    expect(apa).not.toContain('SMDs < .1')
  })
})
