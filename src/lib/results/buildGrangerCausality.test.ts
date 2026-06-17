import { describe, it, expect } from 'vitest'
import { buildGrangerCausality } from './buildGrangerCausality'
import { GRANGER_CAUSALITY } from '../registry/grangerCausality'
import type { GrangerResult } from '../stats/grangerCausality'

// Native-R-verified ground truth (timeseries.csv, ad_spend → sales, sorted by month, maxLag=4):
//   X→Y (ad_spend → sales):  F=47.891626 df=(4,63) p<.000001
//   Y→X (sales → ad_spend):  F=30.622152 df=(4,63) p<.000001
//   n=72 · nExcluded=0 · α=0.05
// (Rscript R 4.6.0: lmtest::grangertest(sales ~ ad_spend, order=4) etc.)
const mock = (over: Partial<GrangerResult> = {}): GrangerResult => ({
  rows: [
    { direction: 'X→Y', f: 47.891626, df1: 4, df2: 63, p: 1.1e-18 },
    { direction: 'Y→X', f: 30.622152, df1: 4, df2: 63, p: 4.4e-15 },
  ],
  maxLag: 4,
  alpha: 0.05,
  n: 72,
  nExcluded: 0,
  figCrossSeriesPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildGrangerCausality', () => {
  it('renders both-direction F/df/p rows from the result', () => {
    const rows = buildGrangerCausality(GRANGER_CAUSALITY, mock()).tables[0].rows
    expect(rows).toEqual([
      { direction: 'X→Y', f: '47.89', df: '4, 63', p: '<.001' },
      { direction: 'Y→X', f: '30.62', df: '4, 63', p: '<.001' },
    ])
  })

  it('APA reports both directions neutrally with the lag', () => {
    const apa = buildGrangerCausality(GRANGER_CAUSALITY, mock()).apa
    expect(apa).toBe(
      'Granger test X→Y: F(4,63)=47.89, p < .001; Y→X: F(4,63)=30.62, p < .001 (lag=4).',
    )
  })

  it('how-to-read references the card max lag of 4, not grangertest()\'s internal default of 1', () => {
    const c = buildGrangerCausality(GRANGER_CAUSALITY, mock())
    expect(c.howToRead).toContain('this card uses a max lag of 4')
    // the old, misleading reference to grangertest()'s default lag of 1 is gone
    expect(c.howToRead).not.toContain('default 1 in grangertest()')
  })

  it('how-to-read cites vars::VARselect for AIC/BIC lag selection', () => {
    const c = buildGrangerCausality(GRANGER_CAUSALITY, mock())
    expect(c.howToRead).toContain('vars::VARselect')
    expect(c.howToRead).toContain('AIC- and BIC-minimising lag')
    expect(c.howToRead).toContain('Your significance threshold (α) is 0.05')
  })

  it('table note carries the AIC/BIC VARselect lag-selection guidance', () => {
    const note = buildGrangerCausality(GRANGER_CAUSALITY, mock()).note
    expect(note).toMatchObject({ kind: 'plain' })
    expect((note as { text: string }).text).toContain('max lag of 4')
    expect((note as { text: string }).text).toContain('AIC/BIC (vars::VARselect)')
  })
})
