import { describe, it, expect } from 'vitest'
import { buildSimpleLinearRegression } from './buildSimpleLinearRegression'
import { SIMPLE_LINEAR_REGRESSION } from '../registry/simpleLinearRegression'
import type { SimpleLinearResult } from '../stats/simpleLinearRegression'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned numbers (simple-linear.csv) — assertions below are their house-rendered 2dp forms.
const res: SimpleLinearResult = { outcome: 'post_score', predictor: 'pre_score',
  r2: 0.659416639, adjR2: 0.650453919, f: 73.573272020, df1: 1, df2: 38, p: 2.024931906e-10, sigma: 5.605309647,
  terms: [
    { term: '(Intercept)', b: 20.070279220, se: 4.539674859, beta: null, t: 4.421082972, p: 7.946544031e-5, ciLow: 10.880187930, ciHigh: 29.260370510 },
    { term: 'pre_score', b: 0.641817080, se: 0.074825777, beta: 0.812044727, t: 8.577486346, p: 2.024931906e-10, ciLow: 0.490340214, ciHigh: 0.793293946 },
  ],
  n: 40, nExcluded: 0, figFitPng: png, figResidualsPng: png }

describe('buildSimpleLinearRegression', () => {
  it('Table 1 = fit row (SE = sigma, convention 3); Table 2 = coefficient rows with blank intercept β', () => {
    const c = buildSimpleLinearRegression(SIMPLE_LINEAR_REGRESSION, res)
    expect(c.tables[0].rows).toEqual([{ r2: '0.66', adjR2: '0.65', f: '73.57', df1: '1', df2: '38', p: '<.001', se: '5.61' }])
    expect(c.tables[1].rows).toEqual([
      { term: '(Intercept)', b: '20.07', se: '4.54', beta: '', t: '4.42', p: '<.001', ci: '[10.88, 29.26]' },
      { term: 'pre_score', b: '0.64', se: '0.07', beta: '0.81', t: '8.58', p: '<.001', ci: '[0.49, 0.79]' },
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
