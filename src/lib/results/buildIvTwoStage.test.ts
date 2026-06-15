import { describe, it, expect } from 'vitest'
import { buildIvTwoStage } from './buildIvTwoStage'
import { IV_TWO_STAGE } from '../registry/ivTwoStage'
import type { IvResult } from '../stats/ivTwoStage'

const mock = (over: Partial<IvResult> = {}): IvResult => ({
  firstStage: [{ instrument: 'educ_iv', coef: 1.156964, se: 0.05525, partialF: 438.5002, p: 1e-50 }],
  coefRows: [
    { term: '(Intercept)', b: 202.740458, se: 4.100799, t: 49.44, p: 1e-30, ciLow: 194.653358, ciHigh: 210.827558 },
    { term: 'educ', b: 7.821416, se: 0.28434, t: 27.507249, p: 1e-30, ciLow: 7.260675, ciHigh: 8.382158 },
    { term: 'exper', b: -0.020553, se: 0.058179, t: -0.353272, p: 0.724262, ciLow: -0.135288, ciHigh: 0.094181 },
  ],
  weakF: 438.5002, weakP: 1e-50, wuF: 1022.7501, wuP: 1e-50, sargan: null, sarganP: null,
  endogenous: ['educ'], seType: 'robust', ciLevel: 0.95, alpha: 0.05, nObs: 200, nExcluded: 0,
  figCoefPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildIvTwoStage', () => {
  it('first-stage + 2SLS tables', () => {
    const c = buildIvTwoStage(IV_TWO_STAGE, mock())
    expect(c.tables[0].rows[0]).toEqual({ instrument: 'educ_iv', coef: '1.16', se: '0.06', partialF: '438.50', p: '<.001' })
    expect(c.tables[1].rows[1]).toEqual({ term: 'educ', b: '7.82', se: '0.28', t: '27.51', p: '<.001', ci: '[7.26, 8.38]' })
  })
  it('APA is softened — "the 2SLS estimate for X was B", no causal "had an effect"', () => {
    const apa = buildIvTwoStage(IV_TWO_STAGE, mock()).apa
    expect(apa).toBe('The 2SLS estimate for educ was B = 7.82, p < .001 (first-stage F = 438.50).')
    expect(apa).not.toContain('had an effect')
  })
  it('§2.8 diagnostics note surfaces weak-IV, Wu–Hausman, and Sargan (NA when just-identified)', () => {
    const note = buildIvTwoStage(IV_TWO_STAGE, mock()).note!.text
    expect(note).toContain('weak instruments: F = 438.50')
    expect(note).toContain('Wu–Hausman endogeneity: F = 1022.75')
    expect(note).toContain('just-identified')
  })
})
