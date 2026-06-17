import { describe, it, expect } from 'vitest'
import { buildFrequenciesCrosstabs } from './buildFrequenciesCrosstabs'
import { FREQUENCIES_CROSSTABS as spec } from '../registry/frequenciesCrosstabs'
import type { FrequenciesResult } from '../stats/frequenciesCrosstabs'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// No missing → Valid% == Total%, NO Missing row.
const oneVar: FrequenciesResult = { kind: 'one', crosstab: null, nExcluded: 0, nValid: 6, nTotal: 6, figurePng: png,
  freq: [
    { category: 'east', n: 1, validPct: 16.6666667, totalPct: 16.6666667, cumValidPct: 16.6666667 },
    { category: 'north', n: 2, validPct: 33.3333333, totalPct: 33.3333333, cumValidPct: 50 },
    { category: 'south', n: 3, validPct: 50, totalPct: 50, cumValidPct: 100 },
  ] }
// messy region-only (native-R ground truth): nTotal 8, nValid 7, nExcluded 1 → Valid% ≠ Total% + a Missing row.
const oneVarMissing: FrequenciesResult = { kind: 'one', crosstab: null, nExcluded: 1, nValid: 7, nTotal: 8, figurePng: png,
  freq: [
    { category: 'east', n: 1, validPct: 14.2857142857, totalPct: 12.5, cumValidPct: 14.2857142857 },
    { category: 'north', n: 2, validPct: 28.5714285714, totalPct: 25, cumValidPct: 42.8571428571 },
    { category: 'south', n: 4, validPct: 57.1428571429, totalPct: 50, cumValidPct: 100 },
  ] }
const twoVar: FrequenciesResult = { kind: 'two', freq: null, nExcluded: 1, nValid: 6, nTotal: 7, figurePng: png,
  crosstab: {
    rowCats: ['east', 'north', 'south'], colCats: ['f', 'm'],
    counts: [[0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 3, 6]],
    rowPct: [[0, 100, 100], [50, 50, 100], [66.6666667, 33.3333333, 100], [50, 50, 100]],
    colPct: [[0, 33.3333333, 16.6666667], [33.3333333, 33.3333333, 33.3333333], [66.6666667, 33.3333333, 50], [100, 100, 100]],
  } }

describe('buildFrequenciesCrosstabs', () => {
  it('one variable, no missing → Valid%/Total% split (equal here), NO Missing row, NO note, APA literal Table X', () => {
    const c = buildFrequenciesCrosstabs(spec, oneVar)
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec.id).toBe('frequencies')
    expect(c.tables[0].spec.columns.map((col) => col.label)).toEqual(['Category', 'n', 'Valid %', 'Total %', 'Cumulative %'])
    expect(c.tables[0].rows).toEqual([
      { category: 'east', n: 1, validpct: '16.7', totalpct: '16.7', cumpct: '16.7' },
      { category: 'north', n: 2, validpct: '33.3', totalpct: '33.3', cumpct: '50.0' },
      { category: 'south', n: 3, validpct: '50.0', totalpct: '50.0', cumpct: '100.0' },
    ])
    expect(c.note).toBeNull() // no Missing row → no note
    expect(c.figures).toEqual([{ caption: 'Category counts', type: 'bar', png }])
    expect(c.apa).toBe('Frequencies (and cross-tabulations) are reported in Table X.')
    expect(c.nExcluded).toBe(0)
  })

  it('one variable WITH missing → datasummary_crosstab Missing row (Valid%/cum em-dash, Total% over grand total) + note', () => {
    const c = buildFrequenciesCrosstabs(spec, oneVarMissing)
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec.id).toBe('frequencies')
    expect(c.tables[0].rows).toEqual([
      { category: 'east', n: 1, validpct: '14.3', totalpct: '12.5', cumpct: '14.3' },
      { category: 'north', n: 2, validpct: '28.6', totalpct: '25.0', cumpct: '42.9' },
      { category: 'south', n: 4, validpct: '57.1', totalpct: '50.0', cumpct: '100.0' },
      { category: 'Missing', n: 1, validpct: '—', totalpct: '12.5', cumpct: '—' },
    ])
    expect(c.note).toEqual({ kind: 'plain', text: 'Valid % uses the valid (non-missing) n as its denominator; Total % uses the grand total including the Missing row.' })
    expect(c.nExcluded).toBe(1)
  })
  it('two variables → DATA-DRIVEN columns, n (row% / col%) cells, count margins, the card note', () => {
    const c = buildFrequenciesCrosstabs(spec, twoVar)
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec.id).toBe('crosstab')
    expect(c.tables[0].spec.title).toBe(spec.tables[1].title)
    expect(c.tables[0].spec.columns.map((col) => col.label)).toEqual(['Row \\ Column', 'f', 'm', 'Total'])
    expect(c.tables[0].rows[0]).toEqual({ rowcat: 'east', c0: '0 (0.0% / 0.0%)', c1: '1 (100.0% / 33.3%)', total: '1' })
    expect(c.tables[0].rows[1]).toEqual({ rowcat: 'north', c0: '1 (50.0% / 33.3%)', c1: '1 (50.0% / 33.3%)', total: '2' })
    expect(c.tables[0].rows[2]).toEqual({ rowcat: 'south', c0: '2 (66.7% / 66.7%)', c1: '1 (33.3% / 33.3%)', total: '3' })
    expect(c.tables[0].rows[3]).toEqual({ rowcat: 'Total', c0: '3', c1: '3', total: '6' })
    expect(c.note).toEqual({ kind: 'plain', text: spec.tableNote!.text })
    expect(c.apa).toBe('Frequencies (and cross-tabulations) are reported in Table X.')
    expect(c.nExcluded).toBe(1)
  })
})
