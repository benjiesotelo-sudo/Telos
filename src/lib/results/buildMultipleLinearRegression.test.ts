import { describe, it, expect } from 'vitest'
import { buildMultipleLinearRegression } from './buildMultipleLinearRegression'
import { MULTIPLE_LINEAR_REGRESSION } from '../registry/multipleLinearRegression'
import type { MultipleLinearResult } from '../stats/multipleLinearRegression'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned numbers (lm(post_score ~ pre_score + age + group + method) on regression.csv = loadRegressionFixture).
// The four GOF additions are native-R 4.6.0 verified on that fixture+model: RMSE=4.678702977, AIC=250.9567571, BIC=262.7789132, logLik=−118.4783785.
const res: MultipleLinearResult = { outcome: 'post_score', standardize: false,
  r2: 0.750223512, adjR2: 0.713491675, f: 20.424339860, df1: 5, df2: 34, p: 2.245462388e-9,
  rmse: 4.678702977, aic: 250.9567571, bic: 262.7789132, logLik: -118.4783785,
  terms: [
    { term: '(Intercept)', b: 20.361340940, se: 6.030400820, beta: null, t: 3.376449021, p: 0.001851288, ciLow: 8.106091987, ciHigh: 32.616589900, vif: null },
    { term: 'pre_score', b: 0.612871402, se: 0.075712457, beta: 0.775421855, t: 8.094723475, p: 1.941055777e-9, ciLow: 0.459005177, ciHigh: 0.766737627, vif: 1.249106308 },
    { term: 'age', b: 0.018242579, se: 0.067402312, beta: 0.027593357, t: 0.270652118, p: 0.788294904, ciLow: -0.118735401, ciHigh: 0.155220558, vif: 1.414860417 },
    { term: 'group: b', b: 5.353172626, se: 1.642693905, beta: 0.564629882, t: 3.258776701, p: 0.002542392, ciLow: 2.014816956, ciHigh: 8.691528296, vif: 1.037328861 },
    { term: 'method: online', b: -2.049172535, se: 2.021575603, beta: -0.216138004, t: -1.013651199, p: 0.317908726, ciLow: -6.157508455, ciHigh: 2.059163385, vif: 1.247536921 },
    { term: 'method: workshop', b: -3.247840455, se: 2.272989373, beta: -0.342568398, t: -1.428885016, p: 0.162160847, ciLow: -7.867110628, ciHigh: 1.371429717, vif: 1.247536921 },
  ],
  ciLevel: 0.95, alpha: 0.05, n: 40, nExcluded: 0, figResidualsPng: png, figCoefPlotPng: png }

describe('buildMultipleLinearRegression', () => {
  it('one coef table: stacked B/(SE)/[CI] per term with β+VIF on the estimate row; intercept β/VIF blank; standardize OFF → β em-dash; a rule; the 8 GOF rows', () => {
    const c = buildMultipleLinearRegression(MULTIPLE_LINEAR_REGRESSION, res)
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].rows).toEqual([
      { _kind: 'coef', term: '(Intercept)', est: '20.36', beta: '', vif: '' },
      { _kind: 'se', term: '', est: '(6.03)', beta: '', vif: '' },
      { _kind: 'ci', term: '', est: '[8.11, 32.62]', beta: '', vif: '' },
      { _kind: 'coef', term: 'pre_score', est: '0.61', beta: '—', vif: '1.25' },
      { _kind: 'se', term: '', est: '(0.08)', beta: '', vif: '' },
      { _kind: 'ci', term: '', est: '[0.46, 0.77]', beta: '', vif: '' },
      { _kind: 'coef', term: 'age', est: '0.02', beta: '—', vif: '1.41' },
      { _kind: 'se', term: '', est: '(0.07)', beta: '', vif: '' },
      { _kind: 'ci', term: '', est: '[−0.12, 0.16]', beta: '', vif: '' },
      { _kind: 'coef', term: 'group: b', est: '5.35', beta: '—', vif: '1.04' },
      { _kind: 'se', term: '', est: '(1.64)', beta: '', vif: '' },
      { _kind: 'ci', term: '', est: '[2.01, 8.69]', beta: '', vif: '' },
      { _kind: 'coef', term: 'method: online', est: '−2.05', beta: '—', vif: '1.25' },
      { _kind: 'se', term: '', est: '(2.02)', beta: '', vif: '' },
      { _kind: 'ci', term: '', est: '[−6.16, 2.06]', beta: '', vif: '' },
      { _kind: 'coef', term: 'method: workshop', est: '−3.25', beta: '—', vif: '1.25' },
      { _kind: 'se', term: '', est: '(2.27)', beta: '', vif: '' },
      { _kind: 'ci', term: '', est: '[−7.87, 1.37]', beta: '', vif: '' },
      { _kind: 'rule' },
      { _kind: 'gof', term: 'Num.Obs.', est: '40' },
      { _kind: 'gof', term: 'R²', est: '0.75' },
      { _kind: 'gof', term: 'R² Adj.', est: '0.71' },
      { _kind: 'gof', term: 'F', est: '20.42' },
      { _kind: 'gof', term: 'RMSE', est: '4.68' },
      { _kind: 'gof', term: 'AIC', est: '250.96' },
      { _kind: 'gof', term: 'BIC', est: '262.78' },
      { _kind: 'gof', term: 'Log.Lik.', est: '−118.48' },
    ])
    expect(c.note).toEqual(MULTIPLE_LINEAR_REGRESSION.tableNote)
  })
  it('standardize ON → β fills on the estimate rows (R1); intercept β stays blank', () => {
    const c = buildMultipleLinearRegression(MULTIPLE_LINEAR_REGRESSION, { ...res, standardize: true })
    expect(c.tables[0].rows.filter((row) => row._kind === 'coef').map((row) => row.beta))
      .toEqual(['', '0.78', '0.03', '0.56', '−0.22', '−0.34'])
  })
  it('k = 1 (vif null) → predictor VIF cells em-dash', () => {
    const one = { ...res, terms: res.terms.slice(0, 2).map((t) => ({ ...t, vif: null })) }
    const c = buildMultipleLinearRegression(MULTIPLE_LINEAR_REGRESSION, one)
    expect(c.tables[0].rows.filter((row) => row._kind === 'coef').map((row) => row.vif)).toEqual(['', '—'])
  })
  it('#11: emits both figures in card order — residual diagnostics, then coefficient plot', () => {
    const c = buildMultipleLinearRegression(MULTIPLE_LINEAR_REGRESSION, res)
    expect(c.figures.map((g) => g.file)).toEqual(['residuals', 'coefficient-plot'])
    expect(c.figures.map((g) => g.caption)).toEqual(['Residual diagnostics', 'Coefficient plot'])
    expect(c.figures.every((g) => g.png === png)).toBe(true)
  })
  it('APA: card-literal wording, predictor X = first coefficient row (recorded decision 3)', () => {
    expect(buildMultipleLinearRegression(MULTIPLE_LINEAR_REGRESSION, res).apa)
      .toBe('The model explained R²=.75 of the variance, F(5,34)=20.42, p < .001; predictor pre_score gave B=0.61, p < .001.')
  })
})
