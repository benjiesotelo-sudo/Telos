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
  matchedN: 134, nT: 67, nC: 67, ciLevel: 0.95, alpha: 0.05, nExcluded: 0,
  treatedDropped: 0, controlDropped: 66,
  psTreatedLo: 0.107052, psTreatedHi: 0.798391, psControlLo: 0.033303, psControlHi: 0.776950,
  figLovePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildPropensityScoreMatching', () => {
  it('balance table (pre/post SMD + variance ratio)', () => {
    expect(buildPropensityScoreMatching(PROPENSITY_SCORE_MATCHING, mock()).tables[0].rows[2])
      .toEqual({ covariate: 'ability', smdPre: '1.36', smdPost: '0.37', varRatio: '1.30' })
  })
  it('ATT coef table: one stacked term (est/(SE)/[CI], z/p drop) + matched-N footer (no R²/AIC) + common-support spans', () => {
    const rows = buildPropensityScoreMatching(PROPENSITY_SCORE_MATCHING, mock()).tables[1].rows
    expect(rows).toEqual([
      { _kind: 'coef', term: 'Treatment (ATT)', est: '5.87' },
      { _kind: 'se', term: '', est: '(0.23)' },
      { _kind: 'ci', term: '', est: '[5.42, 6.32]' },
      { _kind: 'rule' },
      { _kind: 'gof', term: 'Num.Obs.', est: '134' },
      { _kind: 'gof', term: 'Treated (matched)', est: '67' },
      { _kind: 'gof', term: 'Control (matched)', est: '67' },
      { _kind: 'span', term: 'Common support: 0 treated unit(s) dropped (off common support)' },
      { _kind: 'span', term: 'Propensity overlap: treated [0.11, 0.80], control [0.03, 0.78]' },
    ])
  })
  it('common-support diagnostic NA-guards to em-dash when overlap info is missing', () => {
    const rows = buildPropensityScoreMatching(
      PROPENSITY_SCORE_MATCHING,
      mock({ treatedDropped: null, psTreatedLo: null, psTreatedHi: null, psControlLo: null, psControlHi: null }),
    ).tables[1].rows
    expect(rows).toContainEqual({ _kind: 'span', term: 'Common support: — treated unit(s) dropped (off common support)' })
    expect(rows).toContainEqual({ _kind: 'span', term: 'Propensity overlap: treated [—, —], control [—, —]' })
  })
  it('APA is neutralised — no hardcoded "all SMDs < .1" balance claim', () => {
    const apa = buildPropensityScoreMatching(PROPENSITY_SCORE_MATCHING, mock()).apa
    expect(apa).toBe('After propensity-score matching, the ATT was 5.87, 95% CI [5.42, 6.32], p < .001.')
    expect(apa).not.toContain('SMDs < .1')
  })
})
