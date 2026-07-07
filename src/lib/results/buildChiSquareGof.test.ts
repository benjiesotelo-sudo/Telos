import { describe, it, expect } from 'vitest'
import { buildChiSquareGof } from './buildChiSquareGof'
import { CHI_SQUARE_GOF } from '../registry/chiSquareGof'
import type { ChiSquareGofResult } from '../stats/chiSquareGof'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const res: ChiSquareGofResult = { variable: 'method',
  rows: [
    { category: 'discussion', observed: 18, expected: 20, stdRes: -0.632 },
    { category: 'lecture', observed: 14, expected: 12, stdRes: 0.683 },
    { category: 'seminar', observed: 8, expected: 8, stdRes: 0 },
  ],
  chisq: 0.5333, df: 2, p: 0.7659, w: 0.1155, wLow: 0, wHigh: 1.4142, n: 40, minExpected: 8, alpha: 0.05, nExcluded: 0, figurePng: png }

describe('buildChiSquareGof', () => {
  it('Table 1 rows (expected 2 dp, stdres 2 dp with U+2212 minus) + Table 2', () => {
    const c = buildChiSquareGof(CHI_SQUARE_GOF, res)
    expect(c.tables[0].rows[0]).toEqual({ category: 'discussion', observed: 18, expected: '20.00', stdres: '−0.63' })
    expect(c.tables[1].rows).toEqual([{ chisq: '0.53', df: '2', p: '.766', w: '0.12 [0.00, 1.41]' }]) // one-sided CI — upper pinned (~1.41 for k=3)
    expect(c.note).toEqual(CHI_SQUARE_GOF.tableNote)
  })
  it('APA renders the real df in the drawn k−1 slot, with w + its [95% CI]', () => {
    expect(buildChiSquareGof(CHI_SQUARE_GOF, res).apa).toBe('A goodness-of-fit test, χ²(2, N=40)=0.53, p = .766, w=.12 [.00, 1.41].')
  })
  it('A5: values carries the term-explainer lookup, incl. per-category ranges', () => {
    expect(buildChiSquareGof(CHI_SQUARE_GOF, res).values).toEqual({
      category: '3', observed: '8–18', expected: '8.00–20.00', stdres: '0.00–0.68',
      chisq: '0.53', df: '2', n: '40', p: '= .766', alpha: '0.05', w: '.12', wLow: '.00', wHigh: '1.41',
      minExpected: '8.0',
    })
  })
  it('R1 gap-fix: dynamic small-expected-count warning appends when min expected < 5 (parity with the independence card)', () => {
    const sparse = buildChiSquareGof(CHI_SQUARE_GOF, { ...res, minExpected: 3.2 })
    expect(sparse.note!.text).toBe(CHI_SQUARE_GOF.tableNote!.text + " Smallest expected count here is 3.2 — consider Fisher's exact test.")
  })
  it('no warning appended when min expected >= 5', () => {
    expect(buildChiSquareGof(CHI_SQUARE_GOF, res).note).toEqual(CHI_SQUARE_GOF.tableNote)
  })
})
