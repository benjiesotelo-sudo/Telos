import { describe, it, expect } from 'vitest'
import { buildLogisticRegression } from './buildLogisticRegression'
import { LOGISTIC_REGRESSION } from '../registry/logisticRegression'
import type { LogisticResult } from '../stats/logisticRegression'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned numbers (regression.csv logistic — passed ~ pre_score + age + group, event="yes").
// New GOF rows native-R 4.6.0 verified on that fixture: logLik=−22.954340, BIC=60.664196 (AIC=53.908685, n=40).
const res: LogisticResult = { outcome: 'passed', event: 'yes', reportOR: true,
  m2ll: 45.908685210, logLik: -22.954342605, aic: 53.908685210, bic: 60.664203027, nagelkerke: 0.283002870,
  omnibusChisq: 9.543089235, omnibusDf: 3, omnibusP: 0.022877354,
  terms: [
    { term: '(Intercept)', b: -6.593371937, se: 2.919607358, z: -2.258307755, p: 0.023926479, or: 0.001369415, orLow: 2.097886128e-6, orHigh: 0.243330545 },
    { term: 'pre_score', b: 0.079190519, se: 0.037506735, z: 2.111367978, p: 0.034740695, or: 1.082410522, orLow: 1.012732368, orHigh: 1.176927471 },
    { term: 'age', b: 0.031993651, se: 0.027187081, z: 1.176796110, p: 0.239276896, or: 1.032510950, orLow: 0.980657994, orHigh: 1.093010423 },
    { term: 'group: b', b: 1.240356431, se: 0.724147424, z: 1.712850712, p: 0.086740008, or: 3.456845371, orLow: 0.866707308, orHigh: 15.442995620 },
  ],
  levels: ['no', 'yes'], classCounts: [[13, 7], [7, 13]], pctCorrect: [65, 65], auc: 0.76,
  ciLevel: 0.95, alpha: 0.05, n: 40, nExcluded: 0, figRocPng: png }

describe('buildLogisticRegression', () => {
  it('Table 1 (coef, SHAPE A): per term a coef row (B | OR) then a muted (SE) | [ORlo, ORhi] row, a rule, then the 6 glm GOF rows', () => {
    const c = buildLogisticRegression(LOGISTIC_REGRESSION, res)
    expect(c.tables).toHaveLength(2) // coef + classification (Model fit merged in; ROC stays a figure)
    expect(c.tables[0].rows).toEqual([
      // Intercept OR rounds to 0.00 with f() — fOr fallback shows '< 0.01' (finding #1 fix).
      { _kind: 'coef', term: '(Intercept)', b: '−6.59', or: '< 0.01' },
      { _kind: 'se', term: '', b: '(2.92)', or: '[< 0.01, 0.24]' },
      { _kind: 'coef', term: 'pre_score', b: '0.08', or: '1.08' },
      { _kind: 'se', term: '', b: '(0.04)', or: '[1.01, 1.18]' },
      { _kind: 'coef', term: 'age', b: '0.03', or: '1.03' },
      { _kind: 'se', term: '', b: '(0.03)', or: '[0.98, 1.09]' },
      { _kind: 'coef', term: 'group: b', b: '1.24', or: '3.46' },
      { _kind: 'se', term: '', b: '(0.72)', or: '[0.87, 15.44]' },
      { _kind: 'rule' },
      { _kind: 'gof', term: 'Num.Obs.', b: '40' },
      { _kind: 'gof', term: 'Nagelkerke R²', b: '0.28' },
      { _kind: 'gof', term: 'Omnibus χ²', b: '9.54 (p .023)' },
      { _kind: 'gof', term: 'Log.Lik.', b: '−22.95' },
      { _kind: 'gof', term: 'AIC', b: '53.91' },
      { _kind: 'gof', term: 'BIC', b: '60.66' },
    ])
    expect(c.note).toBeNull()
  })
  it('report-OR OFF → em-dash OR column on coef + (SE) rows (B/SE keep filling), AND em-dash APA slots (R1 + recorded decision 4)', () => {
    const c = buildLogisticRegression(LOGISTIC_REGRESSION, { ...res, reportOR: false })
    expect(c.tables[0].rows[2]).toEqual({ _kind: 'coef', term: 'pre_score', b: '0.08', or: '—' })
    expect(c.tables[0].rows[3]).toEqual({ _kind: 'se', term: '', b: '(0.04)', or: '—' })
    expect(c.apa).toBe('Predictor pre_score was associated with the outcome, OR=—, 95% CI [—, —], p = .035 (AUC=.76).')
  })
  it('Table 2 classification: real level names as headers, rows = predicted levels, 1 dp % correct (convention 7/8)', () => {
    const c = buildLogisticRegression(LOGISTIC_REGRESSION, res)
    expect(c.tables[1].spec.columns.map((x) => x.label)).toEqual(['Predicted \\ Observed', 'no', 'yes', '% correct'])
    expect(c.tables[1].rows).toEqual([
      { pred: 'no', c0: 13, c1: 7, pct: '65.0%' },
      { pred: 'yes', c0: 7, c1: 13, pct: '65.0%' },
    ])
  })
  it('APA: spaced p (policy 3), AUC drops leading zero (policy 3), Predictor X = first non-intercept row', () => {
    expect(buildLogisticRegression(LOGISTIC_REGRESSION, res).apa)
      .toBe('Predictor pre_score was associated with the outcome, OR=1.08, 95% CI [1.01, 1.18], p = .035 (AUC=.76).')
  })
  it('how-to-read points inference at the OR CI + inline omnibus χ², never the (non-existent) z column (D1 report-only)', () => {
    const h = buildLogisticRegression(LOGISTIC_REGRESSION, res).howToRead
    expect(h).toContain('OR confidence interval excludes 1')
    expect(h).toContain('omnibus χ²')
    expect(h).not.toMatch(/z column|z = B\/SE/)
  })
})
