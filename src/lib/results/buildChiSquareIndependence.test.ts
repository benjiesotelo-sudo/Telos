import { describe, it, expect } from 'vitest'
import { buildChiSquareIndependence } from './buildChiSquareIndependence'
import { CHI_SQUARE_INDEPENDENCE } from '../registry/chiSquareIndependence'
import type { ChiSquareIndependenceResult } from '../stats/chiSquareIndependence'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const res: ChiSquareIndependenceResult = { rowVar: 'passed', colVar: 'gender',
  rowCats: ['no', 'yes'], colCats: ['female', 'male'],
  counts: [[8, 10, 18], [12, 10, 22], [20, 20, 40]],
  expected: [[9, 9], [11, 11]], rowPct: [[44.444, 55.556], [54.545, 45.455]], colPct: [[40, 50], [60, 50]],
  chisq: 0.2020, df: 1, p: 0.6531, v: 0.1005, minExpected: 9, n: 40, nExcluded: 0, figurePng: png }

describe('buildChiSquareIndependence', () => {
  it('contingency expands columns; cell = obs [exp] (row% / col%); margins plain', () => {
    const c = buildChiSquareIndependence(CHI_SQUARE_INDEPENDENCE, res)
    expect(c.tables[0].spec.columns.map((x) => x.label)).toEqual(['Row \\ Column', 'female', 'male', 'Total'])
    expect(c.tables[0].rows[0]).toEqual({ rowcat: 'no', c0: '8 [9.00] (44.4% / 40.0%)', c1: '10 [9.00] (55.6% / 50.0%)', total: '18' })
    expect(c.tables[0].rows[2]).toEqual({ rowcat: 'Total', c0: '20', c1: '20', total: '40' })
    expect(c.tables[1].rows).toEqual([{ chisq: '0.20', df: '1', p: '.653', v: '0.10' }])
  })
  it('min expected ≥ 5 → drawn note verbatim, no warning appended', () => {
    const c = buildChiSquareIndependence(CHI_SQUARE_INDEPENDENCE, res)
    expect(c.note!.text).toBe(CHI_SQUARE_INDEPENDENCE.tableNote!.text)
  })
  it('min expected < 5 → warning sentence appended (decision 5)', () => {
    const c = buildChiSquareIndependence(CHI_SQUARE_INDEPENDENCE, { ...res, minExpected: 3.2 })
    expect(c.note!.text).toBe(CHI_SQUARE_INDEPENDENCE.tableNote!.text + " Smallest expected count here is 3.2 — consider Fisher's exact test.")
  })
  it('APA keeps the card-literal wording with real values', () => {
    expect(buildChiSquareIndependence(CHI_SQUARE_INDEPENDENCE, res).apa)
      .toBe('A chi-square test of independence was significant, χ²(1, N=40)=0.20, p=.653, V=0.10.')
  })
})
