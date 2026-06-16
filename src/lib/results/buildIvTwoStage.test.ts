import { describe, it, expect } from 'vitest'
import { buildIvTwoStage } from './buildIvTwoStage'
import { IV_TWO_STAGE } from '../registry/ivTwoStage'
import type { IvResult } from '../stats/ivTwoStage'

// All values native-R verified: ivreg(.y ~ educ + exper | educ_iv + exper, causal.csv) + lm(.y ~ educ + exper), HC1.
const mock = (over: Partial<IvResult> = {}): IvResult => ({
  firstStage: [{ instrument: 'educ_iv', coef: 1.156964, se: 0.05525, partialF: 438.5002, p: 1e-50 }],
  coefRows: [
    { term: '(Intercept)', b: 202.740458, se: 4.100799, t: 49.44, p: 1e-30, ciLow: 194.653358, ciHigh: 210.827558,
      olsB: 178.904637, olsSe: 2.405887, olsCiLow: 174.160038, olsCiHigh: 183.649236 },
    { term: 'educ', b: 7.821416, se: 0.28434, t: 27.507249, p: 1e-30, ciLow: 7.260675, ciHigh: 8.382158,
      olsB: 9.568037, olsSe: 0.160186, olsCiLow: 9.252138, olsCiHigh: 9.883936 },
    { term: 'exper', b: -0.020553, se: 0.058179, t: -0.353272, p: 0.724262, ciLow: -0.135288, ciHigh: 0.094181,
      olsB: -0.015148, olsSe: 0.050005, olsCiLow: -0.113763, olsCiHigh: 0.083466 },
  ],
  weakF: 438.5002, weakP: 1e-50, wuF: 1022.7501, wuP: 1e-50, sargan: null, sarganP: null,
  structF: 373.4404, rmse: 6.666408,
  endogenous: ['educ'], seType: 'robust', ciLevel: 0.95, alpha: 0.05, nObs: 200, nExcluded: 0,
  figCoefPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildIvTwoStage', () => {
  it('first-stage (Table 1) stays a classic table, unchanged', () => {
    const c = buildIvTwoStage(IV_TWO_STAGE, mock())
    expect(c.tables[0].rows[0]).toEqual({ instrument: 'educ_iv', coef: '1.16', se: '0.06', partialF: '438.50', p: '<.001' })
  })
  it('2SLS table is SHAPE B — per term: coef {ols,iv} → muted (SE) → muted [CI]', () => {
    const rows = buildIvTwoStage(IV_TWO_STAGE, mock()).tables[1].rows
    // educ is the 2nd term → rows 3,4,5
    expect(rows[3]).toEqual({ _kind: 'coef', term: 'educ', ols: '9.57', iv: '7.82' })
    expect(rows[4]).toEqual({ _kind: 'se', term: '', ols: '(0.16)', iv: '(0.28)' })
    expect(rows[5]).toEqual({ _kind: 'ci', term: '', ols: '[9.25, 9.88]', iv: '[7.26, 8.38]' })
  })
  it('after the term rows: a rule, then the gof footer (Num.Obs/RMSE/F), then diagnostic span rows', () => {
    const rows = buildIvTwoStage(IV_TWO_STAGE, mock()).tables[1].rows
    expect(rows.find((x) => x._kind === 'rule')).toEqual({ _kind: 'rule' })
    const gof = rows.filter((x) => x._kind === 'gof')
    expect(gof).toEqual([
      { _kind: 'gof', term: 'Num.Obs.', iv: '200' },
      { _kind: 'gof', term: 'RMSE', iv: '6.67' },
      { _kind: 'gof', term: 'F', iv: '373.44' },
    ])
    const spans = rows.filter((x) => x._kind === 'span').map((x) => x.term)
    expect(spans[0]).toBe('Weak-instrument F = 438.50, p < .001 (rule of thumb: F > 10)')
    expect(spans[1]).toBe('Wu–Hausman = 1022.75, p < .001')
    expect(spans[2]).toBe('Sargan: — (just-identified)')
  })
  it('Sargan span shows the over-identification statistic when NOT just-identified', () => {
    const spans = buildIvTwoStage(IV_TWO_STAGE, mock({ sargan: 2.314, sarganP: 0.128 })).tables[1].rows
      .filter((x) => x._kind === 'span').map((x) => x.term)
    expect(spans[2]).toBe('Sargan: 2.31, p = .128')
  })
  it('APA is softened — "the 2SLS estimate for X was B", no causal "had an effect"', () => {
    const apa = buildIvTwoStage(IV_TWO_STAGE, mock()).apa
    expect(apa).toBe('The 2SLS estimate for educ was B=7.82, p < .001 (first-stage F=438.50).')
    expect(apa).not.toContain('had an effect')
  })
  it('note is the static descriptive tableNote, unchanged (live diagnostics now live in span rows)', () => {
    expect(buildIvTwoStage(IV_TWO_STAGE, mock()).note).toEqual(IV_TWO_STAGE.tableNote)
  })
})
