import { describe, it, expect } from 'vitest'
import { buildHausmanTest } from './buildHausmanTest'
import { HAUSMAN_TEST } from '../registry/hausmanTest'
import type { HausmanResult } from '../stats/hausmanTest'

// Native-R-verified (panel.csv, plm within|random, vcovHC arellano HC1 group, 95% CI):
// leverage FE −5.574297 SE 1.466992 CI [−8.493151,−2.655444] · RE −4.053601 SE 1.289718 CI [−6.615093,−1.492110]
// χ²=3.071622 df=3 p=0.380714 · N=96 · N entities=12 · FE within R²=0.914498 · RE R²=0.980050
const mock = (over: Partial<HausmanResult> = {}): HausmanResult => ({
  chisq: 3.071622, df: 3, p: 0.380714,
  compareRows: [
    { term: 'leverage', feB: -5.574297, reB: -4.053601, diff: -1.520696,
      feSe: 1.466992, feCiLow: -8.493151, feCiHigh: -2.655444, reSe: 1.289718, reCiLow: -6.615093, reCiHigh: -1.492110 },
    { term: 'rd_spend', feB: 1.888007, reB: 0.547641, diff: 1.340366,
      feSe: 0.743427, feCiLow: 0.408820, feCiHigh: 3.367193, reSe: 0.155511, reCiLow: 0.238783, reCiHigh: 0.856499 },
    { term: 'size', feB: 0.140074, reB: 0.956744, diff: -0.81667,
      feSe: 0.427020, feCiLow: -0.709563, feCiHigh: 0.989711, reSe: 0.047436, reCiLow: 0.862532, reCiHigh: 1.050956 },
  ],
  feR2: 0.914498, reR2: 0.980050, ciLevel: 0.95,
  alpha: 0.05, nObs: 96, nEntities: 12, nExcluded: 0,
  figCoefPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildHausmanTest', () => {
  it('SHAPE B: per term a coef {fe,re,diff} row, a muted (clustered SE) row, a muted [CI] row (diff blank on SE/CI)', () => {
    const rows = buildHausmanTest(HAUSMAN_TEST, mock()).tables[0].rows
    expect(rows[0]).toEqual({ _kind: 'coef', term: 'leverage', fe: '−5.57', re: '−4.05', diff: '−1.52' })
    expect(rows[1]).toEqual({ _kind: 'se', term: '', fe: '(1.47)', re: '(1.29)', diff: '' })
    expect(rows[2]).toEqual({ _kind: 'ci', term: '', fe: '[−8.49, −2.66]', re: '[−6.62, −1.49]', diff: '' })
  })
  it('a rule precedes the GOF footer; Num.Obs. / N entities sit in the FE column, R² per model column', () => {
    const rows = buildHausmanTest(HAUSMAN_TEST, mock()).tables[0].rows
    expect(rows.find((x) => x._kind === 'rule')).toEqual({ _kind: 'rule' })
    const gof = rows.filter((x) => x._kind === 'gof')
    expect(gof).toEqual([
      { _kind: 'gof', term: 'Num.Obs.', fe: '96', re: '', diff: '' },
      { _kind: 'gof', term: 'N entities', fe: '12', re: '', diff: '' },
      { _kind: 'gof', term: 'R²', fe: '.91', re: '.98', diff: '' },
    ])
  })
  it('the Hausman χ² renders as a full-width span row AFTER the gof rows (no Decision column)', () => {
    const rows = buildHausmanTest(HAUSMAN_TEST, mock()).tables[0].rows
    const span = rows[rows.length - 1]
    expect(span).toEqual({ _kind: 'span', term: 'Hausman χ²(3) = 3.07, p .381' })
    // report-only: no verdict / Decision anywhere in the rows
    expect(JSON.stringify(rows)).not.toContain('Decision')
    expect(JSON.stringify(rows)).not.toContain('FE / RE')
  })
  it('APA is neutralised — reports the statistic, no "favoured" verdict', () => {
    const apa = buildHausmanTest(HAUSMAN_TEST, mock()).apa
    expect(apa).toBe('A Hausman test comparing the fixed- and random-effects estimates gave χ²(3)=3.07, p = .381.')
    expect(apa).not.toContain('favoured')
  })
  it('how-to-read states the clustered SE + CI level and α', () => {
    const c = buildHausmanTest(HAUSMAN_TEST, mock())
    expect(c.howToRead).toContain('clustered by entity')
    expect(c.howToRead).toContain('95% CI')
    expect(c.howToRead).toContain('Your significance threshold (α) is 0.05')
  })
})
