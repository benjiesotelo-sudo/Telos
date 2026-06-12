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
  chisq: 0.5333, df: 2, p: 0.7659, w: 0.1155, n: 40, nExcluded: 0, figurePng: png }

describe('buildChiSquareGof', () => {
  it('Table 1 rows (expected 2 dp, stdres 2 dp with U+2212 minus) + Table 2', () => {
    const c = buildChiSquareGof(CHI_SQUARE_GOF, res)
    expect(c.tables[0].rows[0]).toEqual({ category: 'discussion', observed: 18, expected: '20.00', stdres: '−0.63' })
    expect(c.tables[1].rows).toEqual([{ chisq: '0.53', df: '2', p: '.766', w: '0.12' }])
    expect(c.note).toEqual(CHI_SQUARE_GOF.tableNote)
  })
  it('APA renders the real df in the drawn k−1 slot', () => {
    expect(buildChiSquareGof(CHI_SQUARE_GOF, res).apa).toBe('A goodness-of-fit test, χ²(2, N=40)=0.53, p=.766, w=0.12.')
  })
})
