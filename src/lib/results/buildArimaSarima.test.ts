import { describe, it, expect } from 'vitest'
import { buildArimaSarima } from './buildArimaSarima'
import { ARIMA_SARIMA } from '../registry/arimaSarima'
import type { ArimaSarimaResult } from '../stats/arimaSarima'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// Pinned from the stats spike: R built-in `lh` (n=48) → auto.arima = ARIMA(1,0,0).
// Native R 4.6.0 verified: ar1=0.5739296 (SE 0.1161393, CI [0.3463007,0.8015585]);
// intercept=2.413288 (SE 0.1466135, CI [2.1259308,2.7006451]); AIC 64.758325, BIC 70.371928,
// logLik −29.379162, σ²=0.206076, n=48.
// Ljung–Box (lag = max(10, 2*1) = 10, fitdf = p+q+P+Q = 1): Q=9.356388, df=9, p=0.405048.
const res: ArimaSarimaResult = {
  p: 1, d: 0, q: 0, P: 0, D: 0, Q: 0, s: 1, autoSelected: true,
  coefs: [
    { term: 'ar1', estimate: 0.5739296, se: 0.1161393, ciLow: 0.3463007, ciHigh: 0.8015585 },
    { term: 'intercept', estimate: 2.413288, se: 0.1466135, ciLow: 2.1259308, ciHigh: 2.7006451 },
  ],
  aic: 64.758325, bic: 70.371928, loglik: -29.379162, sigma2: 0.206076,
  ljungboxQ: 9.356388, ljungboxLag: 10, ljungboxDf: 9, ljungboxP: 0.405048,
  forecastRows: [
    { period: 1, forecast: 2.692626, lo80: 2.110858, hi80: 3.274394, lo95: 1.802889, hi95: 3.582364 },
    { period: 2, forecast: 2.573609, lo80: 1.902834, hi80: 3.244384, lo95: 1.547747, hi95: 3.599470 },
  ],
  ciLevel: 0.95, n: 48, nExcluded: 0,
  figForecastPng: png, figResidualsPng: png,
}

describe('buildArimaSarima', () => {
  it('one coef table: stacked estimate/(SE)/[CI] per ARIMA term, a rule, then the 6 GOF rows', () => {
    const c = buildArimaSarima(ARIMA_SARIMA, res)
    expect(c.tables).toHaveLength(2)
    expect(c.tables[0].rows).toEqual([
      { _kind: 'coef', term: 'ar1', est: '0.57' },
      { _kind: 'se', term: '', est: '(0.12)' },
      { _kind: 'ci', term: '', est: '[0.35, 0.80]' },
      { _kind: 'coef', term: 'intercept', est: '2.41' },
      { _kind: 'se', term: '', est: '(0.15)' },
      { _kind: 'ci', term: '', est: '[2.13, 2.70]' },
      { _kind: 'rule' },
      { _kind: 'gof', term: 'Num.Obs.', est: '48' },
      { _kind: 'gof', term: 'σ²', est: '0.21' },
      { _kind: 'gof', term: 'Ljung–Box p', est: '.405' },
      { _kind: 'gof', term: 'AIC', est: '64.76' },
      { _kind: 'gof', term: 'BIC', est: '70.37' },
      { _kind: 'gof', term: 'Log.Lik.', est: '−29.38' },
      { _kind: 'span', term: 'Ljung–Box Q(9) = 9.36, p = .405 (lag 10, residual autocorrelation)' },
    ])
  })
  it('forecast stays a SEPARATE classic table (Table 2), unchanged', () => {
    const c = buildArimaSarima(ARIMA_SARIMA, res)
    expect(c.tables[1].spec.id).toBe('forecast')
    expect(c.tables[1].rows).toEqual([
      { period: 1, forecast: '2.69', pi80: '[2.11, 3.27]', pi95: '[1.80, 3.58]' },
      { period: 2, forecast: '2.57', pi80: '[1.90, 3.24]', pi95: '[1.55, 3.60]' },
    ])
  })
  it('keeps the plain table note, two figures, how-to-read; APA fills (p,d,q)/(P,D,Q)/AIC/Ljung–Box', () => {
    const c = buildArimaSarima(ARIMA_SARIMA, res)
    expect(c.note).toEqual(ARIMA_SARIMA.tableNote)
    expect(c.figures.map((g) => g.file)).toEqual(['forecast', 'residuals'])
    expect(c.apa).toBe('An ARIMA(1,0,0)(0,0,0) model was fit (AIC=64.76); the Ljung–Box test of residual autocorrelation gave p = .405.')
  })
})
