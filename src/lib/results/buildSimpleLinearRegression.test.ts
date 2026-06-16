import { describe, it, expect } from 'vitest'
import { buildSimpleLinearRegression } from './buildSimpleLinearRegression'
import { SIMPLE_LINEAR_REGRESSION } from '../registry/simpleLinearRegression'
import type { SimpleLinearResult } from '../stats/simpleLinearRegression'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned coefficients (regression.csv = loadRegressionFixture). The four GOF additions are native-R 4.6.0
// verified on that fixture: RMSE=5.463380, AIC=255.360495, BIC=260.427133, logLik=−124.680247.
const res: SimpleLinearResult = { outcome: 'post_score', predictor: 'pre_score',
  r2: 0.659416639, adjR2: 0.650453919, f: 73.573272020, df1: 1, df2: 38, p: 2.024931906e-10, sigma: 5.605309647,
  rmse: 5.463380, aic: 255.360495, bic: 260.427133, logLik: -124.680247,
  terms: [
    { term: '(Intercept)', b: 20.070279220, se: 4.539674859, beta: null, t: 4.421082972, p: 7.946544031e-5, ciLow: 10.880187930, ciHigh: 29.260370510 },
    { term: 'pre_score', b: 0.641817080, se: 0.074825777, beta: 0.812044727, t: 8.577486346, p: 2.024931906e-10, ciLow: 0.490340214, ciHigh: 0.793293946 },
  ],
  ciLevel: 0.95, alpha: 0.05, n: 40, nExcluded: 0, figFitPng: png, figResidualsPng: png }

describe('buildSimpleLinearRegression', () => {
  it('one coef table: stacked estimate/(SE)/[CI] per term (blank intercept β), a rule, then the 8 GOF rows', () => {
    const c = buildSimpleLinearRegression(SIMPLE_LINEAR_REGRESSION, res)
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].rows).toEqual([
      { _kind: 'coef', term: '(Intercept)', est: '20.07', beta: '' },
      { _kind: 'se', term: '', est: '(4.54)', beta: '' },
      { _kind: 'ci', term: '', est: '[10.88, 29.26]', beta: '' },
      { _kind: 'coef', term: 'pre_score', est: '0.64', beta: '0.81' },
      { _kind: 'se', term: '', est: '(0.07)', beta: '' },
      { _kind: 'ci', term: '', est: '[0.49, 0.79]', beta: '' },
      { _kind: 'rule' },
      { _kind: 'gof', term: 'Num.Obs.', est: '40' },
      { _kind: 'gof', term: 'R²', est: '0.66' },
      { _kind: 'gof', term: 'R² Adj.', est: '0.65' },
      { _kind: 'gof', term: 'F', est: '73.57' },
      { _kind: 'gof', term: 'RMSE', est: '5.46' },
      { _kind: 'gof', term: 'AIC', est: '255.36' },
      { _kind: 'gof', term: 'BIC', est: '260.43' },
      { _kind: 'gof', term: 'Log.Lik.', est: '−124.68' },
    ])
    expect(c.note).toEqual(SIMPLE_LINEAR_REGRESSION.tableNote)
  })
  it('two figures carry the fit/residuals file slugs in card order', () => {
    const c = buildSimpleLinearRegression(SIMPLE_LINEAR_REGRESSION, res)
    expect(c.figures.map((g) => g.file)).toEqual(['fit', 'residuals'])
  })
  it('APA fills from the predictor row; tiny p becomes p < .001; R² drops leading zero', () => {
    expect(buildSimpleLinearRegression(SIMPLE_LINEAR_REGRESSION, res).apa)
      .toBe('A simple linear regression gave B=0.64, t(38)=8.58, p < .001, R²=.66.')
  })
})
