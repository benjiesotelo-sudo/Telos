import { describe, it, expect } from 'vitest'
import { buildFrequenciesCrosstabs } from './buildFrequenciesCrosstabs'
import { FREQUENCIES_CROSSTABS as spec } from '../registry/frequenciesCrosstabs'
import type { FrequenciesResult } from '../stats/frequenciesCrosstabs'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const oneVar: FrequenciesResult = { kind: 'one', crosstab: null, nExcluded: 0, figurePng: png,
  freq: [
    { category: 'east', n: 1, pct: 16.6666667, cumPct: 16.6666667 },
    { category: 'north', n: 2, pct: 33.3333333, cumPct: 50 },
    { category: 'south', n: 3, pct: 50, cumPct: 100 },
  ] }
const twoVar: FrequenciesResult = { kind: 'two', freq: null, nExcluded: 1, figurePng: png,
  crosstab: {
    rowCats: ['east', 'north', 'south'], colCats: ['f', 'm'],
    counts: [[0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 3, 6]],
    rowPct: [[0, 100, 100], [50, 50, 100], [66.6666667, 33.3333333, 100], [50, 50, 100]],
    colPct: [[0, 33.3333333, 16.6666667], [33.3333333, 33.3333333, 33.3333333], [66.6666667, 33.3333333, 50], [100, 100, 100]],
  } }

describe('buildFrequenciesCrosstabs', () => {
  it('one variable → the frequency table only, 1-dp percentages, NO note, APA uses literal Table X', () => {
    const c = buildFrequenciesCrosstabs(spec, oneVar)
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec.id).toBe('frequencies')
    expect(c.tables[0].rows).toEqual([
      { category: 'east', n: 1, pct: '16.7', cumpct: '16.7' },
      { category: 'north', n: 2, pct: '33.3', cumpct: '50.0' },
      { category: 'south', n: 3, pct: '50.0', cumpct: '100.0' },
    ])
    expect(c.note).toBeNull()
    expect(c.figures).toEqual([{ caption: 'Category counts', type: 'bar', png }])
    expect(c.apa).toBe('Frequencies (and cross-tabulations) are reported in Table X.')
    expect(c.nExcluded).toBe(0)
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
